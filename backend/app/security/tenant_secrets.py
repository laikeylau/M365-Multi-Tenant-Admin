import logging
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings

logger = logging.getLogger(__name__)

_PREFIX = "enc:"


@lru_cache()
def _get_fernet() -> Fernet:
    return Fernet(settings.TENANT_SECRET_ENCRYPTION_KEY.encode("utf-8"))


def is_encrypted(value: str) -> bool:
    return isinstance(value, str) and value.startswith(_PREFIX)


def encrypt_tenant_secret(plaintext: str) -> str:
    if plaintext is None:
        raise ValueError("Tenant secret cannot be None")
    if is_encrypted(plaintext):
        return plaintext
    token = _get_fernet().encrypt(plaintext.encode("utf-8")).decode("utf-8")
    return f"{_PREFIX}{token}"


def decrypt_tenant_secret(value: str) -> str:
    if value is None:
        raise ValueError("Tenant secret cannot be None")
    if not is_encrypted(value):
        # Backward-compatible read: legacy plaintext secrets still work,
        # but should be migrated/encrypted ASAP.
        logger.warning("Tenant client_secret is stored in plaintext; migrate to encrypted storage.")
        return value
    token = value[len(_PREFIX) :]
    try:
        return _get_fernet().decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken as e:
        raise ValueError("Invalid encrypted tenant secret (cannot decrypt).") from e
