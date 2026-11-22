import os
import hmac
import glob
import time
import json
import uuid
import datetime
import asyncio
import io
import re
import zipfile
import shutil
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Depends, Query, Request, Response, Header, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import aiosqlite

from .config import settings
from .database import get_db, init_db, get_connection, DB_PATH
from .auth import require_auth, create_auth_token, verify_token_string
from .security import encrypt_secret, decrypt_secret, verify_pin
from .schemas import (
    ReelAnalyzeRequest,
    ReelResponse,
    ReelUpdateRequest,
    AppSettingsSchema,
    GeminiAnalysisResult,
    FolderCreate,
    FolderUpdate,
    FolderItem,
    LoginRequest,
    LoginResponse,
    AuthStatusResponse,
    PromptOptimizeRequest,
    PromptOptimizeResponse,
    VaultAskRequest,
    VaultAskResponse,
)
from .extractor import extract_video_and_audio, validate_and_clean_url
from .gemini_service import (
    analyze_reel_with_gemini, 
    analyze_video_with_gemini,
    analyze_image_with_gemini,
    optimize_prompt_with_gemini,
    ask_vault_with_gemini
)

app = FastAPI(title="ReelMind API", version="1.4.0")

# Compresión automática de respuestas HTTP (>1KB) para menor latencia en móvil
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Middleware de Cabeceras de Seguridad HTTP (Security Headers)
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response

# Semáforo de concurrencia para proteger CPU ffmpeg y cuota Gemini
extraction_semaphore = asyncio.Semaphore(2)
ai_task_semaphore = asyncio.Semaphore(2)

# Rate limiting simple en memoria para login (protección contra fuerza bruta de PIN)
login_attempts: Dict[str, List[float]] = {}

@app.on_event("startup")
async def on_startup():
    await init_db()
    
    os.makedirs(os.path.join(settings.DATA_DIR, "images"), exist_ok=True)
    os.makedirs(os.path.join(settings.DATA_DIR, "temp"), exist_ok=True)
    
    # Migración transparente: cifrar con Fernet (AES-128-CBC) cualquier API key en texto plano
    try:
        db = await get_connection()
        cursor = await db.execute("SELECT value FROM app_settings WHERE key = 'gemini_api_key'")
        row = await cursor.fetchone()
        if row and row["value"] and not row["value"].startswith("gAAAAA"):
            encrypted = encrypt_secret(row["value"])
            await db.execute("UPDATE app_settings SET value = ? WHERE key = 'gemini_api_key'", (encrypted,))
            await db.commit()
        await db.close()
    except Exception as e:
        print(f"Aviso en migración de cifrado: {e}")

    temp_dir = os.path.join(settings.DATA_DIR, "temp")
    if os.path.exists(temp_dir):
        now_ts = time.time()
        for f in glob.glob(os.path.join(temp_dir, "*")):
            try:
                if now_ts - os.path.getmtime(f) > 3600:
                    os.remove(f)
            except Exception:
                pass

async def get_active_api_key() -> str:
    db = await get_connection()
    try:
        cursor = await db.execute("SELECT value FROM app_settings WHERE key = 'gemini_api_key'")
        row = await cursor.fetchone()
        if row and row["value"]:
            return decrypt_secret(row["value"])
    finally:
        await db.close()
    return settings.GEMINI_API_KEY

BASE_REEL_SELECT = """
    SELECT r.*, f.name as folder_name 
    FROM reels r 
    LEFT JOIN folders f ON r.folder_id = f.id
"""

def safe_json_loads(val: Any) -> list:
    if not val:
        return []
    if isinstance(val, list):
        return val
    try:
        parsed = json.loads(val)
        return parsed if isinstance(parsed, list) else []
    except (ValueError, TypeError):
        return []

def format_reel_row(row: aiosqlite.Row) -> dict:
    row_dict = dict(row)
    return {
        "id": row_dict["id"],
        "url": row_dict["url"],
        "platform": row_dict["platform"],
        "author": row_dict.get("author"),
        "author_url": row_dict.get("author_url"),
        "original_title": row_dict.get("original_title"),
        "thumbnail_url": row_dict.get("thumbnail_url"),
        "duration": int(round(float(row_dict.get("duration") or 0))),
        "title": row_dict["title"],
        "summary": row_dict["summary"],
        "ai_tools": safe_json_loads(row_dict.get("ai_tools")),
        "key_steps": safe_json_loads(row_dict.get("key_steps")),
        "prompts": safe_json_loads(row_dict.get("prompts")),
        "tags": safe_json_loads(row_dict.get("tags")),
        "difficulty": row_dict.get("difficulty") or "Intermedio",
        "estimated_time": row_dict.get("estimated_time") or "15-30 min",
        "status": row_dict.get("status") or "pending",
        "user_notes": row_dict.get("user_notes") or "",
        "folder_id": row_dict.get("folder_id"),
        "folder_name": row_dict.get("folder_name"),
        "media_type": row_dict.get("media_type") or "reel",
        "images": safe_json_loads(row_dict.get("images")),
        "is_duplicate": False,
        "created_at": row_dict["created_at"],
        "updated_at": row_dict["updated_at"],
    }

