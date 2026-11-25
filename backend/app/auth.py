import hmac
import hashlib
import time
import json
import base64
from typing import Optional
from fastapi import Request, HTTPException, Depends, Header
from .config import settings

TOKEN_EXPIRATION_SECONDS = 30 * 24 * 3600  # 30 días

class CurrentUser:
    def __init__(self, id: str, username: str, is_admin: bool):
        self.id = id
        self.username = username
        self.is_admin = is_admin

    def __repr__(self):
        return f"<CurrentUser id={self.id} username={self.username} admin={self.is_admin}>"

def create_auth_token(user_id: str = "admin", username: str = "admin", is_admin: bool = False) -> str:
    payload = {
        "authenticated": True,
        "user_id": user_id,
        "username": username,
        "is_admin": is_admin,
        "exp": int(time.time()) + TOKEN_EXPIRATION_SECONDS
    }
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
    signature = hmac.new(
        settings.SECRET_KEY.encode(),
        payload_b64.encode(),
        hashlib.sha256
    ).hexdigest()
    return f"{payload_b64}.{signature}"

def verify_token_payload(token: str) -> Optional[dict]:
    if not token or "." not in token:
        return None
    try:
        payload_b64, signature = token.split(".", 1)
        expected_sig = hmac.new(
            settings.SECRET_KEY.encode(),
            payload_b64.encode(),
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(signature, expected_sig):
            return None

        payload = json.loads(base64.urlsafe_b64decode(payload_b64.encode()).decode())
        if payload.get("exp", 0) < time.time():
            return None
            
        if not payload.get("authenticated"):
            return None

        return payload
    except Exception:
        return None

def verify_token_string(token: str) -> bool:
    return verify_token_payload(token) is not None

async def get_current_user(
    request: Request,
    authorization: Optional[str] = Header(None),
    x_service_key: Optional[str] = Header(None)
) -> CurrentUser:
    """
    Dependencia de FastAPI que extrae y valida el usuario actual autenticado.
    1. Si se proporciona una X-Service-Key o Bearer correspondiente a SERVICE_API_KEY, opera como admin.
    2. Si AUTH_PIN no está configurado en .env, opera como admin.
    3. Si AUTH_PIN está configurado, exige un token de sesión válido con user_id.
    """
    # 1. Verificación de Service Key para scripts y demonios (ej. sync-reelmind-obsidian)
    if settings.SERVICE_API_KEY:
        if x_service_key and hmac.compare_digest(x_service_key.strip(), settings.SERVICE_API_KEY.strip()):
            return CurrentUser(id="admin", username="admin", is_admin=True)
        if authorization and authorization.startswith("Bearer "):
            bearer_val = authorization.split("Bearer ", 1)[1].strip()
            if hmac.compare_digest(bearer_val, settings.SERVICE_API_KEY.strip()):
                return CurrentUser(id="admin", username="admin", is_admin=True)

    # 2. Extraer token de cabecera Authorization o cookie
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ", 1)[1].strip()

    if not token:
        token = request.cookies.get("reelmind_auth")

    # 3. Si no hay PIN configurado en el servidor y no hay token, acceso libre como admin
    if not settings.AUTH_PIN and not token:
        return CurrentUser(id="admin", username="admin", is_admin=True)

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Se requiere PIN o contraseña de acceso para esta acción."
        )

    payload = verify_token_payload(token)
    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Sesión expirada o no autorizada. Por favor vuelve a introducir tu PIN."
        )

    user_id = str(payload.get("user_id") or "admin")
    username = str(payload.get("username") or "admin")
    is_admin = bool(payload.get("is_admin", user_id == "admin"))

    return CurrentUser(id=user_id, username=username, is_admin=is_admin)

async def require_auth(
    current_user: CurrentUser = Depends(get_current_user)
) -> CurrentUser:
    return current_user

async def require_admin(
    current_user: CurrentUser = Depends(get_current_user)
) -> CurrentUser:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Acceso restringido: se requieren permisos de administrador."
        )
    return current_user
