import base64
import hashlib
import hmac
import secrets
from cryptography.fernet import Fernet
from app.config import settings

def _get_fernet() -> Fernet:
    """
    Deriva una clave de 32 bytes para Fernet a partir del SECRET_KEY persistido en disco.
    """
    secret_bytes = settings.SECRET_KEY.encode("utf-8")
    derived_32 = hashlib.sha256(secret_bytes).digest()
    fernet_key = base64.urlsafe_b64encode(derived_32)
    return Fernet(fernet_key)

def encrypt_secret(plain_text: str) -> str:
    """
    Cifra un valor sensible (por ejemplo la clave de Gemini) usando AES-128-CBC con HMAC (Fernet).
    """
    if not plain_text or not plain_text.strip():
        return ""
    try:
        f = _get_fernet()
        return f.encrypt(plain_text.strip().encode("utf-8")).decode("utf-8")
    except Exception:
        return plain_text

def decrypt_secret(cipher_text: str) -> str:
    """
    Descifra un valor en reposo. Si el valor no está cifrado (clave legacy en texto plano),
    lo devuelve tal cual para migración transparente.
    """
    if not cipher_text or not cipher_text.strip():
        return ""
    stripped = cipher_text.strip()
    # Los tokens Fernet siempre empiezan por el prefijo base64 gAAAAA
    if stripped.startswith("gAAAAA"):
        try:
            f = _get_fernet()
            return f.decrypt(stripped.encode("utf-8")).decode("utf-8")
        except Exception:
            return stripped
    return stripped

def hash_pin(pin: str) -> str:
    """
    Genera un hash criptográfico robusto PBKDF2-HMAC-SHA256 con sal aleatoria de 16 bytes
    y 100.000 iteraciones (estándar OWASP).
    Formato: pbkdf2:sha256:100000$<salt_hex>$<hash_hex>
    """
    salt = secrets.token_hex(16)
    iterations = 100_000
    hash_bytes = hashlib.pbkdf2_hmac(
        "sha256",
        pin.encode("utf-8"),
        salt.encode("utf-8"),
        iterations
    )
    return f"pbkdf2:sha256:{iterations}${salt}${hash_bytes.hex()}"

def verify_pin(plain_pin: str, stored_hash_or_plain: str) -> bool:
    """
    Verifica un PIN o contraseña comparando en tiempo constante.
    Soporta hashes PBKDF2 o comparación segura en tiempo constante contra PIN en texto plano.
    """
    if not stored_hash_or_plain:
        return True
    
    clean_input = plain_pin.strip()
    stored = stored_hash_or_plain.strip()

    if stored.startswith("pbkdf2:sha256:"):
        try:
            parts = stored.split("$")
            if len(parts) == 3:
                header, salt, expected_hash = parts
                iterations = int(header.split(":")[-1])
                calc_bytes = hashlib.pbkdf2_hmac(
                    "sha256",
                    clean_input.encode("utf-8"),
                    salt.encode("utf-8"),
                    iterations
                )
                return hmac.compare_digest(calc_bytes.hex(), expected_hash)
        except Exception:
            return False

    # Comparación segura en tiempo constante contra timing attacks
    return hmac.compare_digest(clean_input, stored)
