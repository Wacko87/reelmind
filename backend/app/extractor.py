import os
import uuid
import re
import glob
import html
import ipaddress
import urllib.request
from typing import Dict, Any, Optional
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode
import httpx
import yt_dlp
from .config import settings

ALLOWED_DOMAINS = (
    'tiktok.com',
    'instagram.com',
    'youtube.com',
    'youtu.be',
    'x.com',
    'twitter.com',
    'facebook.com',
    'fb.watch',
    'fb.com',
    'threads.net',
    'pinterest.com',
    'pin.it',
    'reddit.com',
    'redd.it',
    'imgur.com',
    'discordapp.com',
    'discordapp.net',
    'discord.com',
    'civitai.com',
    'midjourney.com',
    'githubusercontent.com',
    'huggingface.co',
    'twimg.com',
    'cdninstagram.com',
    'fbcdn.net',
    'pinimg.com',
    'googleusercontent.com',
    'unsplash.com'
)

IMAGE_EXTENSIONS = ('.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif')

IMAGE_CDN_DOMAINS = (
    'twimg.com',
    'cdninstagram.com',
    'fbcdn.net',
    'redd.it',
    'imgur.com',
    'discordapp.com',
    'discordapp.net',
    'discord.com',
    'pinimg.com',
    'civitai.com',
    'midjourney.com',
    'googleusercontent.com',
    'githubusercontent.com',
    'unsplash.com'
)

def is_direct_image_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
        path_lower = parsed.path.lower()
        if any(path_lower.endswith(ext) for ext in IMAGE_EXTENSIONS):
            return True
        q_lower = parsed.query.lower()
        if any(f"format={ext.lstrip('.')}" in q_lower or f"ext={ext.lstrip('.')}" in q_lower for ext in IMAGE_EXTENSIONS):
            return True
        hostname = (parsed.hostname or "").lower()
        if any(hostname == cdn or hostname.endswith('.' + cdn) for cdn in IMAGE_CDN_DOMAINS):
            return True
        return False
    except Exception:
        return False

TRACKING_PARAMS = {
    'igsh', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 
    'utm_content', 'si', 'feature', 'fbclid', 'gclid', '_t', '_r',
    'share_id', 'ref', 'source', 'sender_device',
    'mibextid', 'sfnsn', 'rdid', 'refid', '__cft__', '__tn__', 'paipv',
    'exln', 'img_index'
}

def resolve_facebook_url(url: str) -> str:
    """
    Facebook en apps móviles genera URLs de compartir como:
    - https://www.facebook.com/share/r/<token>
    - https://www.facebook.com/share/v/<token>
    - https://www.facebook.com/share/p/<token>
    - https://fb.watch/<token>
    
    yt-dlp no reconoce directamente el path /share/r/ sin resolver.
    Esta función extrae el enlace canónico (og:url / canonical) o el reel ID
    resolviendo la petición HTTP de forma segura.
    """
    url_lower = url.lower()
    if not ('facebook.com/share/' in url_lower or 'fb.watch/' in url_lower):
        return url

    headers = {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
    }

    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            final_url = resp.geturl()
            if any(k in final_url for k in ('/reel/', '/watch/', '/videos/')):
                return final_url

            refresh = resp.headers.get('refresh', '')
            match_ref = re.search(r'(?:fullscreen_video/|video_id=|v=|reel/|videos/)(\d+)', refresh)
            if match_ref:
                return f"https://facebook.com/reel/{match_ref.group(1)}"

            body = resp.read(65536).decode('utf-8', errors='ignore')
            
            og_match = re.search(r'property=[\"\']og:url[\"\']\s+content=[\"\']([^\"\']+)[\"\']', body)
            if og_match and any(k in og_match.group(1) for k in ('/reel/', '/watch', '/videos/')):
                return og_match.group(1)

            canon_match = re.search(r'rel=[\"\']canonical[\"\']\s+href=[\"\']([^\"\']+)[\"\']', body)
            if canon_match and any(k in canon_match.group(1) for k in ('/reel/', '/watch', '/videos/')):
                return canon_match.group(1)

            reel_match = re.search(r'facebook\.com/reel/(\d+)', body)
            if reel_match:
                return f"https://facebook.com/reel/{reel_match.group(1)}"
    except Exception:
        pass

    return url

