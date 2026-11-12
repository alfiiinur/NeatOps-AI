from app.clients.knowledge import load_knowledge, load_knowledge_cached, relevant_context


def write(d, name, text):
    p = d / name
    p.write_text(text, encoding="utf-8")
    return p


def test_empty_or_missing_folder_is_safe(tmp_path):
    assert load_knowledge(tmp_path) == []
    assert load_knowledge(tmp_path / "tidak-ada") == []


def test_readme_placeholder_is_ignored_and_other_docs_loaded(tmp_path):
    write(tmp_path, "README.md", "Taruh dokumen di sini")
    write(tmp_path, "perangkat.md", "Switch: Cisco Catalyst 9200L 24 port\n\nUPS: APC SRT 3000VA")
    write(tmp_path, "abaikan.docx", "tidak didukung")
    chunks = load_knowledge(tmp_path)
    assert chunks == ["Switch: Cisco Catalyst 9200L 24 port", "UPS: APC SRT 3000VA"]


def test_corrupt_pdf_is_skipped_not_fatal(tmp_path):
    (tmp_path / "rusak.pdf").write_bytes(b"bukan pdf sungguhan")
    write(tmp_path, "ok.txt", "Router MikroTik RB4011")
    assert load_knowledge(tmp_path) == ["Router MikroTik RB4011"]


def test_long_paragraph_is_split(tmp_path):
    write(tmp_path, "panjang.txt", "kata " * 1000)
    chunks = load_knowledge(tmp_path)
    assert len(chunks) > 1 and all(len(c) <= 1200 for c in chunks)


def test_relevant_context_picks_matching_chunks_within_budget():
    chunks = ["Switch Cisco Catalyst 9200L", "UPS APC Smart-UPS SRT", "Resep nasi goreng"]
    ctx = relevant_context(chunks, ["network switch", "Jaringan"])
    assert "Catalyst" in ctx and "nasi goreng" not in ctx and "APC" not in ctx
    assert relevant_context(chunks, ["tidak ada yang cocok xyz"]) == ""
    assert relevant_context(chunks, ["switch"], limit_chars=5) == ""


def test_cache_reloads_when_file_changes(tmp_path):
    p = write(tmp_path, "a.txt", "Switch lama")
    assert load_knowledge_cached(tmp_path) == ["Switch lama"]
    p.write_text("Switch baru yang lebih panjang", encoding="utf-8")
    assert load_knowledge_cached(tmp_path) == ["Switch baru yang lebih panjang"]
