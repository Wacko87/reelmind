import hmac
import hashlib
import time
import json
import base64
from typing import Optional
from fastapi import Request, HTTPException, Depends, Header
from .config import settings

TOKEN_EXPIRATION_SECONDS = 30 * 24 * 3600  # 30 días

def create_auth_token() -> str:
    payload = {
        "authenticated": True,
        "exp": int(time.time()) + TOKEN_EXPIRATION_SECONDS
    }
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
    signature = hmac.new(
        settings.SECRET_KEY.encode(),
        payload_b64.encode(),
        hashlib.sha256
    ).hexdigest()
    return f"{payload_b64}.{signature}"

def verify_token_string(token: str) -> bool:
    if not token or "." not in token:
        return False
    try:
        payload_b64, signature = token.split(".", 1)
        expected_sig = hmac.new(
            settings.SECRET_KEY.encode(),
            payload_b64.encode(),
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(signature, expected_sig):
            return False

        payload = json.loads(base64.urlsafe_b64decode(payload_b64.encode()).decode())
        if payload.get("exp", 0) < time.time():
            return False
            
        return bool(payload.get("authenticated"))
    except Exception:
        return False

async def require_auth(
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """
    Dependencia de FastAPI.
    Si AUTH_PIN no está configurado en .env, permite el acceso libre.
    Si AUTH_PIN está configurado, exige un token válido.
    """
    if not settings.AUTH_PIN:
        return True

    # 1. Verificar cabecera Authorization: Bearer <token>
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ", 1)[1].strip()

    # 2. Verificar cookie de sesión alternativa
    if not token:
        token = request.cookies.get("reelmind_auth")

    if not token or not verify_token_string(token):
        raise HTTPException(
            status_code=401,
            detail="Se requiere PIN o contraseña de acceso para esta acción."
        )

    return True