def validate_and_clean_url(url: str, is_image_mode: bool = False) -> str:
    """
    Valida que la URL pertenezca a dominios autorizados (Anti-SSRF),
    bloquea IPs locales/privadas y limpia parámetros de tracking.
    Soporta también data URLs de imágenes en base64, rutas locales /api/images/ y URLs directas de imagen.
    """
    target = url.strip()

    # 0. Si es ruta local /api/images/
    if target.startswith("/api/images/"):
        return target

    # 1. Si es imagen en base64 (Data URL)
    if target.startswith("data:image/"):
        if not re.match(r'^data:image/[a-zA-Z0-9\+\-\.]+;base64,', target):
            raise ValueError("Formato de imagen en base64 no válido.")
        return target

    # 2. Si no tiene protocolo, asumir https://
    if not (target.startswith("http://") or target.startswith("https://")):
        match = re.search(r'(https?://[^\s]+)', target)
        if match:
            target = match.group(1)
        else:
            target = "https://" + target

    parsed = urlparse(target)
    if not parsed.netloc:
        raise ValueError("URL no válida o incompleta.")

    scheme = parsed.scheme.lower()
    if scheme not in ('http', 'https'):
        raise ValueError(f"Esquema de red no seguro: {scheme}. Solo se permite https.")

    hostname = (parsed.hostname or "").lower()

    # 3. Protección Anti-SSRF: Bloquear localhost, nombres locales e IPs directas privadas
    if hostname in ('localhost', '127.0.0.1', '0.0.0.0', '::1') or hostname.endswith('.local') or hostname.endswith('.internal'):
        raise ValueError("Acceso a direcciones locales o privadas bloqueado por seguridad (Anti-SSRF).")

    is_ip = False
    try:
        ip = ipaddress.ip_address(hostname)
        is_ip = True
    except ValueError:
        pass

    if is_ip and (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved):
        raise ValueError("Acceso a IPs privadas o de red local bloqueado por seguridad (Anti-SSRF).")

    # 4. Validación de Dominio:
    # Si es modo imagen, o es URL directa/CDN de imagen, se permite cualquier host público seguro.
    is_direct_img = is_image_mode or is_direct_image_url(target)
    is_allowed = is_direct_img or any(hostname == domain or hostname.endswith('.' + domain) for domain in ALLOWED_DOMAINS)
    if not is_allowed:
        raise ValueError(
            f"El dominio '{hostname}' no está en la lista de plataformas de vídeo compatibles. Si se trata de una infografía o imagen, selecciona la opción 'Imagen' en el selector."
        )

    # 5. Limpieza de Parámetros de Telemetría/Tracking
    # Si es imagen con ?format=jpg o parámetros de formato, NO eliminarlos
    keep_all_queries = is_direct_img and any(k in parsed.query.lower() for k in ('format=', 'ext=', 'width=', 'height=', 'quality='))
    if keep_all_queries:
        filtered_queries = parse_qsl(parsed.query, keep_blank_values=False)
    else:
        filtered_queries = [
            (k, v) for k, v in parse_qsl(parsed.query, keep_blank_values=False)
            if k.lower() not in TRACKING_PARAMS
        ]

    clean_path = re.sub(r'/+$', '', parsed.path)
    clean_netloc = (parsed.hostname or "").lower()
    if clean_netloc.startswith("www."):
        clean_netloc = clean_netloc[4:]

    cleaned = urlunparse((
        "https",
        clean_netloc,
        clean_path,
        '',
        urlencode(filtered_queries),
        ''
    ))

    # Si es una URL de compartir de Facebook (/share/r/, /share/v/, fb.watch), resolver a enlace canónico de reel/vídeo
    if 'facebook.com/share/' in cleaned.lower() or 'fb.watch/' in cleaned.lower():
        resolved = resolve_facebook_url(cleaned)
        if resolved != cleaned:
            # Re-normalizar URL canónica
            return validate_and_clean_url(resolved, is_image_mode=is_image_mode)

    return cleaned

