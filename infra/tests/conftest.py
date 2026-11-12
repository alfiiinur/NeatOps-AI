import os

# Cache disk dimatikan untuk seluruh tes: hasil dari tes lain / sesi sebelumnya tidak boleh bocor.
# Diset saat modul ini dimuat (sebelum app.api.main diimpor oleh modul tes). Tes cache membuat JsonCache sendiri.
os.environ["CACHE_ENABLED"] = "false"
