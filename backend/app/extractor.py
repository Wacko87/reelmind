import os
import uuid
import re
import glob
import ipaddress
from typing import Dict, Any, Optional
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode
import yt_dlp
from .config import settings

ALLOWED_DOMAINS = (
    'tiktok.com',
    'instagram.com',
    'youtube.com',
    'youtu.be',
    'x.com',
    'twitter.com',
)

TRACKING_PARAMS = {
    'igsh', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 
    'utm_content', 'si', 'feature', 'fbclid', 'gclid', '_t', '_r',
    'share_id', 'ref', 'source', 'sender_device'
}

def validate_and_clean_url(url: str) -> str:
    """
    Valida que la URL pertenezca a dominios autorizados (Anti-SSRF),
    bloquea IPs locales/privadas y limpia parámetros de tracking.
    """
    match = re.search(r'(https?://[^\s]+)', url)
    target = match.group(1) if match else url.strip()

    parsed = urlparse(target)
    if not parsed.netloc:
        raise ValueError("URL no válida o incompleta.")

    scheme = parsed.scheme.lower()
    if scheme not in ('http', 'https'):
        raise ValueError(f"Esquema de red no seguro: {scheme}. Solo se permite https.")

    hostname = (parsed.hostname or "").lower()

    # 1. Protección Anti-SSRF: Bloquear localhost, nombres locales e IPs directas
    if hostname in ('localhost', '127.0.0.1', '0.0.0.0', '::1') or hostname.endswith('.local') or hostname.endswith('.internal'):
        raise ValueError("Acceso a direcciones locales o privadas bloqueado por seguridad (Anti-SSRF).")

    try:
        ip = ipaddress.ip_address(hostname)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
            raise ValueError("Acceso a IPs privadas o de red local bloqueado por seguridad (Anti-SSRF).")
    except ValueError:
        pass

    # 2. Validación de Lista Blanca de Dominios
    is_allowed = any(hostname == domain or hostname.endswith('.' + domain) for domain in ALLOWED_DOMAINS)
    if not is_allowed:
        raise ValueError(
            f"El dominio '{hostname}' no está permitido. ReelMind solo admite vídeos de TikTok, Instagram, YouTube y X/Twitter."
        )

    # 3. Limpieza de Parámetros de Telemetría/Tracking
    filtered_queries = [
        (k, v) for k, v in parse_qsl(parsed.query, keep_blank_values=False)
        if k.lower() not in TRACKING_PARAMS
    ]

    clean_path = re.sub(r'/+$', '', parsed.path)
    clean_netloc = (parsed.hostname or "").lower()
    if clean_netloc.startswith("www."):
        clean_netloc = clean_netloc[4:]

    return urlunparse((
        "https",
        clean_netloc,
        clean_path,
        '',
        urlencode(filtered_queries),
        ''
    ))

def detect_platform(url: str) -> str:
    url_lower = url.lower()
    if "tiktok.com" in url_lower:
        return "tiktok"
    elif "instagram.com" in url_lower:
        return "instagram"
    elif "youtube.com" in url_lower or "youtu.be" in url_lower:
        return "youtube"
    elif "x.com" in url_lower or "twitter.com" in url_lower:
        return "twitter"
    return "other"

def clean_url(url: str) -> str:
    return validate_and_clean_url(url)

