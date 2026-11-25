#!/usr/bin/env python3
"""
ReelMind Multi-User Management CLI
=================================
Permite gestionar los usuarios, amigos y permisos de acceso al servidor ReelMind.

Uso:
  python3 -m app.manage_users list
  python3 -m app.manage_users add <username> <pin> [--admin]
  python3 -m app.manage_users delete <username>
  python3 -m app.manage_users set-pin <username> <new_pin>
"""

import os
import sys
import uuid
import asyncio
from datetime import datetime, timezone

# Asegurar que el directorio raíz del backend esté en sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import aiosqlite
from app.config import settings
from app.database import get_connection, init_db
from app.security import hash_pin

async def list_users():
    await init_db()
    db = await get_connection()
    try:
        cursor = await db.execute("""
            SELECT u.id, u.username, u.is_admin, u.created_at, COUNT(r.id) as reel_count
            FROM users u
            LEFT JOIN reels r ON r.user_id = u.id
            GROUP BY u.id
            ORDER BY u.created_at ASC;
        """)
        rows = await cursor.fetchall()
        print("\n👥 Usuarios registrados en ReelMind:")
        print("------------------------------------------------------------")
        print(f"{'USUARIO':<20} {'ROL':<12} {'REELS':<8} {'FECHA CREACIÓN'}")
        print("------------------------------------------------------------")
        for r in rows:
            role = "⭐ Admin" if r["is_admin"] else "👤 Usuario"
            print(f"{r['username']:<20} {role:<12} {r['reel_count']:<8} {r['created_at'][:19]}")
        print("------------------------------------------------------------\n")
    finally:
        await db.close()

async def add_user(username: str, pin: str, is_admin: bool = False):
    clean_username = username.strip().lower()
    clean_pin = pin.strip()
    if len(clean_pin) < 4:
        print("❌ Error: El PIN debe tener al menos 4 caracteres.")
        sys.exit(1)

    await init_db()
    db = await get_connection()
    try:
        cursor = await db.execute("SELECT id FROM users WHERE username = ?;", (clean_username,))
        if await cursor.fetchone():
            print(f"❌ Error: El usuario '{clean_username}' ya existe.")
            sys.exit(1)

        user_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        pin_hashed = hash_pin(clean_pin)

        await db.execute(
            "INSERT INTO users (id, username, pin_hash, is_admin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?);",
            (user_id, clean_username, pin_hashed, 1 if is_admin else 0, now, now)
        )
        await db.commit()
        role = "Administrador" if is_admin else "Usuario normal"
        print(f"✅ Usuario '{clean_username}' creado con éxito ({role}). PIN configurado correctamente.")
    finally:
        await db.close()

async def delete_user(username: str):
    clean_username = username.strip().lower()
    if clean_username in ("admin", "root"):
        print("❌ Error: No se puede eliminar el usuario administrador principal.")
        sys.exit(1)

    await init_db()
    db = await get_connection()
    try:
        cursor = await db.execute("SELECT id FROM users WHERE username = ?;", (clean_username,))
        row = await cursor.fetchone()
        if not row:
            print(f"❌ Error: El usuario '{clean_username}' no existe.")
            sys.exit(1)

        user_id = row["id"]
        # Eliminar reels y carpetas de este usuario
        await db.execute("DELETE FROM reels WHERE user_id = ?;", (user_id,))
        await db.execute("DELETE FROM folders WHERE user_id = ?;", (user_id,))
        await db.execute("DELETE FROM users WHERE id = ?;", (user_id,))
        await db.commit()
        print(f"🗑️ Usuario '{clean_username}' y todos sus reels eliminados con éxito.")
    finally:
        await db.close()

async def set_pin(username: str, new_pin: str):
    clean_username = username.strip().lower()
    clean_pin = new_pin.strip()
    if len(clean_pin) < 4:
        print("❌ Error: El PIN debe tener al menos 4 caracteres.")
        sys.exit(1)

    await init_db()
    db = await get_connection()
    try:
        cursor = await db.execute("SELECT id FROM users WHERE username = ?;", (clean_username,))
        row = await cursor.fetchone()
        if not row:
            print(f"❌ Error: El usuario '{clean_username}' no existe.")
            sys.exit(1)

        now = datetime.now(timezone.utc).isoformat()
        pin_hashed = hash_pin(clean_pin)
        await db.execute(
            "UPDATE users SET pin_hash = ?, updated_at = ? WHERE id = ?;",
            (pin_hashed, now, row["id"])
        )
        await db.commit()
        print(f"🔒 PIN de '{clean_username}' actualizado con éxito.")
    finally:
        await db.close()

async def list_orgs():
    await init_db()
    db = await get_connection()
    try:
        cursor = await db.execute("""
            SELECT o.id, o.name, o.slug, u.username as owner,
                   (SELECT COUNT(*) FROM organization_members WHERE org_id = o.id) as members,
                   (SELECT COUNT(*) FROM reels WHERE org_id = o.id) as reels,
                   o.created_at
            FROM organizations o
            LEFT JOIN users u ON u.id = o.owner_id
            ORDER BY o.created_at ASC;
        """)
        rows = await cursor.fetchall()
        print("\n🏢 Organizaciones registradas en ReelMind:")
        print("----------------------------------------------------------------------")
        print(f"{'NOMBRE':<25} {'OWNER':<15} {'MIEMBROS':<10} {'REELS':<8} {'CREACIÓN'}")
        print("----------------------------------------------------------------------")
        for r in rows:
            print(f"{r['name']:<25} {r['owner'] or 'Desconocido':<15} {r['members']:<10} {r['reels']:<8} {r['created_at'][:19]}")
        print("----------------------------------------------------------------------\n")
    finally:
        await db.close()

def main():
    if len(sys.argv) < 2:
        print("Uso: python3 -m app.manage_users [list | list-orgs | add <user> <pin> [--admin] | delete <user> | set-pin <user> <pin>]")
        sys.exit(1)

    cmd = sys.argv[1].lower()
    if cmd == "list":
        asyncio.run(list_users())
    elif cmd in ("list-orgs", "orgs"):
        asyncio.run(list_orgs())
    elif cmd == "add":
        if len(sys.argv) < 4:
            print("Uso: python3 -m app.manage_users add <username> <pin> [--admin]")
            sys.exit(1)
        username = sys.argv[2]
        pin = sys.argv[3]
        is_admin = "--admin" in sys.argv
        asyncio.run(add_user(username, pin, is_admin))
    elif cmd == "delete":
        if len(sys.argv) < 3:
            print("Uso: python3 -m app.manage_users delete <username>")
            sys.exit(1)
        asyncio.run(delete_user(sys.argv[2]))
    elif cmd == "set-pin":
        if len(sys.argv) < 4:
            print("Uso: python3 -m app.manage_users set-pin <username> <new_pin>")
            sys.exit(1)
        asyncio.run(set_pin(sys.argv[2], sys.argv[3]))
    else:
        print(f"Comando desconocido '{cmd}'. Usa: list, list-orgs, add, delete, set-pin")
        sys.exit(1)

if __name__ == "__main__":
    main()
