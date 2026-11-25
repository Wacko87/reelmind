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
        
        # Tabla de usuarios
        await db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                pin_hash TEXT NOT NULL,
                is_admin INTEGER DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        """)

        # Tabla de organizaciones (espacios de trabajo compartidos estilo GitHub)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS organizations (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                description TEXT DEFAULT '',
                owner_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)

        # Miembros de la organización y sus roles (owner, admin, member)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS organization_members (
                id TEXT PRIMARY KEY,
                org_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'member',
                created_at TEXT NOT NULL,
                UNIQUE(org_id, user_id),
                FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)

        # Tabla de carpetas jerárquicas
        await db.execute("""
            CREATE TABLE IF NOT EXISTS folders (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                parent_id TEXT,
                icon TEXT DEFAULT '📁',
                color TEXT DEFAULT '#8b5cf6',
                user_id TEXT DEFAULT 'admin',
                org_id TEXT DEFAULT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE,
                FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
            );
        """)

        # Tabla de reels
        await db.execute("""
            CREATE TABLE IF NOT EXISTS reels (
                id TEXT PRIMARY KEY,
                url TEXT NOT NULL,
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
                user_id TEXT DEFAULT 'admin',
                org_id TEXT DEFAULT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL,
                FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
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
        if "user_id" not in columns:
            await db.execute("ALTER TABLE reels ADD COLUMN user_id TEXT DEFAULT 'admin';")
        if "org_id" not in columns:
            await db.execute("ALTER TABLE reels ADD COLUMN org_id TEXT DEFAULT NULL;")

        cursor_f = await db.execute("PRAGMA table_info(folders);")
        f_columns = [row[1] for row in await cursor_f.fetchall()]
        if "user_id" not in f_columns:
            await db.execute("ALTER TABLE folders ADD COLUMN user_id TEXT DEFAULT 'admin';")
        if "org_id" not in f_columns:
            await db.execute("ALTER TABLE folders ADD COLUMN org_id TEXT DEFAULT NULL;")

        # Asegurar usuario administrador por defecto
        cursor_u = await db.execute("SELECT id FROM users WHERE username = 'admin' OR id = 'admin';")
        admin_row = await cursor_u.fetchone()
        if not admin_row:
            from datetime import datetime, timezone
            from .security import hash_pin
            now_iso = datetime.now(timezone.utc).isoformat()
            default_pin = settings.AUTH_PIN or "3004"
            hashed = hash_pin(default_pin)
            await db.execute(
                "INSERT INTO users (id, username, pin_hash, is_admin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?);",
                ("admin", "admin", hashed, 1, now_iso, now_iso)
            )

        # Migrar datos existentes huérfanos al usuario admin
        await db.execute("UPDATE reels SET user_id = 'admin' WHERE user_id IS NULL OR user_id = '';")
        await db.execute("UPDATE folders SET user_id = 'admin' WHERE user_id IS NULL OR user_id = '';")

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
        await db.execute("CREATE INDEX IF NOT EXISTS idx_reels_user_id ON reels(user_id);")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_reels_user_created ON reels(user_id, created_at DESC);")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_reels_user_url ON reels(user_id, url);")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);")

        # Índices para organizaciones y colaboración en equipo
        await db.execute("CREATE INDEX IF NOT EXISTS idx_reels_org_id ON reels(org_id);")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_reels_org_created ON reels(org_id, created_at DESC);")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_folders_org_id ON folders(org_id);")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(org_id);")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);")

        # Tabla de configuraciones
        await db.execute("""
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
        """)
        await db.commit()