def detect_platform(url: str) -> str:
    url_lower = url.lower()
    if url_lower.startswith("data:image/"):
        return "upload"
    elif "tiktok.com" in url_lower:
        return "tiktok"
    elif "instagram.com" in url_lower:
        return "instagram"
    elif "youtube.com" in url_lower or "youtu.be" in url_lower:
        return "youtube"
    elif "facebook.com" in url_lower or "fb.watch" in url_lower or "fb.com" in url_lower:
        return "facebook"
    elif "x.com" in url_lower or "twitter.com" in url_lower:
        return "twitter"
    elif "threads.net" in url_lower:
        return "threads"
    elif "pinterest.com" in url_lower or "pin.it" in url_lower:
        return "pinterest"
    elif "reddit.com" in url_lower or "redd.it" in url_lower:
        return "reddit"
    elif "imgur.com" in url_lower:
        return "imgur"
    elif "discord" in url_lower:
        return "discord"
    elif "civitai.com" in url_lower:
        return "civitai"
    elif "midjourney.com" in url_lower:
        return "midjourney"
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
        media_type: str = "reel",
        media_paths: Optional[list] = None,
        image_urls: Optional[list] = None
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
        self.media_paths = media_paths or ([self.media_path] if self.media_path else [])
        self.image_urls = image_urls or ([thumbnail_url] if thumbnail_url else [])

    def cleanup(self):
        temp_dir = os.path.join(settings.DATA_DIR, "temp")
        if os.path.exists(temp_dir) and self.temp_prefix:
            for f in glob.glob(f"{self.temp_prefix}*"):
                try:
                    os.remove(f)
                except OSError:
                    pass

