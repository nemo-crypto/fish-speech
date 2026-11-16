import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from pydantic import ValidationError

from fish_speech.inference_engine.reference_loader import ReferenceLoader
from fish_speech.utils.file import list_files, read_ref_text
from fish_speech.utils.schema import ServeReferenceAudio, ServeTTSRequest


class ReferenceIOReviewTest(unittest.TestCase):
    def test_list_files_filters_case_and_directories_without_duplicates(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "2.WAV").write_bytes(b"audio")
            (root / "10.wav").write_bytes(b"audio")
            (root / "folder.wav").mkdir()
            (root / "note.txt").write_text("text")
            self.assertEqual(
                [p.name for p in list_files(root, {".wav", "WAV"})],
                ["2.WAV", "10.wav"],
            )
            self.assertEqual(len(list_files(root)), 3)
            (root / "folder.wav" / "child.flac").write_bytes(b"audio")
            self.assertEqual(
                [p.name for p in list_files(root, {".FLAC"}, recursive=True)],
                ["child.flac"],
            )

    def test_long_inline_transcript_is_not_treated_as_a_path(self):
        text = "long inline transcript " * 1000
        self.assertEqual(read_ref_text(text), text)

    def test_text_file_is_still_read(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "voice.lab"
            path.write_text("Hello world", encoding="utf-8")
            self.assertEqual(read_ref_text(str(path)), "Hello world")

    def test_blank_tts_text_is_rejected_but_valid_text_is_preserved(self):
        for text in ("", " \t\n", "\u3000"):
            with self.subTest(text=text), self.assertRaises(ValidationError):
                ServeTTSRequest(text=text)
        self.assertEqual(ServeTTSRequest(text=" Hello ").text, " Hello ")

    def test_reference_id_rejects_trailing_newline(self):
        with self.assertRaises(ValueError):
            ReferenceLoader._validate_id("speaker\n")
        ReferenceLoader._validate_id("speaker-1")

    def test_cache_off_neither_hashes_nor_retains_reference_tokens(self):
        loader = ReferenceLoader()
        loader.encode_reference = Mock(return_value="tokens")
        refs = [ServeReferenceAudio(audio=b"audio", text="Hello")]
        with patch("fish_speech.inference_engine.reference_loader.sha256") as digest:
            for _ in range(2):
                self.assertEqual(
                    loader.load_by_hash(refs, "off"), (["tokens"], ["Hello"])
                )
            digest.assert_not_called()
        self.assertEqual(loader.encode_reference.call_count, 2)
        self.assertEqual(loader.ref_by_hash, {})

    def test_cache_on_reuses_tokens_but_uses_current_transcript(self):
        loader = ReferenceLoader()
        loader.encode_reference = Mock(return_value="tokens")
        loader.load_by_hash([ServeReferenceAudio(audio=b"audio", text="old")], "on")
        self.assertEqual(
            loader.load_by_hash(
                [ServeReferenceAudio(audio=b"audio", text="new")], "on"
            ),
            (["tokens"], ["new"]),
        )
        loader.encode_reference.assert_called_once()

    def test_id_cache_hit_does_not_scan_the_directory_again(self):
        loader = ReferenceLoader()
        loader.ref_by_id["speaker"] = (["tokens"], ["Hello"])
        with tempfile.TemporaryDirectory() as directory:
            with patch(
                "fish_speech.inference_engine.reference_loader.Path",
                return_value=Path(directory),
            ):
                with patch(
                    "fish_speech.inference_engine.reference_loader.list_files"
                ) as scan:
                    self.assertEqual(
                        loader.load_by_id("speaker", "on"), (["tokens"], ["Hello"])
                    )
                    scan.assert_not_called()

    def test_missing_reference_does_not_create_a_directory(self):
        loader = ReferenceLoader()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with patch(
                "fish_speech.inference_engine.reference_loader.Path",
                return_value=root / "references",
            ):
                with self.assertRaises(ValueError):
                    loader.load_by_id("missing", "off")
            self.assertFalse((root / "references").exists())

    def test_id_cache_off_does_not_retain_tokens(self):
        loader = ReferenceLoader()
        loader.encode_reference = Mock(return_value="tokens")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            voice = root / "speaker"
            voice.mkdir()
            (voice / "sample.wav").write_bytes(b"audio")
            (voice / "sample.lab").write_text("Hello", encoding="utf-8")
            with patch(
                "fish_speech.inference_engine.reference_loader.Path", return_value=root
            ):
                self.assertEqual(
                    loader.load_by_id("speaker", "off"), (["tokens"], ["Hello"])
                )
            self.assertEqual(loader.ref_by_id, {})


if __name__ == "__main__":
    unittest.main()
