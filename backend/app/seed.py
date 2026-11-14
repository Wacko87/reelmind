import json
import uuid
import datetime
import aiosqlite

try:
    from .database import DB_PATH, init_db
except ImportError:
    from app.database import DB_PATH, init_db

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
                "name": "Agentes Autónomos",
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
        "user_notes": "Probado y funciona de locos para prototipos rápidos.",
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
        "user_notes": "Montado en Docker en Unraid, funciona a la perfección.",
        "folder_id": "f_auto_n8n"
    }
]

async def seed_data():
    await init_db()
    async with aiosqlite.connect(DB_PATH) as db:
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()

        # Sembrar carpetas si no existen
        cursor = await db.execute("SELECT COUNT(*) as count FROM folders")
        row = await cursor.fetchone()
        if row[0] == 0:
            for parent in DEMO_FOLDERS:
                await db.execute(
                    """
                    INSERT INTO folders (id, name, parent_id, icon, color, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (parent["id"], parent["name"], None, parent["icon"], parent["color"], now, now)
                )
                for sub in parent.get("subfolders", []):
                    await db.execute(
                        """
                        INSERT INTO folders (id, name, parent_id, icon, color, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        """,
                        (sub["id"], sub["name"], parent["id"], sub["icon"], sub["color"], now, now)
                    )
            await db.commit()
            print("Carpetas y subcarpetas sembradas.")

        # Sembrar o actualizar reels
        cursor = await db.execute("SELECT COUNT(*) as count FROM reels")
        row = await cursor.fetchone()
        if row[0] == 0:
            for r in DEMO_REELS:
                reel_id = str(uuid.uuid4())
                await db.execute(
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
            await db.commit()
            print("Reels sembrados con asignación de carpetas.")
        else:
            # Asignar carpetas a los reels existentes de demostración si estaban en null
            await db.execute("UPDATE reels SET folder_id = 'f_dev_prototypes' WHERE url LIKE '%example1%' AND folder_id IS NULL")
            await db.execute("UPDATE reels SET folder_id = 'f_media_video' WHERE url LIKE '%example2%' AND folder_id IS NULL")
            await db.execute("UPDATE reels SET folder_id = 'f_auto_n8n' WHERE url LIKE '%example3%' AND folder_id IS NULL")
            await db.commit()

if __name__ == "__main__":
    import asyncio
    asyncio.run(seed_data())