def sanitize_frontmatter_val(val: Optional[str]) -> str:
    """Previene inyecciones en YAML frontmatter eliminando saltos de línea y escapando comillas/barras."""
    if not val:
        return ""
    cleaned = str(val).replace("\r", " ").replace("\n", " ").strip()
    return cleaned.replace('\\', '\\\\').replace('"', '\\"')

def generate_reel_markdown(reel: dict) -> str:
    raw_tools = reel.get("ai_tools") or []
    raw_tags = reel.get("tags") or []
    prompts = reel.get("prompts") or []
    steps = reel.get("key_steps") or []
    title = reel.get("title") or "Sin título"
    clean_title = str(title).replace("\r", " ").replace("\n", " ").strip()

    tools = [str(t).replace("\r", " ").replace("\n", " ").strip() for t in raw_tools if t]
    tags = [str(t).replace("\r", " ").replace("\n", " ").strip() for t in raw_tags if t]

    frontmatter_tools = "\n".join([f'  - "{sanitize_frontmatter_val(t)}"' for t in tools]) if tools else "  []"
    frontmatter_tags = "\n".join([f'  - "{sanitize_frontmatter_val(t)}"' for t in tags]) if tags else "  []"

    safe_title = sanitize_frontmatter_val(clean_title)
    safe_platform = sanitize_frontmatter_val(reel.get("platform") or "web")
    safe_url = sanitize_frontmatter_val(reel.get("url") or "")
    safe_author = sanitize_frontmatter_val(reel.get("author") or "")
    safe_media_type = sanitize_frontmatter_val(reel.get("media_type") or "reel")
    safe_difficulty = sanitize_frontmatter_val(reel.get("difficulty") or "Intermedio")
    safe_estimated_time = sanitize_frontmatter_val(reel.get("estimated_time") or "15-30 min")
    safe_status = sanitize_frontmatter_val(reel.get("status") or "pending")
    safe_folder = sanitize_frontmatter_val(reel.get("folder_name") or "Sin carpeta")
    safe_created = sanitize_frontmatter_val(reel.get("created_at") or "")

    md = f"""---
title: "{safe_title}"
platform: "{safe_platform}"
url: "{safe_url}"
author: "{safe_author}"
media_type: "{safe_media_type}"
difficulty: "{safe_difficulty}"
estimated_time: "{safe_estimated_time}"
status: "{safe_status}"
folder: "{safe_folder}"
created_at: "{safe_created}"
ai_tools:
{frontmatter_tools}
tags:
{frontmatter_tags}
---

# {clean_title}

> [!abstract] Resumen Ejecutivo
> {reel.get('summary') or 'Sin resumen disponible.'}

- **Fuente:** [{str(reel.get('platform') or 'Ver').capitalize()}]({reel.get('url')})
- **Creador:** {reel.get('author') or 'Desconocido'}
- **Dificultad:** {reel.get('difficulty') or 'Intermedio'} | **Tiempo estimado:** {reel.get('estimated_time') or '15-30 min'}
- **Estado:** {reel.get('status') or 'pending'}

## 🛠️ Herramientas & Modelos de IA
"""
    if tools:
        for t in tools:
            md += f"- **{t}**\n"
    else:
        md += "_No se detectaron herramientas específicas._\n"

    md += "\n## 📋 Pasos Clave\n"
    if steps:
        for idx, step in enumerate(steps, 1):
            md += f"{idx}. {step}\n"
    else:
        md += "_Sin pasos detallados._\n"

    md += "\n## 💬 Prompts & Instrucciones\n"
    if prompts:
        for idx, p in enumerate(prompts, 1):
            md += f"### Prompt #{idx}\n```text\n{p}\n```\n\n"
    else:
        md += "_No se incluyeron prompts textuales._\n\n"

    images_list = reel.get("images") or []
    if images_list and len(images_list) > 1:
        md += "## 🖼️ Carrusel de Diapositivas / Infografías\n"
        for idx, img_p in enumerate(images_list, 1):
            md += f"### Diapositiva {idx}\n![Diapositiva {idx}]({img_p})\n\n"
    elif reel.get("media_type") == "image" or reel.get("thumbnail_url"):
        img_target = reel.get('thumbnail_url') or reel.get('url')
        if img_target:
            md += f"## 🖼️ Ficha Visual / Infografía\n![{clean_title}]({img_target})\n\n"

    if reel.get("user_notes"):
        md += f"## 📝 Notas Personales\n{reel['user_notes']}\n\n"

    md += "---\n*Guardado con ReelMind Homelab*\n"
    return md

async def fetch_reel_by_id(db: aiosqlite.Connection, reel_id: str) -> Optional[dict]:
    cursor = await db.execute(f"{BASE_REEL_SELECT} WHERE r.id = ?", (reel_id,))
    row = await cursor.fetchone()
    return format_reel_row(row) if row else None

# ==========================================
# RUTAS DE AUTENTICACIÓN
# ==========================================

@app.get("/api/auth/status", response_model=AuthStatusResponse)
async def auth_status(request: Request, authorization: Optional[str] = Header(None)):
    if not settings.AUTH_PIN:
        return {"auth_required": False, "is_authenticated": True}
    
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ", 1)[1].strip()
    if not token:
        token = request.cookies.get("reelmind_auth")

    is_auth = verify_token_string(token) if token else False
    return {"auth_required": True, "is_authenticated": is_auth}

