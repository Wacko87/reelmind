import os
import aiosqlite
from .config import settings

DB_PATH = os.path.join(settings.DATA_DIR, "reelmind.db")

async def get_connection() -> aiosqlite.Connection:
    """Abre una conexión con todas las PRAGMAs críticas de concurrencia, memoria y velocidad configuradas."""
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA foreign_keys=ON;")
    await db.execute("PRAGMA busy_timeout=5000;")
    await db.execute("PRAGMA synchronous=NORMAL;")
    await db.execute("PRAGMA temp_store=MEMORY;")
    await db.execute("PRAGMA mmap_size=268435456;")  # 256MB memory-mapped I/O
    return db

async def get_db():
    db = await get_connection()
    try:
        yield db
    finally:
        await db.close()

async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        # Optimizaciones de alto rendimiento para SQLite en homelab
        await db.execute("PRAGMA journal_mode=WAL;")
        await db.execute("PRAGMA synchronous=NORMAL;") # 3x más rápido en WAL con total seguridad
        await db.execute("PRAGMA cache_size=-64000;")  # 64MB de caché en memoria RAM
        await db.execute("PRAGMA foreign_keys=ON;")
        await db.execute("PRAGMA busy_timeout=5000;")
        
        # Tabla de carpetas jerárquicas
        await db.execute("""
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

        # Tabla de reels
        await db.execute("""
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

        # Migraciones: asegurar que las columnas existan en la tabla reels si ya estaba creada
        cursor = await db.execute("PRAGMA table_info(reels);")
        columns = [row[1] for row in await cursor.fetchall()]
        if "folder_id" not in columns:
            await db.execute("ALTER TABLE reels ADD COLUMN folder_id TEXT;")
        if "media_type" not in columns:
            await db.execute("ALTER TABLE reels ADD COLUMN media_type TEXT DEFAULT 'reel';")
            # Auto-clasificar vídeos existentes que duren más de 10 minutos
            await db.execute("UPDATE reels SET media_type = 'video' WHERE duration > 600;")
        if "estimated_time" not in columns:
            await db.execute("ALTER TABLE reels ADD COLUMN estimated_time TEXT DEFAULT '15-30 min';")
        if "images" not in columns:
            await db.execute("ALTER TABLE reels ADD COLUMN images TEXT DEFAULT '[]';")

        # Normalizar URLs con www a dominio canónico para asegurar detección infalible de duplicados
        await db.execute("UPDATE reels SET url = REPLACE(url, '://www.', '://') WHERE url LIKE '%://www.%';")

        # Índices de alto rendimiento para acelerar listados y consultas jerárquicas
        await db.execute("CREATE INDEX IF NOT EXISTS idx_reels_folder_id ON reels(folder_id);")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_reels_media_type ON reels(media_type);")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_reels_status ON reels(status);")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_reels_created_at ON reels(created_at DESC);")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_reels_folder_created ON reels(folder_id, created_at DESC);")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_reels_media_created ON reels(media_type, created_at DESC);")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_reels_estimated_time ON reels(estimated_time);")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);")

        # Tabla de configuraciones
        await db.execute("""
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
        """)
        await db.commit()
