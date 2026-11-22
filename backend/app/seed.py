import sys
import os
import json
import uuid
import datetime
import argparse
import sqlite3

# Resolver directorio de datos y base de datos sin dependencias externas obligatorias
DATA_DIR = os.getenv("DATA_DIR", os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data")))
DB_PATH = os.path.join(DATA_DIR, "reelmind.db")

DEMO_FOLDERS = [
    {
        "id": "f_dev",
        "name": "Programación & Web",
        "parent_id": None,
        "icon": "💻",
        "color": "#3b82f6",
        "subfolders": [
            {
                "id": "f_dev_prototypes",
                "name": "Full-Stack & Prototipos",
                "icon": "⚡",
                "color": "#06b6d4"
            },
            {
                "id": "f_dev_agents",
                "name": "Agentes Autónomos & CLI",
                "icon": "🤖",
                "color": "#6366f1"
            }
        ]
    },
    {
        "id": "f_media",
        "name": "Diseño & Multimedia",
        "parent_id": None,
        "icon": "🎨",
        "color": "#ec4899",
        "subfolders": [
            {
                "id": "f_media_video",
                "name": "Vídeo & Animación",
                "icon": "🎬",
                "color": "#f43f5e"
            },
            {
                "id": "f_media_images",
                "name": "Generación de Imágenes",
                "icon": "🖼️",
                "color": "#d946ef"
            }
        ]
    },
    {
        "id": "f_automation",
        "name": "Automatización",
        "parent_id": None,
        "icon": "⚙️",
        "color": "#10b981",
        "subfolders": [
            {
                "id": "f_auto_n8n",
                "name": "Flujos n8n & No-Code",
                "icon": "🔄",
                "color": "#059669"
            }
        ]
    }
]

DEMO_REELS = [
    {
        "url": "https://www.tiktok.com/@ai.creators/video/example1",
        "platform": "tiktok",
        "author": "TechInnovators",
        "author_url": "https://www.tiktok.com/@ai.creators",
        "original_title": "Crea una web completa en 2 minutos con este nuevo truco de IA",
        "thumbnail_url": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=60",
        "duration": 58,
        "title": "Desarrollo Full-Stack instantáneo con Bolt.new y Supabase",
        "summary": "Muestra cómo generar una aplicación web completa con autenticación y base de datos en tiempo real describiendo los requisitos en lenguaje natural mediante Bolt.new.",
        "ai_tools": ["Bolt.new", "Supabase", "Claude 3.7 Sonnet"],
        "key_steps": [
            "Acceder a bolt.new y seleccionar el stack Vite + React.",
            "Describir la interfaz deseada indicando componentes modulares y diseño Tailwind.",
            "Conectar el proyecto con el botón 'Connect to Supabase' para provisionar auth y base de datos.",
            "Desplegar con 1 clic en Netlify desde la misma interfaz."
        ],
        "prompts": [
            "Crea una aplicación de gestión de presupuestos personales con tarjetas de gastos, selector de categorías y gráfico de barras mensual. Usa Tailwind CSS con tema oscuro."
        ],
        "tags": ["programacion", "desarrollo", "web", "productividad"],
        "difficulty": "Principiante",
        "status": "favorite",
        "user_notes": "Probado y funciona excelente para prototipos rápidos.",
        "folder_id": "f_dev_prototypes"
    },
    {
        "url": "https://www.instagram.com/reel/example2",
        "platform": "instagram",
        "author": "AI_Mastery",
        "author_url": "https://www.instagram.com/ai_mastery",
        "original_title": "El mejor workflow para crear vídeos realistas que no parecen generados por IA",
        "thumbnail_url": "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&auto=format&fit=crop&q=60",
        "duration": 45,
        "title": "Generación de vídeo cinematográfico con Midjourney v6 + Kling AI",
        "summary": "Flujo de trabajo para obtener tomas de vídeo con movimiento natural y consistencia de cámara combinando prompts fotográficos y animación por imagen clave.",
        "ai_tools": ["Midjourney v6", "Kling AI", "Topaz Video AI"],
        "key_steps": [
            "Generar la imagen base en Midjourney especificando lentes anamórficos y luz natural.",
            "Importar la imagen en Kling AI en modo 'Image to Video'.",
            "Configurar el prompt de movimiento de cámara con 'slow push in' y movimiento 5.",
            "Escalar a 4K 60fps con Topaz Video AI."
        ],
        "prompts": [
            "/imagine cinematic medium shot of a cybernetic botanist in a bioluminescent greenhouse, shot on 35mm lens, depth of field, kodak portra 400 --ar 16:9 --style raw --v 6.0"
        ],
        "tags": ["video", "diseño", "cinematografia", "arte"],
        "difficulty": "Intermedio",
        "status": "pending",
        "user_notes": "Pendiente de probar con la versión gratuita de Kling.",
        "folder_id": "f_media_video"
    },
    {
        "url": "https://www.youtube.com/shorts/example3",
        "platform": "youtube",
        "author": "AutomatizaConIA",
        "author_url": "https://www.youtube.com/@automatizaconia",
        "original_title": "Tuve que despedir a mi asistente virtual después de montar esto con n8n",
        "thumbnail_url": "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=60",
        "duration": 60,
        "title": "Agente autónomo de lectura y clasificación de emails con n8n y Gemini",
        "summary": "Automatización self-hosted que escucha emails entrantes, los clasifica por prioridad y redacta borradores de respuesta automáticos respetando el tono de la empresa.",
        "ai_tools": ["n8n", "Gemini 2.5 Flash", "Gmail API"],
        "key_steps": [
            "Crear un webhook en n8n con el nodo 'Gmail Trigger' para emails no leídos.",
            "Enviar el cuerpo del correo al nodo de IA conectándolo con Gemini Flash.",
            "Clasificar en: Urgente, Informativo o Spam.",
            "Si es urgente, crear un borrador en Gmail con la respuesta sugerida y enviar alerta por Telegram."
        ],
        "prompts": [
            "Analiza el siguiente correo electrónico recibido. Determina la urgencia del 1 al 5. Si la urgencia es >= 4, redacta una respuesta formal pero cercana confirmando que hemos recibido su petición y solicitando los datos faltantes."
        ],
        "tags": ["automatizacion", "productividad", "agentes", "n8n"],
        "difficulty": "Avanzado",
        "status": "tested",
        "user_notes": "Montado en Docker local, funciona a la perfección.",
        "folder_id": "f_auto_n8n"
    },
    {
        "url": "https://www.youtube.com/shorts/example4",
        "platform": "youtube",
        "author": "DevAgentLab",
        "author_url": "https://www.youtube.com/@devagentlab",
        "original_title": "Cómo convertir tu terminal en un equipo de ingenieros senior con Claude Code",
        "thumbnail_url": "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=60",
        "duration": 52,
        "title": "Ingeniería de software autónoma con Claude Code CLI",
        "summary": "Guía práctica para configurar la CLI de Claude Code, vincular herramientas locales y permitir que el agente investigue bugs, edite código y ejecute tests de forma desatendida.",
        "ai_tools": ["Claude Code", "Anthropic CLI", "Git"],
        "key_steps": [
            "Instalar la herramienta oficial via npm install -g @anthropic-ai/claude-code.",
            "Autenticar con clave de API o suscripción Pro.",
            "Iniciar una sesión interactiva en la raíz del repositorio con el comando claude.",
            "Solicitar refactorizaciones complejas especificando que ejecute la suite de tests antes de confirmar cambios."
        ],
        "prompts": [
            "claude 'Investiga los tests fallidos en tests/test_api.py, corrige los edge cases en la validación de URLs y ejecuta pytest para verificar que todos pasen.'"
        ],
        "tags": ["programacion", "claude", "cli", "desarrollo", "agentes"],
        "difficulty": "Intermedio",
        "status": "favorite",
        "user_notes": "Imprescindible para agilizar revisiones de código y refactorizaciones.",
        "folder_id": "f_dev_agents"
    },
    {
        "url": "https://www.instagram.com/reel/example5",
        "platform": "instagram",
        "author": "VisualPrompters",
        "author_url": "https://www.instagram.com/visualprompters",
        "original_title": "El prompt secreto para conseguir hiperrealismo absoluto en Flux 1.1 Pro",
        "thumbnail_url": "https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=60",
        "duration": 38,
        "title": "Fotografía hiperrealista con Flux 1.1 Pro y ComfyUI",
        "summary": "Técnica para estructurar prompts con iluminación física, aberraciones cromáticas y texturas orgánicas en Flux 1.1 Pro sin el aspecto plástico de otros generadores.",
        "ai_tools": ["Flux 1.1 Pro", "ComfyUI", "BFL API"],
        "key_steps": [
            "Configurar el nodo KSampler en ComfyUI con 28 steps y scheduler Euler simple.",
            "Evitar palabras comodín cliché como '8k, hyperrealistic' y describir propiedades ópticas reales.",
            "Definir iluminación volumétrica y grano de película sutil (Kodak Portra 160).",
            "Aplicar upscale latente x1.5 para microtextura de piel y materiales."
        ],
        "prompts": [
            "street photography candid portrait of an elderly craftsman repairing a mechanical watch, natural morning light streaming through a workshop window, dust motes in air, 85mm f/1.4 lens, shallow depth of field, authentic film grain, high dynamic range --ar 4:5"
        ],
        "tags": ["diseño", "fotografia", "flux", "ia-visual", "prompts"],
        "difficulty": "Intermedio",
        "status": "pending",
        "user_notes": "Excelente fórmula para retratos con texturas de piel realistas.",
        "folder_id": "f_media_images"
    }
]

def init_tables_sync(conn: sqlite3.Connection):
    """Garantiza la creación de las tablas si aún no han sido creadas."""
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")

    conn.execute("""
        CREATE TABLE IF NOT EXISTS folders (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            parent_id TEXT,
            icon TEXT DEFAULT '📁',
            color TEXT DEFAULT '#8b5cf6',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
        );
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS reels (
            id TEXT PRIMARY KEY,
            url TEXT UNIQUE NOT NULL,
            platform TEXT NOT NULL,
            author TEXT,
            author_url TEXT,
            original_title TEXT,
            thumbnail_url TEXT,
            duration INTEGER DEFAULT 0,
            title TEXT NOT NULL,
            summary TEXT NOT NULL,
            ai_tools TEXT NOT NULL DEFAULT '[]',
            key_steps TEXT NOT NULL DEFAULT '[]',
            prompts TEXT NOT NULL DEFAULT '[]',
            tags TEXT NOT NULL DEFAULT '[]',
            difficulty TEXT DEFAULT 'Intermedio',
            status TEXT DEFAULT 'pending',
            user_notes TEXT DEFAULT '',
            folder_id TEXT,
            media_type TEXT DEFAULT 'reel',
            images TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
        );
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    """)

def seed(force: bool = False, db_path: str = DB_PATH):
    """Puebla la base de datos SQLite con datos de prueba realistas."""
    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
    conn = sqlite3.connect(db_path)
    try:
        init_tables_sync(conn)
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()

        if force:
            print("Limpiando datos de demostración anteriores (--force)...")
            conn.execute("DELETE FROM reels WHERE url LIKE '%example%'")
            demo_folder_ids = ["f_dev", "f_dev_prototypes", "f_dev_agents", "f_media", "f_media_video", "f_media_images", "f_automation", "f_auto_n8n"]
            for fid in demo_folder_ids:
                conn.execute("DELETE FROM folders WHERE id = ?", (fid,))
            conn.commit()

        # Sembrar carpetas si no existen
        cursor = conn.execute("SELECT COUNT(*) FROM folders")
        folders_count = cursor.fetchone()[0]

        if folders_count == 0 or force:
            for parent in DEMO_FOLDERS:
                conn.execute(
                    """
                    INSERT OR IGNORE INTO folders (id, name, parent_id, icon, color, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (parent["id"], parent["name"], None, parent["icon"], parent["color"], now, now)
                )
                for sub in parent.get("subfolders", []):
                    conn.execute(
                        """
                        INSERT OR IGNORE INTO folders (id, name, parent_id, icon, color, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        """,
                        (sub["id"], sub["name"], parent["id"], sub["icon"], sub["color"], now, now)
                    )
            conn.commit()
            print("✓ Carpetas y subcarpetas sembradas.")

        # Sembrar reels demo
        inserted = 0
        for r in DEMO_REELS:
            cursor = conn.execute("SELECT id FROM reels WHERE url = ?", (r["url"],))
            if not cursor.fetchone():
                reel_id = str(uuid.uuid4())
                conn.execute(
                    """
                    INSERT INTO reels (
                        id, url, platform, author, author_url, original_title, thumbnail_url,
                        duration, title, summary, ai_tools, key_steps, prompts, tags,
                        difficulty, status, user_notes, folder_id, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        reel_id,
                        r["url"],
                        r["platform"],
                        r["author"],
                        r["author_url"],
                        r["original_title"],
                        r["thumbnail_url"],
                        r["duration"],
                        r["title"],
                        r["summary"],
                        json.dumps(r["ai_tools"], ensure_ascii=False),
                        json.dumps(r["key_steps"], ensure_ascii=False),
                        json.dumps(r["prompts"], ensure_ascii=False),
                        json.dumps(r["tags"], ensure_ascii=False),
                        r["difficulty"],
                        r["status"],
                        r["user_notes"],
                        r.get("folder_id"),
                        now,
                        now,
                    )
                )
                inserted += 1

        conn.commit()
        if inserted > 0:
            print(f"✓ {inserted} reels de demostración añadidos exitosamente en: {db_path}")
        else:
            print(f"✓ Los datos de demostración ya están presentes en: {db_path}")
    finally:
        conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Poblar ReelMind con datos de demostración")
    parser.add_argument("--force", action="store_true", help="Recrear datos demo eliminando versiones previas")
    parser.add_argument("--db", type=str, default=DB_PATH, help="Ruta personalizada al archivo SQLite (reelmind.db)")
    args = parser.parse_args()

    seed(force=args.force, db_path=args.db)