@app.post("/api/auth/login", response_model=LoginResponse)
async def login(data: LoginRequest, request: Request, response: Response):
    if not settings.AUTH_PIN:
        return {"success": True, "message": "Acceso libre (sin PIN configurado)"}

    # Control de fuerza bruta por IP (respetando proxy inverso Nginx Proxy Manager): máx 5 intentos por minuto
    forwarded = request.headers.get("x-forwarded-for")
    client_ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")
    now_ts = time.time()
    attempts = [t for t in login_attempts.get(client_ip, []) if now_ts - t < 60]
    
    if len(attempts) >= 5:
        raise HTTPException(
            status_code=429,
            detail="Demasiados intentos fallidos. Espera 60 segundos antes de volver a intentar."
        )

    # Comparación segura en tiempo constante (soporta hash PBKDF2 y texto plano)
    if not verify_pin(data.pin, settings.AUTH_PIN):
        attempts.append(now_ts)
        login_attempts[client_ip] = attempts
        raise HTTPException(status_code=401, detail="PIN o contraseña de acceso incorrecta")

    # Éxito: limpiar intentos
    login_attempts.pop(client_ip, None)

    token = create_auth_token()
    is_secure = request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"
    response.set_cookie(
        key="reelmind_auth",
        value=token,
        max_age=30 * 24 * 3600,
        httponly=True,
        samesite="lax",
        secure=is_secure
    )
    return {"success": True, "token": token, "message": "Autenticado con éxito"}

@app.post("/api/auth/logout")
async def logout(response: Response):
    response.delete_cookie(key="reelmind_auth")
    return {"success": True, "message": "Sesión cerrada"}

# ==========================================
# RUTAS DE CARPETAS Y SUBCARPETAS
# ==========================================

async def get_folder_subtree_ids(db: aiosqlite.Connection, parent_id: str) -> List[str]:
    """Obtiene el ID de la carpeta y todas sus subcarpetas descendientes en 1 sola consulta SQL recursiva nativa."""
    query = """
    WITH RECURSIVE subtree(id) AS (
        SELECT id FROM folders WHERE id = ?
        UNION ALL
        SELECT f.id FROM folders f
        JOIN subtree s ON f.parent_id = s.id
    )
    SELECT id FROM subtree;
    """
    cursor = await db.execute(query, (parent_id,))
    rows = await cursor.fetchall()
    return [r[0] for r in rows] if rows else [parent_id]

@app.get("/api/folders", response_model=List[FolderItem], dependencies=[Depends(require_auth)])
async def list_folders(
    media_type: Optional[str] = Query(None, description="Filtrar contadores por tipo ('reel' o 'video')"),
    db: aiosqlite.Connection = Depends(get_db)
):
    cursor = await db.execute("SELECT * FROM folders ORDER BY name ASC")
    rows = await cursor.fetchall()
    
    if media_type:
        if media_type == 'reel':
            cursor_counts = await db.execute(
                "SELECT folder_id, COUNT(*) as count FROM reels WHERE folder_id IS NOT NULL AND (media_type = 'reel' OR media_type IS NULL) GROUP BY folder_id"
            )
        else:
            cursor_counts = await db.execute(
                "SELECT folder_id, COUNT(*) as count FROM reels WHERE folder_id IS NOT NULL AND media_type = ? GROUP BY folder_id",
                (media_type,)
            )
    else:
        cursor_counts = await db.execute("SELECT folder_id, COUNT(*) as count FROM reels WHERE folder_id IS NOT NULL GROUP BY folder_id")
    counts_map = {r["folder_id"]: r["count"] for r in await cursor_counts.fetchall()}

    folder_map: Dict[str, dict] = {}
    for r in rows:
        fid = r["id"]
        direct_count = counts_map.get(fid, 0)
        folder_map[fid] = {
            "id": fid,
            "name": r["name"],
            "parent_id": r["parent_id"],
            "icon": r["icon"] or "📁",
            "color": r["color"] or "#8b5cf6",
            "reel_count": direct_count,
            "total_reel_count": direct_count,
            "children": [],
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
        }

    root_folders: List[dict] = []
    for fid, f in folder_map.items():
        pid = f["parent_id"]
        if pid and pid in folder_map:
            folder_map[pid]["children"].append(f)
        else:
            root_folders.append(f)

    def calculate_total_counts(item: dict) -> int:
        total = item["reel_count"]
        for child in item["children"]:
            total += calculate_total_counts(child)
        item["total_reel_count"] = total
        return total

    for rf in root_folders:
        calculate_total_counts(rf)

    return root_folders

