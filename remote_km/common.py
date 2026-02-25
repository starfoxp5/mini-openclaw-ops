import hashlib
import hmac
import json
from typing import Any, Dict


def pack_message(message: Dict[str, Any], secret: str) -> bytes:
    payload = json.dumps(message, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
    sig = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    packet = {"m": message, "s": sig}
    return json.dumps(packet, separators=(",", ":"), ensure_ascii=True).encode("utf-8")


def unpack_message(packet_bytes: bytes, secret: str) -> Dict[str, Any]:
    packet = json.loads(packet_bytes.decode("utf-8"))
    msg = packet["m"]
    sig = packet["s"]
    payload = json.dumps(msg, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
    expected = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected):
        raise ValueError("invalid signature")
    return msg

