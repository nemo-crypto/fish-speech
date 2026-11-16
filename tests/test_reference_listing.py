from pathlib import Path
from unittest.mock import Mock

from fish_speech.inference_engine.reference_loader import ReferenceLoader


def test_listed_references_can_be_loaded(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    base = Path("references")
    for name in ["valid", "nested", "mixed", "lab-directory", "invalid!", "empty"]:
        (base / name).mkdir(parents=True)
    for name in ["valid", "mixed", "lab-directory", "invalid!"]:
        (base / name / "sample.WAV").write_bytes(b"audio")
        if name == "lab-directory":
            (base / name / "sample.lab").mkdir()
        else:
            (base / name / "sample.lab").write_text("Hello")
    (base / "mixed" / "missing.wav").write_bytes(b"audio")
    nested = base / "nested" / "session"
    nested.mkdir()
    (nested / "sample.wav").write_bytes(b"audio")
    (nested / "sample.lab").write_text("Hello")
    loader = ReferenceLoader()
    loader.encode_reference = Mock(return_value="tokens")
    assert loader.list_reference_ids() == ["nested", "valid"]
    for reference_id in loader.list_reference_ids():
        assert loader.load_by_id(reference_id, "off") == (["tokens"], ["Hello"])


def test_missing_reference_root_lists_nothing(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    assert ReferenceLoader().list_reference_ids() == []