@app.post("/api/folders", response_model=FolderItem, dependencies=[Depends(require_auth)])
async def create_folder(data: FolderCreate, db: aiosqlite.Connection = Depends(get_db)):
    if data.parent_id:
        cursor = await db.execute("SELECT id FROM folders WHERE id = ?", (data.parent_id,))
        if not await cursor.fetchone():
            raise HTTPException(status_code=400, detail="La carpeta padre no existe.")

    folder_id = str(uuid.uuid4())
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    icon = data.icon.strip() if data.icon else "📁"
    color = data.color.strip() if data.color else "#8b5cf6"

    await db.execute(
        """
        INSERT INTO folders (id, name, parent_id, icon, color, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (folder_id, data.name.strip(), data.parent_id, icon, color, now, now)
    )
    await db.commit()

    return {
        "id": folder_id,
        "name": data.name.strip(),
        "parent_id": data.parent_id,
        "icon": icon,
        "color": color,
        "reel_count": 0,
        "total_reel_count": 0,
        "children": [],
        "created_at": now,
        "updated_at": now,
    }

@app.patch("/api/folders/{folder_id}", dependencies=[Depends(require_auth)])
async def update_folder(folder_id: str, data: FolderUpdate, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT * FROM folders WHERE id = ?", (folder_id,))
    row = await cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Carpeta no encontrada.")

    updates = []
    params = []

    if data.name is not None:
        updates.append("name = ?")
        params.append(data.name.strip())

    if data.parent_id is not None:
        if data.parent_id == folder_id:
            raise HTTPException(status_code=400, detail="Una carpeta no puede ser subcarpeta de sí misma.")
        if data.parent_id != "":
            descendant_ids = await get_folder_subtree_ids(db, folder_id)
            if data.parent_id in descendant_ids:
                raise HTTPException(status_code=400, detail="No puedes mover una carpeta dentro de una de sus propias subcarpetas.")
        updates.append("parent_id = ?")
        params.append(data.parent_id if data.parent_id != "" else None)

    if data.icon is not None:
        updates.append("icon = ?")
        params.append(data.icon.strip())

    if data.color is not None:
        updates.append("color = ?")
        params.append(data.color.strip())

    if updates:
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        updates.append("updated_at = ?")
        params.append(now)
        params.append(folder_id)
        await db.execute(f"UPDATE folders SET {', '.join(updates)} WHERE id = ?", params)
        await db.commit()

    cursor = await db.execute("SELECT * FROM folders WHERE id = ?", (folder_id,))
    updated = await cursor.fetchone()
    return dict(updated)

@app.delete("/api/folders/{folder_id}", dependencies=[Depends(require_auth)])
async def delete_folder(folder_id: str, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT id FROM folders WHERE id = ?", (folder_id,))
    if not await cursor.fetchone():
        raise HTTPException(status_code=404, detail="Carpeta no encontrada.")

    subtree_ids = await get_folder_subtree_ids(db, folder_id)
    placeholders = ",".join("?" for _ in subtree_ids)
    await db.execute(f"UPDATE reels SET folder_id = NULL WHERE folder_id IN ({placeholders})", subtree_ids)

    await db.execute("DELETE FROM folders WHERE id = ?", (folder_id,))
    await db.commit()
    return {"success": True, "message": "Carpeta eliminada"}

# ==========================================
# RUTAS DE REELS
# ==========================================

@app.post("/api/reels/analyze", response_model=ReelResponse, dependencies=[Depends(require_auth)])
async def analyze_reel(request: ReelAnalyzeRequest):
    req_type = request.media_type or "auto"
    is_img = (req_type == "image")
    print(f"📥 [Analyze Request] url='{request.url[:120]}' media_type='{req_type}'")
    try:
        url = validate_and_clean_url(request.url, is_image_mode=is_img)
    except ValueError as ve:
        print(f"❌ [Analyze Validation Error] {str(ve)}")
        raise HTTPException(status_code=400, detail=str(ve))

    # 1. Comprobar si ya existe (comprobando url normalizada y variaciones www)
    alt_url = url.replace("https://", "https://www.") if "://www." not in url else url.replace("://www.", "://")
    db = await get_connection()
    try:
        cursor = await db.execute(
            f"{BASE_REEL_SELECT} WHERE r.url = ? OR r.url = ? OR r.url = ?",
            (url, request.url.strip(), alt_url)
        )
        existing = await cursor.fetchone()
        if existing:
            dup = format_reel_row(existing)
            dup["is_duplicate"] = True
            return dup
    finally:
        await db.close()

    # 2. Clave Gemini
    api_key = await get_active_api_key()
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="Falta configurar la Gemini API Key. Añádela en Ajustes o en el archivo .env."
        )

    # 3. Extraer contenido multimedia bajo el semáforo de concurrencia
    async with extraction_semaphore:
        try:
            extraction = await asyncio.to_thread(extract_video_and_audio, url, req_type)
        except ValueError as ve:
            print(f"❌ [Extraction ValueError] {str(ve)}")
            raise HTTPException(status_code=400, detail=str(ve))
        except Exception as e:
            print(f"❌ [Extraction Exception] {str(e)}")
            raise HTTPException(status_code=422, detail=f"Error al obtener el contenido: {str(e)}")

        # 4. Analizar con Gemini
        stored_thumb = extraction.thumbnail_url
        reel_id = str(uuid.uuid4())
        try:
            if extraction.media_type == "video":
                # Resumen ligero para vídeos largos (>10 min): bajo consumo de tokens, 0 descargas
                analysis: GeminiAnalysisResult = await analyze_video_with_gemini(
                    extraction=extraction,
                    api_key=api_key,
                    model_name=settings.GEMINI_MODEL
                )
            elif extraction.media_type == "image":
                # Análisis de infografía / cheatsheet con OCR de prompts y parámetros
                analysis: GeminiAnalysisResult = await analyze_image_with_gemini(
                    extraction=extraction,
                    api_key=api_key,
                    model_name=settings.GEMINI_MODEL
                )
                images_dir = os.path.join(settings.DATA_DIR, "images")
                os.makedirs(images_dir, exist_ok=True)

                paths = getattr(extraction, "media_paths", None) or ([extraction.media_path] if extraction.media_path else [])
                stored_images = []
                for idx, p in enumerate(paths):
                    if p and os.path.exists(p):
                        img_ext = os.path.splitext(p)[1].lower() or ".jpg"
                        dest_name = f"{reel_id}_{idx}{img_ext}" if len(paths) > 1 else f"{reel_id}{img_ext}"
                        dest_path = os.path.join(images_dir, dest_name)
                        try:
                            shutil.copy2(p, dest_path)
                            stored_images.append(f"/api/images/{dest_name}")
                        except Exception as copy_err:
                            print(f"Aviso al persistir imagen {idx}: {copy_err}")

                if stored_images:
                    stored_thumb = stored_images[0]
            else:
                # Análisis multimodal con audio para reels cortos (<10 min)
                analysis: GeminiAnalysisResult = await analyze_reel_with_gemini(
                    extraction=extraction,
                    api_key=api_key,
                    model_name=settings.GEMINI_MODEL
                )
                stored_images = []
        except Exception as e:
            extraction.cleanup()
            raise HTTPException(status_code=500, detail=f"Error al analizar con Gemini: {str(e)}")
        finally:
            extraction.cleanup()

    # Si la URL era un data URL en base64, usar la URL interna persistida para no engordar la DB
    if url.startswith("data:image/") and stored_thumb:
        url = stored_thumb

    # 5. Guardar en SQLite de forma atómica
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    folder_id = request.folder_id if request.folder_id else None

    db = await get_connection()
    try:
        await db.execute(
            """
            INSERT INTO reels (
                id, url, platform, author, author_url, original_title, thumbnail_url,
                duration, title, summary, ai_tools, key_steps, prompts, tags,
                difficulty, estimated_time, status, user_notes, folder_id, media_type,
                images, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                reel_id,
                url,
                extraction.platform,
                extraction.author,
                extraction.author_url,
                extraction.title,
                stored_thumb,
                int(round(float(extraction.duration or 0))),
                analysis.title,
                analysis.summary,
                json.dumps(analysis.ai_tools, ensure_ascii=False),
                json.dumps(analysis.key_steps, ensure_ascii=False),
                json.dumps(analysis.prompts, ensure_ascii=False),
                json.dumps(analysis.tags, ensure_ascii=False),
                analysis.difficulty,
                analysis.estimated_time or "15-30 min",
                "pending",
                "",
                folder_id,
                extraction.media_type,
                json.dumps(stored_images, ensure_ascii=False),
                now,
                now,
            )
        )
        await db.commit()

        new_reel = await fetch_reel_by_id(db, reel_id)
        if not new_reel:
            raise HTTPException(status_code=500, detail="Error al recuperar el reel recién guardado")
        return new_reel
    finally:
        await db.close()

