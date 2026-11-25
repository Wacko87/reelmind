import asyncio
import os
import sys
import tempfile
import aiosqlite
from httpx import AsyncClient, ASGITransport

backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

test_db_dir = tempfile.mkdtemp()
test_db_path = os.path.join(test_db_dir, "test_reelmind.db")
os.environ["DATA_DIR"] = test_db_dir
os.environ["AUTH_PIN"] = "3004"
os.environ["SECRET_KEY"] = "test_secret_key_multiuser_12345"

from app.config import settings
settings.DATA_DIR = test_db_dir
settings.AUTH_PIN = "3004"
settings.SECRET_KEY = "test_secret_key_multiuser_12345"

import app.database
app.database.DB_PATH = test_db_path

from app.database import init_db, get_connection
from app.main import app

async def run_suite():
    await init_db()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Test Admin Login with PIN 3004
        res = await client.post("/api/auth/login", json={"pin": "3004"})
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["success"] is True
        assert data["username"] == "admin"
        assert data["is_admin"] is True
        admin_token = data["token"]
        print("  ✓ Paso 1: Login de Administrador con PIN '3004' validado.")

        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        # 2. Check Auth Status as Admin
        res_status = await client.get("/api/auth/status", headers=admin_headers)
        assert res_status.status_code == 200
        status_data = res_status.json()
        assert status_data["is_authenticated"] is True
        assert status_data["username"] == "admin"
        assert status_data["is_admin"] is True
        print("  ✓ Paso 2: Endpoint /api/auth/status reconoce rol admin.")

        # 3. Create a New User (Carlos - PIN 1234) as Admin
        res_create = await client.post(
            "/api/users",
            headers=admin_headers,
            json={"username": "carlos", "pin": "1234", "is_admin": False}
        )
        assert res_create.status_code == 200, res_create.text
        carlos_data = res_create.json()
        carlos_id = carlos_data["id"]
        assert carlos_data["username"] == "carlos"
        assert carlos_data["is_admin"] is False
        print(f"  ✓ Paso 3: Usuario 'carlos' creado exitosamente (ID: {carlos_id}).")

        # 4. List Users as Admin
        res_users = await client.get("/api/users", headers=admin_headers)
        assert res_users.status_code == 200
        user_list = res_users.json()
        assert len(user_list) >= 2
        usernames = [u["username"] for u in user_list]
        assert "admin" in usernames and "carlos" in usernames
        print(f"  ✓ Paso 4: Lista de usuarios consultada por admin: {usernames}.")

        # 5. Login as Carlos with his PIN
        res_login_carlos = await client.post("/api/auth/login", json={"pin": "1234"})
        assert res_login_carlos.status_code == 200
        carlos_auth = res_login_carlos.json()
        assert carlos_auth["username"] == "carlos"
        assert carlos_auth["is_admin"] is False
        carlos_token = carlos_auth["token"]
        carlos_headers = {"Authorization": f"Bearer {carlos_token}"}
        print("  ✓ Paso 5: Login de 'carlos' con su PIN personal '1234' exitoso.")

        # 6. Verify Carlos cannot access Admin routes
        res_forbidden = await client.get("/api/users", headers=carlos_headers)
        assert res_forbidden.status_code == 403
        res_forbidden_settings = await client.get("/api/settings", headers=carlos_headers)
        assert res_forbidden_settings.status_code == 403
        print("  ✓ Paso 6: Verificación RBAC: Carlos recibe 403 Forbidden en endpoints de admin.")

        # 7. Vault Isolation - Folders
        res_f_admin = await client.post("/api/folders", headers=admin_headers, json={"name": "Carpeta Privada Oscar"})
        assert res_f_admin.status_code == 200
        f_admin_id = res_f_admin.json()["id"]

        res_f_carlos = await client.post("/api/folders", headers=carlos_headers, json={"name": "Carpeta de Carlos"})
        assert res_f_carlos.status_code == 200

        # Carlos lists folders
        res_carlos_folders = await client.get("/api/folders", headers=carlos_headers)
        carlos_f_names = [f["name"] for f in res_carlos_folders.json()]
        assert "Carpeta de Carlos" in carlos_f_names
        assert "Carpeta Privada Oscar" not in carlos_f_names
        print("  ✓ Paso 7: Aislamiento de carpetas verificado: Carlos no puede ver carpetas de Oscar.")

        # 8. Vault Isolation - Reels
        async with aiosqlite.connect(test_db_path) as db:
            await db.execute(
                """
                INSERT INTO reels (id, user_id, url, platform, title, summary, created_at, updated_at)
                VALUES (?, ?, ?, 'instagram', ?, ?, datetime('now'), datetime('now'))
                """,
                ("reel-oscar-1", "admin", "https://instagram.com/reel/123", "Reel Secreto Oscar", "Resumen Oscar")
            )
            await db.execute(
                """
                INSERT INTO reels (id, user_id, url, platform, title, summary, created_at, updated_at)
                VALUES (?, ?, ?, 'instagram', ?, ?, datetime('now'), datetime('now'))
                """,
                ("reel-carlos-1", carlos_id, "https://instagram.com/reel/456", "Reel de Carlos", "Resumen Carlos")
            )
            await db.commit()

        # Admin lists reels
        res_admin_reels = await client.get("/api/reels", headers=admin_headers)
        admin_titles = [r["title"] for r in res_admin_reels.json()]
        assert "Reel Secreto Oscar" in admin_titles
        assert "Reel de Carlos" not in admin_titles

        # Carlos lists reels
        res_carlos_reels = await client.get("/api/reels", headers=carlos_headers)
        carlos_titles = [r["title"] for r in res_carlos_reels.json()]
        assert "Reel de Carlos" in carlos_titles
        assert "Reel Secreto Oscar" not in carlos_titles
        print("  ✓ Paso 8: Aislamiento total de Reels en /api/reels comprobado.")

        # 9. Verify Carlos cannot read or delete Oscar's reel by ID
        res_single_forbidden = await client.get("/api/reels/reel-oscar-1", headers=carlos_headers)
        assert res_single_forbidden.status_code == 404
        res_delete_forbidden = await client.delete("/api/reels/reel-oscar-1", headers=carlos_headers)
        assert res_delete_forbidden.status_code == 404
        print("  ✓ Paso 9: Carlos recibe 404 al intentar acceder/borrar un reel de Oscar.")

        # 10. Stats Isolation
        res_stats_carlos = await client.get("/api/stats", headers=carlos_headers)
        assert res_stats_carlos.status_code == 200
        stats = res_stats_carlos.json()
        assert stats["total"] == 1
        print("  ✓ Paso 10: Estadísticas (/api/stats) aisladas por usuario.")

        # 11. Self-Registration (Ana creates account directly from app)
        res_reg = await client.post(
            "/api/auth/register",
            json={"username": "ana", "pin": "4321"}
        )
        assert res_reg.status_code == 200, res_reg.text
        ana_auth = res_reg.json()
        assert ana_auth["success"] is True
        assert ana_auth["username"] == "ana"
        ana_token = ana_auth["token"]
        ana_headers = {"Authorization": f"Bearer {ana_token}"}
        print("  ✓ Paso 11: Auto-registro de 'ana' desde la app validado exitosamente.")

        # Re-registering 'ana' should fail
        res_reg_dup = await client.post(
            "/api/auth/register",
            json={"username": "ana", "pin": "9999"}
        )
        assert res_reg_dup.status_code == 400
        print("  ✓ Paso 12: Prevención de nombres de usuario duplicados comprobada.")

        # 13. Create Organization (Carlos creates 'Equipo AI')
        res_org = await client.post(
            "/api/orgs",
            headers=carlos_headers,
            json={"name": "Equipo AI", "description": "Proyectos conjuntos de vídeo con IA"}
        )
        assert res_org.status_code == 200, res_org.text
        org_data = res_org.json()
        org_id = org_data["id"]
        assert org_data["name"] == "Equipo AI"
        assert org_data["role"] == "owner"
        print(f"  ✓ Paso 13: Organización 'Equipo AI' creada por Carlos (ID: {org_id}).")

        # 14. Add Member (Carlos invites Ana to the Organization)
        res_invite = await client.post(
            f"/api/orgs/{org_id}/members",
            headers=carlos_headers,
            json={"username": "ana", "role": "member"}
        )
        assert res_invite.status_code == 200, res_invite.text
        ana_member_info = res_invite.json()
        ana_id = ana_member_info["user_id"]
        assert ana_member_info["username"] == "ana"
        print("  ✓ Paso 14: Carlos invitó a Ana al 'Equipo AI' como miembro.")

        # 15. Ana sees the Organization in her list
        res_ana_orgs = await client.get("/api/orgs", headers=ana_headers)
        assert res_ana_orgs.status_code == 200
        ana_org_names = [o["name"] for o in res_ana_orgs.json()]
        assert "Equipo AI" in ana_org_names
        print("  ✓ Paso 15: Ana lista 'Equipo AI' en sus organizaciones disponibles.")

        # 16. Shared Organization Vault (Carlos inserts a shared reel into the org)
        async with aiosqlite.connect(test_db_path) as db:
            await db.execute(
                """
                INSERT INTO reels (id, user_id, org_id, url, platform, title, summary, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'youtube', ?, ?, datetime('now'), datetime('now'))
                """,
                ("reel-shared-1", carlos_id, org_id, "https://youtube.com/shorts/ai-trick", "Truco Compartido Midjourney", "Prompting secreto de equipo")
            )
            await db.commit()

        # Both Carlos and Ana see the reel in the organization vault
        res_org_reels_carlos = await client.get(f"/api/reels?org_id={org_id}", headers=carlos_headers)
        assert res_org_reels_carlos.status_code == 200
        assert len(res_org_reels_carlos.json()) == 1
        assert res_org_reels_carlos.json()[0]["title"] == "Truco Compartido Midjourney"

        res_org_reels_ana = await client.get(f"/api/reels?org_id={org_id}", headers=ana_headers)
        assert res_org_reels_ana.status_code == 200
        assert len(res_org_reels_ana.json()) == 1
        assert res_org_reels_ana.json()[0]["title"] == "Truco Compartido Midjourney"
        print("  ✓ Paso 16: Bóveda compartida verificada: Carlos y Ana colaboran sobre los mismos reels.")

        # Ana's personal vault is empty (personal reels remain isolated)
        res_ana_personal = await client.get("/api/reels", headers=ana_headers)
        assert res_ana_personal.status_code == 200
        assert len(res_ana_personal.json()) == 0
        print("  ✓ Paso 17: Bóveda personal de Ana permanece limpia y aislada de los reels del equipo.")

        # 18. Shared Vault - Folders
        res_shared_folder = await client.post(
            "/api/folders",
            headers=ana_headers,
            json={"name": "Carpeta Compartida Marketing", "org_id": org_id}
        )
        assert res_shared_folder.status_code == 200
        shared_folder_id = res_shared_folder.json()["id"]

        # Carlos sees Ana's folder in the organization
        res_carlos_org_folders = await client.get(f"/api/folders?org_id={org_id}", headers=carlos_headers)
        assert res_carlos_org_folders.status_code == 200
        assert any(f["name"] == "Carpeta Compartida Marketing" for f in res_carlos_org_folders.json())
        print("  ✓ Paso 18: Creación y sincronización de carpetas compartidas de organización verificada.")

        # 19. Access Control: A non-member cannot access organization vault
        # Create user 'pedro'
        res_pedro = await client.post("/api/auth/register", json={"username": "pedro", "pin": "5555"})
        pedro_headers = {"Authorization": f"Bearer {res_pedro.json()['token']}"}

        res_pedro_forbidden = await client.get(f"/api/reels?org_id={org_id}", headers=pedro_headers)
        assert res_pedro_forbidden.status_code == 403
        print("  ✓ Paso 19: Seguridad RBAC: Usuario externo (Pedro) recibe 403 Forbidden al consultar la organización.")

        # 20. Member leaves the organization
        res_leave = await client.delete(f"/api/orgs/{org_id}/members/{ana_id}", headers=ana_headers)
        assert res_leave.status_code == 200
        res_ana_now_forbidden = await client.get(f"/api/reels?org_id={org_id}", headers=ana_headers)
        assert res_ana_now_forbidden.status_code == 403
        print("  ✓ Paso 20: Salida voluntaria de organización validada (Ana ya no tiene acceso tras salir).")

        print("\n🎉 TODOS LOS 20 TESTS DE MULTIUSUARIO, AUTO-REGISTRO Y ORGANIZACIONES PASARON EXITOSAMENTE!")

if __name__ == "__main__":
    asyncio.run(run_suite())