class VideoExtractionResult:
    def __init__(
        self,
        platform: str,
        title: Optional[str],
        author: Optional[str],
        author_url: Optional[str],
        thumbnail_url: Optional[str],
        duration: Optional[int],
        description: Optional[str],
        temp_prefix: str,
        audio_path: Optional[str] = None,
        media_path: Optional[str] = None,
        mime_type: Optional[str] = None,
        media_type: str = "reel"
    ):
        self.platform = platform
        self.title = title
        self.author = author
        self.author_url = author_url
        self.thumbnail_url = thumbnail_url
        self.duration = duration
        self.description = description
        self.temp_prefix = temp_prefix
        self.media_path = media_path or audio_path
        self.audio_path = audio_path or self.media_path
        self.mime_type = mime_type or ("video/mp4" if (self.media_path and self.media_path.endswith(".mp4")) else "audio/mp3")
        self.media_type = media_type

    def cleanup(self):
        temp_dir = os.path.join(settings.DATA_DIR, "temp")
        if os.path.exists(temp_dir) and self.temp_prefix:
            for f in glob.glob(f"{self.temp_prefix}*"):
                try:
                    os.remove(f)
                except OSError:
                    pass

def extract_video_and_audio(url: str, requested_type: str = "auto") -> VideoExtractionResult:
    cleaned_url = validate_and_clean_url(url)
    platform = detect_platform(cleaned_url)
    
    unique_id = str(uuid.uuid4())
    temp_dir = os.path.join(settings.DATA_DIR, "temp")
    os.makedirs(temp_dir, exist_ok=True)
    temp_media_prefix = os.path.join(temp_dir, f"media_{unique_id}")

    try:
        cookies_path = os.getenv("YT_DLP_COOKIES_PATH")

        base_headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }

        ydl_opts_meta = {
            'quiet': True,
            'no_warnings': True,
            'noplaylist': True,
            'socket_timeout': 15,
            'retries': 2,
            'http_headers': base_headers,
            'allowed_extractors': ['youtube', 'youtube:*', 'tiktok', 'instagram', 'twitter', 'twitter:*', 'x', 'x:*'],
        }
        if cookies_path and os.path.exists(cookies_path):
            ydl_opts_meta['cookiefile'] = cookies_path

        # 1. Obtener metadatos sin descargar nada (ultra rápido y sin ancho de banda)
        info = None
        try:
            with yt_dlp.YoutubeDL(ydl_opts_meta) as ydl:
                info = ydl.extract_info(cleaned_url, download=False)
        except Exception as e:
            raise RuntimeError(f"No se pudieron obtener metadatos del vídeo proporcionado: {str(e)}")

        if not info:
            raise RuntimeError("No se pudieron obtener metadatos del vídeo proporcionado.")

        # Rechazar emisiones en directo para evitar bloqueos por streams infinitos
        if info.get('is_live') or info.get('live_status') in ('is_live', 'is_upcoming', 'post_live'):
            raise ValueError("Las emisiones en directo o programadas no son compatibles. Espera a que finalice la retransmisión.")

        duration = info.get('duration') or 0
        title = info.get('title')
        author = info.get('uploader') or info.get('channel') or info.get('creator')
        author_url = info.get('uploader_url') or info.get('channel_url')
        thumbnail_url = info.get('thumbnail')
        description = info.get('description')

        # Determinar si debe tratarse como 'video' largo o como 'reel' corto
        is_long_video = False
        if requested_type == "video":
            is_long_video = True
        elif requested_type == "auto":
            # Si dura más de 10 minutos (600s), catalogar automáticamente como vídeo largo
            if duration > settings.MAX_VIDEO_DURATION_SECONDS:
                is_long_video = True
        elif requested_type == "reel":
            if duration > settings.MAX_VIDEO_DURATION_SECONDS:
                raise ValueError(
                    f"El vídeo dura {int(duration // 60)} min. Para vídeos de más de 10 minutos, guárdalo en el apartado 'Vídeos' (sin descarga)."
                )

        # 2. Si es vídeo largo (> 10 min o solicitado como video):
        # NO descargar archivo de audio/vídeo, solo guardar enlace y metadatos
        if is_long_video:
            return VideoExtractionResult(
                platform=platform,
                title=title,
                author=author,
                author_url=author_url,
                thumbnail_url=thumbnail_url,
                duration=duration,
                description=description,
                temp_prefix="",
                audio_path=None,
                media_path=None,
                mime_type=None,
                media_type="video"
            )

        # 3. Si es reel (< 10 min): descargar VÍDEO ligero (<=720p MP4) para que Gemini pueda leer
        # prompts sobreimpresos en pantalla, ver imágenes generadas y escuchar el audio simultáneamente.
        media_path = None
        mime_type = "video/mp4"

        ydl_opts_video = {
            # Seleccionar stream de vídeo MP4 hasta 720p ligero + audio
            'format': 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/bestvideo[height<=720]+bestaudio/best[height<=720]/best',
            'outtmpl': f"{temp_media_prefix}.%(ext)s",
            'merge_output_format': 'mp4',
            'quiet': True,
            'no_warnings': True,
            'noplaylist': True,
            'socket_timeout': 20,
            'retries': 2,
            'max_filesize': settings.MAX_FILESIZE_BYTES, # 50 MB
            'http_headers': base_headers,
            'allowed_extractors': ['youtube', 'youtube:*', 'tiktok', 'instagram', 'twitter', 'twitter:*', 'x', 'x:*'],
        }
        if cookies_path and os.path.exists(cookies_path):
            ydl_opts_video['cookiefile'] = cookies_path

        try:
            with yt_dlp.YoutubeDL(ydl_opts_video) as ydl:
                # Reutilizar metadatos ya extraídos para evitar segunda petición a la red
                try:
                    download_info = ydl.process_ie_result(info, download=True)
                except Exception:
                    download_info = ydl.extract_info(cleaned_url, download=True)

                expected_mp4 = f"{temp_media_prefix}.mp4"
                if os.path.exists(expected_mp4):
                    media_path = expected_mp4
                    mime_type = "video/mp4"
                else:
                    matches = glob.glob(f"{temp_media_prefix}.*")
                    if matches:
                        media_path = matches[0]
                        ext = os.path.splitext(media_path)[1].lower().replace(".", "")
                        mime_type = f"video/{ext}" if ext in ("mp4", "webm", "quicktime") else "video/mp4"

                if not duration and download_info:
                    duration = download_info.get('duration') or 0
        except Exception:
            # Fallback automático a audio si el vídeo falla o supera límites
            try:
                ydl_opts_audio = {
                    'format': 'bestaudio[abr<=96]/bestaudio[ext=m4a]/bestaudio/best',
                    'outtmpl': f"{temp_media_prefix}.%(ext)s",
                    'postprocessors': [{
                        'key': 'FFmpegExtractAudio',
                        'preferredcodec': 'mp3',
                        'preferredquality': '48',
                    }],
                    'quiet': True,
                    'no_warnings': True,
                    'noplaylist': True,
                    'socket_timeout': 15,
                    'retries': 2,
                    'max_filesize': settings.MAX_FILESIZE_BYTES,
                    'http_headers': base_headers,
                    'allowed_extractors': ydl_opts_video['allowed_extractors'],
                }
                if cookies_path and os.path.exists(cookies_path):
                    ydl_opts_audio['cookiefile'] = cookies_path

                with yt_dlp.YoutubeDL(ydl_opts_audio) as ydl:
                    ydl.extract_info(cleaned_url, download=True)
                    expected_mp3 = f"{temp_media_prefix}.mp3"
                    if os.path.exists(expected_mp3):
                        media_path = expected_mp3
                        mime_type = "audio/mp3"
            except Exception:
                media_path = None

        return VideoExtractionResult(
            platform=platform,
            title=title,
            author=author,
            author_url=author_url,
            thumbnail_url=thumbnail_url,
            duration=duration,
            description=description,
            temp_prefix=temp_media_prefix,
            audio_path=media_path,
            media_path=media_path,
            mime_type=mime_type,
            media_type="reel"
        )
    except Exception:
        # Limpieza garantizada ante fallos inesperados
        for f in glob.glob(f"{temp_media_prefix}*"):
            try:
                os.remove(f)
            except OSError:
                pass
        raise