@app.get("/api/reels", response_model=List[ReelResponse], dependencies=[Depends(require_auth)])
async def list_reels(
    q: Optional[str] = Query(None, description="Búsqueda por texto"),
    status: Optional[str] = Query(None, description="pending, tested, favorite"),
    tool: Optional[str] = Query(None, description="Filtrar por herramienta de IA"),
    tag: Optional[str] = Query(None, description="Filtrar por etiqueta"),
    folder_id: Optional[str] = Query(None, description="Filtrar por carpeta ('unassigned' para sin carpeta)"),
    media_type: Optional[str] = Query(None, description="Filtrar por tipo: 'reel' (<10m) o 'video' (>10m)"),
    time: Optional[str] = Query(None, description="Filtrar por tiempo: '< 5 min', '15-30 min', '> 1 hora'"),
    db: aiosqlite.Connection = Depends(get_db)
):
    query = f"{BASE_REEL_SELECT} WHERE 1=1"
    params = []

    if media_type:
        if media_type == 'reel':
            query += " AND (r.media_type = 'reel' OR r.media_type IS NULL)"
        else:
            query += " AND r.media_type = ?"
            params.append(media_type)

    if folder_id:
        if folder_id in ("unassigned", "none"):
            query += " AND r.folder_id IS NULL"
        else:
            subtree_ids = await get_folder_subtree_ids(db, folder_id)
            placeholders = ",".join("?" for _ in subtree_ids)
            query += f" AND r.folder_id IN ({placeholders})"
            params.extend(subtree_ids)

    if status:
        query += " AND r.status = ?"
        params.append(status)

    if time:
        query += " AND r.estimated_time = ?"
        params.append(time)

    if q:
        query += " AND (r.title LIKE ? OR r.summary LIKE ? OR r.original_title LIKE ? OR r.author LIKE ? OR r.prompts LIKE ?)"
        like_pattern = f"%{q}%"
        params.extend([like_pattern, like_pattern, like_pattern, like_pattern, like_pattern])

    if tool:
        query += " AND EXISTS (SELECT 1 FROM json_each(r.ai_tools) WHERE LOWER(json_each.value) = LOWER(?))"
        params.append(tool)

    if tag:
        query += " AND EXISTS (SELECT 1 FROM json_each(r.tags) WHERE LOWER(json_each.value) = LOWER(?))"
        params.append(tag)

    query += " ORDER BY r.created_at DESC"

    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()
    return [format_reel_row(row) for row in rows]

