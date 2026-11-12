"""Cache hasil panggilan model: LRU di memori + berkas JSON di disk (tanpa database, tanpa dependensi baru).

Kunci = sha256 dari bagian-bagian input (gambar, prompt, model, ...). Hanya hasil sukses yang disimpan;
pemanggil tidak menyimpan error. Kegagalan baca/tulis disk tidak boleh menjatuhkan analisis.
"""

import hashlib
import json
import logging
import os
import threading
from collections import OrderedDict
from functools import lru_cache
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)

CACHE_VERSION = "1"  # naikkan bila format/logika hasil berubah supaya cache lama tidak terpakai


def make_key(*parts: bytes | str) -> str:
    h = hashlib.sha256(CACHE_VERSION.encode())
    for p in parts:
        data = p if isinstance(p, bytes) else p.encode("utf-8")
        h.update(len(data).to_bytes(8, "big"))  # panjang dulu: ("ab","c") tidak boleh sama dengan ("a","bc")
        h.update(data)
    return h.hexdigest()


class JsonCache:
    def __init__(self, directory: Path | None = None, enabled: bool = True, max_memory: int = 512):
        self.enabled = enabled
        self.directory = Path(directory) if directory else None
        self.max_memory = max_memory
        self._mem: OrderedDict[str, Any] = OrderedDict()
        self._lock = threading.Lock()

    def _path(self, namespace: str, key: str) -> Path | None:
        return self.directory / namespace / f"{key}.json" if self.directory else None

    def get(self, namespace: str, key: str) -> Any | None:
        if not self.enabled:
            return None
        mk = f"{namespace}/{key}"
        with self._lock:
            if mk in self._mem:
                self._mem.move_to_end(mk)
                return self._mem[mk]
        path = self._path(namespace, key)
        if path is not None and path.is_file():
            try:
                value = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, ValueError) as e:
                log.warning("Cache rusak diabaikan (%s): %s", path.name, e)
                return None
            self._remember(mk, value)
            return value
        return None

    def set(self, namespace: str, key: str, value: Any) -> None:
        if not self.enabled:
            return
        self._remember(f"{namespace}/{key}", value)
        path = self._path(namespace, key)
        if path is None:
            return
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            tmp = path.with_name(f"{path.name}.{os.getpid()}.{threading.get_ident()}.tmp")
            tmp.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
            os.replace(tmp, path)  # atomik: pembaca tidak pernah melihat berkas setengah jadi
        except (OSError, TypeError, ValueError) as e:
            log.warning("Gagal menulis cache: %s", e)

    def _remember(self, mk: str, value: Any) -> None:
        with self._lock:
            self._mem[mk] = value
            self._mem.move_to_end(mk)
            while len(self._mem) > self.max_memory:
                self._mem.popitem(last=False)


@lru_cache(maxsize=8)
def shared_cache(enabled: bool, directory: str | None) -> JsonCache:
    """Satu instance per (enabled, direktori) supaya memori dipakai bersama antar request."""
    return JsonCache(Path(directory) if directory else None, enabled)