def extract_image_content(url: str, temp_prefix: str) -> VideoExtractionResult:
    import base64
    platform = detect_platform(url)

    # 1. Caso ruta local /api/images/ (subida directa local)
    if url.startswith("/api/images/"):
        filename = os.path.basename(url.split("?")[0])
        local_path = os.path.join(settings.DATA_DIR, "images", filename)
        if not os.path.exists(local_path):
            raise ValueError(f"No se encontró el archivo de imagen local en el servidor: {filename}")
        
        with open(local_path, "rb") as f:
            raw_data = f.read()

        ext = os.path.splitext(filename)[1].lstrip(".").lower() or "jpg"
        mime = f"image/{ext}" if ext != "jpg" else "image/jpeg"

        out_path = f"{temp_prefix}.{ext}"
        with open(out_path, "wb") as f:
            f.write(raw_data)

        return VideoExtractionResult(
            platform="upload",
            title="Infografía / Tarjeta de Prompts IA",
            author="Subida local",
            author_url=None,
            thumbnail_url=url,
            duration=0,
            description="Imagen o infografía subida localmente.",
            temp_prefix=temp_prefix,
            audio_path=None,
            media_path=out_path,
            mime_type=mime,
            media_type="image"
        )

    # 2. Caso Data URL (pegado directo desde portapapeles o upload en base64)
    if url.startswith("data:image/"):
        m = re.match(r'^data:image/([a-zA-Z0-9\+\-\.]+);base64,(.+)$', url, re.DOTALL)
        if not m:
            raise ValueError("Formato de imagen en base64 no válido.")
        subtype = m.group(1).lower()
        ext = "jpg" if subtype in ("jpeg", "jpg") else ("png" if subtype == "png" else ("webp" if subtype == "webp" else "jpg"))
        raw_b64 = m.group(2)
        try:
            img_bytes = base64.b64decode(raw_b64)
        except Exception:
            raise ValueError("No se pudieron decodificar los datos de la imagen.")
            
        if len(img_bytes) > settings.MAX_FILESIZE_BYTES:
            raise ValueError("La imagen supera el límite permitido de 50 MB.")

        out_path = f"{temp_prefix}.{ext}"
        with open(out_path, "wb") as f:
            f.write(img_bytes)

        return VideoExtractionResult(
            platform="upload",
            title="Infografía / Tarjeta de Prompts IA",
            author="Portapapeles / Subida local",
            author_url=None,
            thumbnail_url=None,
            duration=0,
            description="Infografía o tarjeta de prompts capturada directamente.",
            temp_prefix=temp_prefix,
            audio_path=None,
            media_path=out_path,
            mime_type=f"image/{subtype}",
            media_type="image"
        )

    # 3. Caso URL remota directa de imagen o página web con imagen
    browser_headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,text/html,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    }

    # Cabeceras de bot para redes sociales (Instagram, Twitter/X, Facebook, Threads, etc.)
    # Las redes sociales devuelven el HTML completo con og:image a bots/crawlers, mientras que a navegadores les muestran login walls.
    bot_headers = {
        'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    }

    is_direct = is_direct_image_url(url)
    initial_headers = browser_headers if is_direct else bot_headers

    try:
        with httpx.Client(follow_redirects=True, timeout=20.0, headers=initial_headers) as client:
            resp = client.get(url)
            resp.raise_for_status()
            content_type = resp.headers.get('content-type', '').lower()
            raw_data = resp.content
            final_url = str(resp.url)
    except Exception as e:
        # Reintento con cabeceras de navegador si falló el bot
        if not is_direct:
            try:
                with httpx.Client(follow_redirects=True, timeout=20.0, headers=browser_headers) as client:
                    resp = client.get(url)
                    resp.raise_for_status()
                    content_type = resp.headers.get('content-type', '').lower()
                    raw_data = resp.content
                    final_url = str(resp.url)
            except Exception:
                raise RuntimeError(f"No se pudo descargar la imagen o página web: {str(e)}")
        else:
            raise RuntimeError(f"No se pudo descargar la imagen o página web: {str(e)}")

    if len(raw_data) > settings.MAX_FILESIZE_BYTES:
        raise ValueError("La imagen supera el límite permitido de 50 MB.")

    # 3a. Si la respuesta HTTP ya es directamente una imagen (Content-Type: image/...)
    if any(content_type.startswith(p) for p in ('image/', 'application/octet-stream')) or is_direct_image_url(final_url):
        ext = "jpg"
        mime = "image/jpeg"
        if "png" in content_type or final_url.lower().endswith(".png"):
            ext = "png"
            mime = "image/png"
        elif "webp" in content_type or final_url.lower().endswith(".webp"):
            ext = "webp"
            mime = "image/webp"
        elif "gif" in content_type or final_url.lower().endswith(".gif"):
            ext = "gif"
            mime = "image/gif"

        out_path = f"{temp_prefix}.{ext}"
        with open(out_path, "wb") as f:
            f.write(raw_data)

        parsed = urlparse(final_url)
        path_name = os.path.basename(parsed.path)
        base_title = os.path.splitext(path_name)[0]
        clean_title = re.sub(r'[-_]+', ' ', base_title).strip()
        if not clean_title or len(clean_title) < 3:
            clean_title = "Infografía de Inteligencia Artificial"

        return VideoExtractionResult(
            platform=platform,
            title=clean_title,
            author=parsed.netloc,
            author_url=f"https://{parsed.netloc}",
            thumbnail_url=final_url,
            duration=0,
            description="Imagen o infografía técnica descargada directamente.",
            temp_prefix=temp_prefix,
            audio_path=None,
            media_path=out_path,
            mime_type=mime,
            media_type="image"
        )

    # 3b. Si es una página HTML (p. ej. post de Instagram /p/, X/Twitter, Threads, Pinterest, Reddit)
    html_text = raw_data.decode('utf-8', errors='ignore')

    # Si se cargó con bot pero no tiene og:image, probar una vez con browser_headers
    if 'og:image' not in html_text and 'twitter:image' not in html_text:
        try:
            with httpx.Client(follow_redirects=True, timeout=15.0, headers=browser_headers) as client:
                fb_resp = client.get(url)
                if fb_resp.status_code == 200:
                    html_text = fb_resp.text
        except Exception:
            pass

    # A. Detección especial de carruseles de Instagram (diapositivas)
    slides = []
    if "instagram.com" in url.lower():
        seen_slides = set()
        for m in re.finditer(r'(https://[^\s\"\'\<\>]*cdninstagram\.com[^\s\"\'\<\>]*t51\.82787-15[^\s\"\'\<\>]*)', html_text):
            raw_img = m.group(1).replace('&amp;', '&')
            clean_id = raw_img.split('?')[0]
            if clean_id not in seen_slides:
                seen_slides.add(clean_id)
                slides.append(raw_img)

    # Extracción y limpieza del título
    og_title_match = (
        re.search(r'property=[\"\']og:title[\"\']\s+content=[\"\']([^\"\']+)[\"\']', html_text, re.IGNORECASE) or
        re.search(r'name=[\"\']twitter:title[\"\']\s+content=[\"\']([^\"\']+)[\"\']', html_text, re.IGNORECASE) or
        re.search(r'<title>(.*?)</title>', html_text, re.IGNORECASE)
    )
    raw_title = og_title_match.group(1).strip() if og_title_match else "Infografía de IA"
    title = html.unescape(raw_title).strip()

    # Extracción y limpieza de descripción
    og_desc_match = (
        re.search(r'property=[\"\']og:description[\"\']\s+content=[\"\']([^\"\']+)[\"\']', html_text, re.IGNORECASE) or
        re.search(r'name=[\"\']twitter:description[\"\']\s+content=[\"\']([^\"\']+)[\"\']', html_text, re.IGNORECASE) or
        re.search(r'name=[\"\']description[\"\']\s+content=[\"\']([^\"\']+)[\"\']', html_text, re.IGNORECASE)
    )
    description = html.unescape(og_desc_match.group(1)).strip() if og_desc_match else None

    # Caso A: Carrusel con múltiples diapositivas detectadas
    if len(slides) > 1:
        print(f"📸 Detectado carrusel con {len(slides)} imágenes/diapositivas. Descargando todas...")
        downloaded_paths = []
        for idx, slide_url in enumerate(slides[:15]):
            slide_out_path = f"{temp_prefix}_{idx}.jpg"
            try:
                with httpx.Client(follow_redirects=True, timeout=20.0, headers=browser_headers) as client:
                    img_resp = client.get(slide_url)
                    img_resp.raise_for_status()
                    with open(slide_out_path, "wb") as f:
                        f.write(img_resp.content)
                    downloaded_paths.append(slide_out_path)
            except Exception as dl_err:
                print(f"⚠️ Error descargando diapositiva {idx+1}: {dl_err}")

        if downloaded_paths:
            return VideoExtractionResult(
                platform=platform,
                title=title,
                author=urlparse(url).netloc,
                author_url=url,
                thumbnail_url=slides[0],
                duration=0,
                description=description,
                temp_prefix=temp_prefix,
                audio_path=None,
                media_path=downloaded_paths[0],
                media_paths=downloaded_paths,
                image_urls=slides[:len(downloaded_paths)],
                mime_type="image/jpeg",
                media_type="image"
            )

    # Caso B: Imagen individual vía OpenGraph o Twitter meta tags
    og_img_match = (
        re.search(r'property=[\"\']og:image[\"\']\s+content=[\"\']([^\"\']+)[\"\']', html_text, re.IGNORECASE) or
        re.search(r'content=[\"\']([^\"\']+)[\"\']\s+property=[\"\']og:image[\"\']', html_text, re.IGNORECASE) or
        re.search(r'name=[\"\']twitter:image[\"\']\s+content=[\"\']([^\"\']+)[\"\']', html_text, re.IGNORECASE) or
        re.search(r'name=[\"\']twitter:image:src[\"\']\s+content=[\"\']([^\"\']+)[\"\']', html_text, re.IGNORECASE)
    )
    if not og_img_match and not slides:
        raise ValueError("No se pudo detectar ninguna imagen o infografía en esta página.")

    img_src = slides[0] if slides else og_img_match.group(1).replace("&amp;", "&")

    # Descargar la imagen de la metaetiqueta o CDN
    try:
        with httpx.Client(follow_redirects=True, timeout=20.0, headers=browser_headers) as client:
            img_resp = client.get(img_src)
            img_resp.raise_for_status()
            img_ct = img_resp.headers.get('content-type', '').lower()
            img_bytes = img_resp.content
    except Exception as e:
        raise RuntimeError(f"No se pudo descargar la imagen referenciada ({img_src[:80]}...): {str(e)}")

    ext = "jpg"
    mime = "image/jpeg"
    if "png" in img_ct:
        ext = "png"
        mime = "image/png"
    elif "webp" in img_ct:
        ext = "webp"
        mime = "image/webp"

    out_path = f"{temp_prefix}.{ext}"
    with open(out_path, "wb") as f:
        f.write(img_bytes)

    return VideoExtractionResult(
        platform=platform,
        title=title,
        author=urlparse(url).netloc,
        author_url=url,
        thumbnail_url=img_src,
        duration=0,
        description=description,
        temp_prefix=temp_prefix,
        audio_path=None,
        media_path=out_path,
        media_paths=[out_path],
        image_urls=[img_src],
        mime_type=mime,
        media_type="image"
    )

def extract_video_and_audio(url: str, requested_type: str = "auto") -> VideoExtractionResult:
    cleaned_url = validate_and_clean_url(url, is_image_mode=(requested_type == "image"))
    platform = detect_platform(cleaned_url)
    
    unique_id = str(uuid.uuid4())
    temp_dir = os.path.join(settings.DATA_DIR, "temp")
    os.makedirs(temp_dir, exist_ok=True)
    temp_media_prefix = os.path.join(temp_dir, f"media_{unique_id}")

    # Si se solicitó explícitamente como imagen, o es data URL, o ruta local /api/images/, o URL directa de archivo de imagen:
    if requested_type == "image" or cleaned_url.startswith("data:image/") or cleaned_url.startswith("/api/images/") or is_direct_image_url(cleaned_url):
        return extract_image_content(cleaned_url, temp_media_prefix)

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
            'allowed_extractors': [
                'youtube', 'youtube:*', 
                'tiktok', 
                'instagram', 
                'twitter', 'twitter:*', 'x', 'x:*',
                'facebook', 'facebook:reel', 'facebook:*', 'FacebookPluginsVideo', 'FacebookRedirectURL'
            ],
        }
        if cookies_path and os.path.exists(cookies_path):
            ydl_opts_meta['cookiefile'] = cookies_path

        # 1. Obtener metadatos sin descargar nada (ultra rápido y sin ancho de banda)
        info = None
        try:
            with yt_dlp.YoutubeDL(ydl_opts_meta) as ydl:
                info = ydl.extract_info(cleaned_url, download=False)
        except Exception as e:
            if requested_type == "auto":
                try:
                    print(f"⚠️ yt-dlp falló ({e}), intentando extraer como imagen/infografía...")
                    return extract_image_content(cleaned_url, temp_media_prefix)
                except Exception as img_err:
                    print(f"⚠️ Extracción como imagen también falló: {img_err}")
            raise RuntimeError(f"No se pudieron obtener metadatos del contenido proporcionado: {str(e)}")

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
            'allowed_extractors': [
                'youtube', 'youtube:*', 
                'tiktok', 
                'instagram', 
                'twitter', 'twitter:*', 'x', 'x:*',
                'facebook', 'facebook:reel', 'facebook:*', 'FacebookPluginsVideo', 'FacebookRedirectURL'
            ],
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