@app.get("/api/reels/{reel_id}", response_model=ReelResponse, dependencies=[Depends(require_auth)])
async def get_reel(reel_id: str, db: aiosqlite.Connection = Depends(get_db)):
    reel = await fetch_reel_by_id(db, reel_id)
    if not reel:
        raise HTTPException(status_code=404, detail="Reel no encontrado.")
    return reel

@app.patch("/api/reels/{reel_id}", response_model=ReelResponse, dependencies=[Depends(require_auth)])
async def update_reel(reel_id: str, request: ReelUpdateRequest, db: aiosqlite.Connection = Depends(get_db)):
    updates = []
    params = []

    if request.status is not None:
        updates.append("status = ?")
        params.append(request.status)

    if request.user_notes is not None:
        updates.append("user_notes = ?")
        params.append(request.user_notes)

    if request.title is not None:
        updates.append("title = ?")
        params.append(request.title)

    if request.tags is not None:
        updates.append("tags = ?")
        params.append(json.dumps(request.tags, ensure_ascii=False))

    if request.folder_id is not None:
        updates.append("folder_id = ?")
        params.append(request.folder_id if request.folder_id != "" else None)

    if request.media_type is not None:
        updates.append("media_type = ?")
        params.append(request.media_type)

    if request.estimated_time is not None:
        updates.append("estimated_time = ?")
        params.append(request.estimated_time)

    if updates:
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        updates.append("updated_at = ?")
        params.append(now)
        params.append(reel_id)
        cursor = await db.execute(f"UPDATE reels SET {', '.join(updates)} WHERE id = ?", params)
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Reel no encontrado.")
        await db.commit()

    updated = await fetch_reel_by_id(db, reel_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Reel no encontrado.")
    return updated

@app.delete("/api/reels/{reel_id}", dependencies=[Depends(require_auth)])
async def delete_reel(reel_id: str, db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("DELETE FROM reels WHERE id = ?", (reel_id,))
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Reel no encontrado.")

    await db.commit()
    return {"success": True, "message": "Reel eliminado correctamente"}

@app.get("/api/stats", dependencies=[Depends(require_auth)])
async def get_stats(db: aiosqlite.Connection = Depends(get_db)):
    # 1. Consulta consolidada en 1 solo pase para todos los contadores
    cursor = await db.execute("""
        SELECT 
            COUNT(*) as total,
            COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pending,
            COALESCE(SUM(CASE WHEN status = 'tested' THEN 1 ELSE 0 END), 0) as tested,
            COALESCE(SUM(CASE WHEN status = 'favorite' THEN 1 ELSE 0 END), 0) as favorite,
            COALESCE(SUM(CASE WHEN folder_id IS NULL THEN 1 ELSE 0 END), 0) as unassigned,
            COALESCE(SUM(CASE WHEN media_type = 'reel' OR media_type IS NULL THEN 1 ELSE 0 END), 0) as reels_count,
            COALESCE(SUM(CASE WHEN media_type = 'video' THEN 1 ELSE 0 END), 0) as videos_count,
            COALESCE(SUM(CASE WHEN media_type = 'image' THEN 1 ELSE 0 END), 0) as images_count
        FROM reels
    """)
    counts = dict(await cursor.fetchone())

    # 2. Agregación de herramientas mediante motor JSON nativo de SQLite
    try:
        cursor_tools = await db.execute("""
            SELECT TRIM(value) as name, COUNT(*) as count 
            FROM reels, json_each(reels.ai_tools) 
            WHERE TRIM(value) != ''
            GROUP BY LOWER(TRIM(value)) 
            ORDER BY count DESC LIMIT 12
        """)
        sorted_tools = [dict(r) for r in await cursor_tools.fetchall()]
    except Exception:
        sorted_tools = []

    # 3. Agregación de etiquetas mediante motor JSON nativo de SQLite
    try:
        cursor_tags = await db.execute("""
            SELECT LOWER(TRIM(value)) as name, COUNT(*) as count 
            FROM reels, json_each(reels.tags) 
            WHERE TRIM(value) != ''
            GROUP BY LOWER(TRIM(value)) 
            ORDER BY count DESC LIMIT 12
        """)
        sorted_tags = [dict(r) for r in await cursor_tags.fetchall()]
    except Exception:
        sorted_tags = []

    return {
        "total": counts["total"],
        "reels_count": counts["reels_count"],
        "videos_count": counts["videos_count"],
        "images_count": counts["images_count"],
        "pending": counts["pending"],
        "tested": counts["tested"],
        "favorite": counts["favorite"],
        "unassigned": counts["unassigned"],
        "top_tools": sorted_tools,
        "top_tags": sorted_tags,
    }

@app.get("/api/settings", dependencies=[Depends(require_auth)])
async def get_settings(db: aiosqlite.Connection = Depends(get_db)):
    cursor = await db.execute("SELECT value FROM app_settings WHERE key = 'gemini_api_key'")
    row = await cursor.fetchone()
    stored_key = decrypt_secret(row["value"]) if (row and row["value"]) else ""
    active_key = stored_key or settings.GEMINI_API_KEY
    masked_key = ""
    if active_key:
        masked_key = active_key[:4] + "..." + active_key[-4:] if len(active_key) > 8 else "****"

    return {
        "has_gemini_key": bool(active_key),
        "masked_key": masked_key,
        "gemini_model": settings.GEMINI_MODEL,
        "is_custom_configured": bool(stored_key),
    }

@app.post("/api/settings", dependencies=[Depends(require_auth)])
async def save_settings(data: AppSettingsSchema, db: aiosqlite.Connection = Depends(get_db)):
    if data.gemini_api_key is not None:
        key_val = data.gemini_api_key.strip()
        # Cifrar simétricamente con AES-Fernet antes de guardar en SQLite
        encrypted_val = encrypt_secret(key_val) if key_val else ""
        await db.execute(
            """
            INSERT INTO app_settings (key, value) VALUES ('gemini_api_key', ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """,
            (encrypted_val,)
        )
        await db.commit()

    return {"success": True, "message": "Configuración guardada de forma cifrada"}

# ==========================================
# RUTAS DE EXPORTACIÓN OBSIDIAN & ASISTENTE IA
# ==========================================

from urllib.parse import quote

@app.get("/api/reels/{reel_id}/markdown", dependencies=[Depends(require_auth)])
async def export_reel_markdown(reel_id: str, db: aiosqlite.Connection = Depends(get_db)):
    reel = await fetch_reel_by_id(db, reel_id)
    if not reel:
        raise HTTPException(status_code=404, detail="Reel no encontrado.")

    md_content = generate_reel_markdown(reel)
    raw_title = reel.get("title") or "recurso"
    safe_ascii = re.sub(r'[^a-zA-Z0-9_\-]', '_', raw_title[:60]).strip('_') or "recurso"
    encoded_filename = quote(f"{raw_title[:60]}.md")

    return Response(
        content=md_content,
        media_type="text/markdown; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_ascii}.md"; filename*=UTF-8\'\'{encoded_filename}'
        }
    )

@app.get("/api/export/vault", dependencies=[Depends(require_auth)])
async def export_vault_zip(db: aiosqlite.Connection = Depends(get_db)):
    # 1. Obtener todas las carpetas y construir rutas relativas seguras
    cursor = await db.execute("SELECT id, name, parent_id FROM folders")
    folder_rows = await cursor.fetchall()
    folder_map = {row["id"]: {"name": row["name"], "parent_id": row["parent_id"]} for row in folder_rows}

    def sanitize_path_segment(seg: str, fallback: str = "item") -> str:
        # Prevenir secuencias de traversal y caracteres prohibidos en sistemas de archivos
        cleaned = re.sub(r'[\\/*?:"<>|]', '_', seg).strip().strip('.')
        cleaned = re.sub(r'^\.+', '', cleaned).strip()
        return cleaned if cleaned else fallback

    def get_full_folder_path(fid: Optional[str]) -> str:
        if not fid or fid not in folder_map:
            return "Sin clasificar"
        parts = []
        curr = fid
        visited = set()
        while curr and curr in folder_map and curr not in visited and len(visited) < 50:
            visited.add(curr)
            safe_name = sanitize_path_segment(folder_map[curr]["name"], fallback="Carpeta")
            parts.append(safe_name)
            curr = folder_map[curr]["parent_id"]
        parts.reverse()
        return "/".join(parts) if parts else "Sin clasificar"

    # 2. Obtener todos los reels (límite de seguridad de 1000 fichas para mitigar DoS en memoria)
    cursor = await db.execute(f"{BASE_REEL_SELECT} ORDER BY r.created_at DESC LIMIT 1000")
    reel_rows = await cursor.fetchall()
    reels = [format_reel_row(row) for row in reel_rows]

    # 3. Empaquetar en ZIP en memoria con protección anti Zip-Slip
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        index_lines = [
            "# 🧠 Bóveda de Conocimiento ReelMind - Obsidian Export",
            f"Exportado el: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"Total de recursos guardados: {len(reels)}\n",
            "## 📑 Índice de Recursos por Carpeta\n"
        ]

        seen_filenames = set()

        for reel in reels:
            folder_path = get_full_folder_path(reel.get("folder_id"))
            clean_title = sanitize_path_segment(reel.get("title", "Recurso")[:70], fallback="Recurso")
            file_base = f"{clean_title}.md"
            
            raw_path = f"{folder_path}/{file_base}"
            # Normalizar para garantizar que no haya escape de ruta (Zip Slip / CWE-22)
            safe_zip_path = os.path.normpath(raw_path).replace("\\", "/")
            safe_zip_path = re.sub(r'^(\.\./|\./|/)+', '', safe_zip_path)
            if not safe_zip_path:
                safe_zip_path = f"Recursos/{file_base}"
            
            counter = 1
            unique_path = safe_zip_path
            while unique_path in seen_filenames:
                unique_path = f"{folder_path}/{clean_title}_{counter}.md"
                unique_path = os.path.normpath(unique_path).replace("\\", "/")
                unique_path = re.sub(r'^(\.\./|\./|/)+', '', unique_path)
                counter += 1
            seen_filenames.add(unique_path)

            md_content = generate_reel_markdown(reel)
            zf.writestr(unique_path, md_content.encode("utf-8"))

            index_lines.append(f"- [[{unique_path}|{reel.get('title')}]] ({reel.get('platform')}, {reel.get('difficulty')}, {reel.get('estimated_time')})")

        # Guardar índice en la raíz del zip
        zf.writestr("Indice_Boveda.md", "\n".join(index_lines).encode("utf-8"))

    zip_buffer.seek(0)
    zip_data = zip_buffer.getvalue()

    now_str = datetime.datetime.now().strftime("%Y%m%d_%H%M")
    return Response(
        content=zip_data,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="ReelMind_Boveda_{now_str}.zip"'}
    )

@app.post("/api/prompts/optimize", response_model=PromptOptimizeResponse, dependencies=[Depends(require_auth)])
async def optimize_prompt(request: PromptOptimizeRequest):
    if not request.prompt.strip():
        raise HTTPException(status_code=400, detail="El prompt no puede estar vacío.")

    api_key = await get_active_api_key()
    if not api_key:
        raise HTTPException(status_code=400, detail="Falta configurar la Gemini API Key.")

    async with ai_task_semaphore:
        try:
            result = await optimize_prompt_with_gemini(
                prompt=request.prompt.strip(),
                mode=request.mode,
                target_model=request.target_model,
                api_key=api_key,
                model_name=settings.GEMINI_MODEL
            )
            return result
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error optimizando prompt con Gemini: {str(e)}")

@app.post("/api/vault/ask", response_model=VaultAskResponse, dependencies=[Depends(require_auth)])
async def ask_vault(request: VaultAskRequest, db: aiosqlite.Connection = Depends(get_db)):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="La pregunta no puede estar vacía.")

    api_key = await get_active_api_key()
    if not api_key:
        raise HTTPException(status_code=400, detail="Falta configurar la Gemini API Key.")

    cursor = await db.execute(f"{BASE_REEL_SELECT} ORDER BY r.created_at DESC LIMIT 120")
    rows = await cursor.fetchall()
    reels = [format_reel_row(row) for row in rows]

    async with ai_task_semaphore:
        try:
            result = await ask_vault_with_gemini(
                question=request.question.strip(),
                vault_items=reels,
                api_key=api_key,
                model_name=settings.GEMINI_MODEL
            )
            return result
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error consultando a la Bóveda con Gemini: {str(e)}")

