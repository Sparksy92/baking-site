"""Unit tests for backup_service pure functions — no subprocess or filesystem writes."""
import pytest
import hashlib
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import MagicMock, patch


def _make_config(backup_dir=None):
    """Create a BackupConfig with mocked settings."""
    with patch("app.services.backup_service.get_settings") as mock_gs:
        mock_gs.return_value = MagicMock(
            database_url="postgresql://user:pass@localhost/testdb",
        )
        from app.services.backup_service import BackupConfig
        cfg = BackupConfig()
    if backup_dir:
        cfg.backup_dir = Path(backup_dir)
    return cfg


# ── create_backup_filename ────────────────────────────────────────────────────

def test_create_backup_filename_format():
    from app.services.backup_service import create_backup_filename
    cfg = _make_config()
    ts = datetime(2024, 6, 15, 10, 30, 45, tzinfo=timezone.utc)
    result = create_backup_filename(cfg, timestamp=ts)
    assert result == "backup_20240615_103045.sql"


def test_create_backup_filename_starts_with_backup():
    from app.services.backup_service import create_backup_filename
    cfg = _make_config()
    result = create_backup_filename(cfg)
    assert result.startswith("backup_")


def test_create_backup_filename_ends_with_sql():
    from app.services.backup_service import create_backup_filename
    cfg = _make_config()
    result = create_backup_filename(cfg)
    assert result.endswith(".sql")


def test_create_backup_filename_auto_timestamp():
    from app.services.backup_service import create_backup_filename
    cfg = _make_config()
    # No timestamp arg → uses current time, should not crash
    result = create_backup_filename(cfg)
    assert isinstance(result, str) and len(result) > 10


def test_create_backup_filename_midnight():
    from app.services.backup_service import create_backup_filename
    cfg = _make_config()
    ts = datetime(2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
    result = create_backup_filename(cfg, timestamp=ts)
    assert result == "backup_20240101_000000.sql"


# ── calculate_checksum ────────────────────────────────────────────────────────

def test_calculate_checksum_sha256():
    from app.services.backup_service import calculate_checksum
    with tempfile.NamedTemporaryFile(delete=False, suffix=".sql") as f:
        f.write(b"SELECT 1;\nSELECT 2;\n")
        path = Path(f.name)
    expected = hashlib.sha256(b"SELECT 1;\nSELECT 2;\n").hexdigest()
    assert calculate_checksum(path) == expected
    path.unlink()


def test_calculate_checksum_empty_file():
    from app.services.backup_service import calculate_checksum
    with tempfile.NamedTemporaryFile(delete=False) as f:
        path = Path(f.name)
    result = calculate_checksum(path)
    assert result == hashlib.sha256(b"").hexdigest()
    path.unlink()


def test_calculate_checksum_returns_hex_string():
    from app.services.backup_service import calculate_checksum
    with tempfile.NamedTemporaryFile(delete=False) as f:
        f.write(b"data")
        path = Path(f.name)
    result = calculate_checksum(path)
    assert isinstance(result, str)
    assert len(result) == 64
    assert all(c in "0123456789abcdef" for c in result)
    path.unlink()


def test_calculate_checksum_large_file():
    from app.services.backup_service import calculate_checksum
    data = b"x" * (8192 * 3 + 100)  # spans multiple chunk reads
    with tempfile.NamedTemporaryFile(delete=False) as f:
        f.write(data)
        path = Path(f.name)
    expected = hashlib.sha256(data).hexdigest()
    assert calculate_checksum(path) == expected
    path.unlink()


def test_calculate_checksum_different_files_differ():
    from app.services.backup_service import calculate_checksum
    with tempfile.NamedTemporaryFile(delete=False) as f1:
        f1.write(b"content_A")
        p1 = Path(f1.name)
    with tempfile.NamedTemporaryFile(delete=False) as f2:
        f2.write(b"content_B")
        p2 = Path(f2.name)
    assert calculate_checksum(p1) != calculate_checksum(p2)
    p1.unlink(); p2.unlink()


# ── ensure_backup_dir ─────────────────────────────────────────────────────────

def test_ensure_backup_dir_creates_directory():
    from app.services.backup_service import ensure_backup_dir
    with tempfile.TemporaryDirectory() as tmp:
        cfg = _make_config()
        cfg.backup_dir = Path(tmp) / "backups" / "nested"
        ensure_backup_dir(cfg)
        assert cfg.backup_dir.exists()
        assert cfg.backup_dir.is_dir()


def test_ensure_backup_dir_idempotent():
    from app.services.backup_service import ensure_backup_dir
    with tempfile.TemporaryDirectory() as tmp:
        cfg = _make_config()
        cfg.backup_dir = Path(tmp) / "backups"
        ensure_backup_dir(cfg)
        ensure_backup_dir(cfg)  # second call should not raise
        assert cfg.backup_dir.exists()