@app.get("/api/images/{filename}")
async def get_stored_image(filename: str):
    safe_name = os.path.basename(filename)
    if not re.match(r'^[a-zA-Z0-9_\-\.]+$', safe_name):
        raise HTTPException(status_code=400, detail="Nombre de archivo no válido")
    filepath = os.path.join(settings.DATA_DIR, "images", safe_name)
    if not os.path.isfile(filepath):
        raise HTTPException(status_code=404, detail="Imagen no encontrada")
    ext = os.path.splitext(safe_name)[1].lower()
    mime = "image/png" if ext == ".png" else ("image/webp" if ext == ".webp" else ("image/gif" if ext == ".gif" else "image/jpeg"))
    response = FileResponse(filepath, media_type=mime)
    response.headers["Cache-Control"] = "public, max-age=604800, immutable"
    return response

@app.post("/api/upload-image", dependencies=[Depends(require_auth)])
async def upload_image(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos de imagen (.png, .jpg, .webp).")
    
    ext = "jpg"
    if "png" in file.content_type:
        ext = "png"
    elif "webp" in file.content_type:
        ext = "webp"
    elif "gif" in file.content_type:
        ext = "gif"

    img_id = str(uuid.uuid4())
    images_dir = os.path.join(settings.DATA_DIR, "images")
    os.makedirs(images_dir, exist_ok=True)
    dest_path = os.path.join(images_dir, f"{img_id}.{ext}")

    content = await file.read()
    if len(content) > settings.MAX_FILESIZE_BYTES:
        raise HTTPException(status_code=400, detail="La imagen supera el límite permitido de 50 MB.")

    with open(dest_path, "wb") as f:
        f.write(content)

    return {
        "url": f"/api/images/{img_id}.{ext}",
        "filename": f"{img_id}.{ext}",
        "preview_url": f"/api/images/{img_id}.{ext}"
    }

# Servir frontend estático en producción con encabezados de caché para máximo rendimiento
candidates = [
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "dist"),
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "frontend", "dist")
]
frontend_dist = next((c for c in candidates if os.path.exists(c)), None)
if frontend_dist:
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            response = FileResponse(file_path)
            if full_path.startswith("assets/"):
                response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
            elif full_path == "index.html" or full_path == "":
                response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            return response
        index_res = FileResponse(os.path.join(frontend_dist, "index.html"))
        index_res.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        return index_res
