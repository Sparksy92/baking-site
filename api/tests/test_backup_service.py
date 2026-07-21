"""Tests for backup_service — covers pure-logic functions without hitting
subprocess or the real filesystem where possible."""
import hashlib
import os
import pytest
from datetime import datetime, timezone, timedelta
from pathlib import Path
from unittest.mock import patch, MagicMock


@pytest.fixture
def tmp_backup_dir(tmp_path):
    return tmp_path / "backups"


@pytest.fixture
def config(tmp_backup_dir):
    from app.services.backup_service import BackupConfig
    cfg = BackupConfig.__new__(BackupConfig)
    cfg.backup_dir = tmp_backup_dir
    cfg.encrypt = False
    cfg.encryption_key = None
    cfg.daily_retention_days = 30
    cfg.weekly_retention_days = 90
    cfg.monthly_retention_months = 12
    cfg.s3_endpoint = None
    cfg.s3_bucket = "backups"
    cfg.s3_access_key = None
    cfg.s3_secret_key = None
    cfg.notify_email = None
    cfg.slack_webhook = None
    return cfg


# ── ensure_backup_dir ─────────────────────────────────────────────────────────

def test_ensure_backup_dir_creates_directory(config, tmp_backup_dir):
    from app.services.backup_service import ensure_backup_dir
    assert not tmp_backup_dir.exists()
    ensure_backup_dir(config)
    assert tmp_backup_dir.exists()


def test_ensure_backup_dir_sets_permissions(config):
    from app.services.backup_service import ensure_backup_dir
    ensure_backup_dir(config)
    mode = oct(config.backup_dir.stat().st_mode)[-3:]
    assert mode == "700"


# ── create_backup_filename ────────────────────────────────────────────────────

def test_create_backup_filename_format(config):
    from app.services.backup_service import create_backup_filename
    ts = datetime(2024, 3, 15, 2, 0, 0, tzinfo=timezone.utc)
    name = create_backup_filename(config, timestamp=ts)
    assert name == "backup_20240315_020000.sql"


def test_create_backup_filename_uses_utc_now_when_no_timestamp(config):
    from app.services.backup_service import create_backup_filename
    name = create_backup_filename(config)
    assert name.startswith("backup_")
    assert name.endswith(".sql")


# ── calculate_checksum ────────────────────────────────────────────────────────

def test_calculate_checksum(tmp_path):
    from app.services.backup_service import calculate_checksum
    f = tmp_path / "test.sql"
    content = b"SELECT * FROM orders;"
    f.write_bytes(content)
    expected = hashlib.sha256(content).hexdigest()
    assert calculate_checksum(f) == expected


def test_calculate_checksum_empty_file(tmp_path):
    from app.services.backup_service import calculate_checksum
    f = tmp_path / "empty.sql"
    f.write_bytes(b"")
    assert calculate_checksum(f) == hashlib.sha256(b"").hexdigest()


# ── upload_to_s3 — no S3 configured ──────────────────────────────────────────

def test_upload_to_s3_skipped_when_not_configured(config, tmp_path):
    from app.services.backup_service import upload_to_s3
    f = tmp_path / "backup.sql"
    f.write_bytes(b"data")
    # S3 not configured — should return True (skip, not failure)
    assert upload_to_s3(f, config) is True


# ── encrypt_backup ────────────────────────────────────────────────────────────

def test_encrypt_backup_skipped_when_disabled(config, tmp_path):
    from app.services.backup_service import encrypt_backup
    config.encrypt = False
    f = tmp_path / "backup.sql"
    f.write_bytes(b"data")
    result = encrypt_backup(f, config)
    assert result == f  # Returned unchanged


def test_encrypt_backup_gpg_not_found_returns_input(config, tmp_path):
    from app.services.backup_service import encrypt_backup
    config.encrypt = True
    config.encryption_key = "a" * 30
    f = tmp_path / "backup.sql"
    f.write_bytes(b"data")
    with patch("subprocess.run", side_effect=FileNotFoundError):
        result = encrypt_backup(f, config)
    assert result == f


def test_encrypt_backup_subprocess_failure_returns_input(config, tmp_path):
    from app.services.backup_service import encrypt_backup
    config.encrypt = True
    config.encryption_key = None  # triggers openssl branch
    f = tmp_path / "backup.sql"
    f.write_bytes(b"data")
    mock_result = MagicMock()
    mock_result.returncode = 1
    mock_result.stderr = b"openssl error"
    with patch("subprocess.run", return_value=mock_result):
        result = encrypt_backup(f, config)
    assert result == f


# ── run_pg_dump ───────────────────────────────────────────────────────────────

def test_run_pg_dump_success(config, tmp_path):
    from app.services.backup_service import run_pg_dump
    config.db_url = "postgresql://user:pass@localhost:5432/testdb"
    output = tmp_path / "backup.sql"
    mock_result = MagicMock()
    mock_result.returncode = 0
    with patch("subprocess.run", return_value=mock_result):
        assert run_pg_dump(output, config) is True


def test_run_pg_dump_failure(config, tmp_path):
    from app.services.backup_service import run_pg_dump
    config.db_url = "postgresql://user:pass@localhost:5432/testdb"
    output = tmp_path / "backup.sql"
    mock_result = MagicMock()
    mock_result.returncode = 1
    mock_result.stderr = "connection refused"
    with patch("subprocess.run", return_value=mock_result):
        assert run_pg_dump(output, config) is False


def test_run_pg_dump_not_found(config, tmp_path):
    from app.services.backup_service import run_pg_dump
    config.db_url = "postgresql://user:pass@localhost/db"
    with patch("subprocess.run", side_effect=FileNotFoundError):
        assert run_pg_dump(tmp_path / "out.sql", config) is False


def test_run_pg_dump_timeout(config, tmp_path):
    import subprocess
    from app.services.backup_service import run_pg_dump
    config.db_url = "postgresql://u:p@h/d"
    with patch("subprocess.run", side_effect=subprocess.TimeoutExpired("pg_dump", 3600)):
        assert run_pg_dump(tmp_path / "out.sql", config) is False


# ── cleanup_old_backups ───────────────────────────────────────────────────────

def test_cleanup_deletes_old_daily_files(config):
    from app.services.backup_service import cleanup_old_backups, ensure_backup_dir
    ensure_backup_dir(config)

    now = datetime.now(timezone.utc)

    # Recent file — should be kept
    recent = now - timedelta(days=5)
    (config.backup_dir / f"backup_{recent.strftime('%Y%m%d')}_120000.sql").touch()

    # Old file — should be deleted
    old = now - timedelta(days=100)
    # Make it a Tuesday (weekday=1) so it's not a weekly keeper
    while old.weekday() != 1:
        old -= timedelta(days=1)
    # Also not 1st of month
    while old.day == 1:
        old -= timedelta(days=1)
    (config.backup_dir / f"backup_{old.strftime('%Y%m%d')}_120000.sql").touch()

    stats = cleanup_old_backups(config)
    assert stats["deleted"] >= 1
    assert stats["kept"] >= 1


def test_cleanup_empty_dir_returns_zeros(config):
    from app.services.backup_service import cleanup_old_backups, ensure_backup_dir
    ensure_backup_dir(config)
    stats = cleanup_old_backups(config)
    assert stats == {"deleted": 0, "kept": 0}


def test_cleanup_handles_nonexistent_dir(config, tmp_path):
    from app.services.backup_service import cleanup_old_backups
    config.backup_dir = tmp_path / "nonexistent"
    # Should not raise — returns zeros
    stats = cleanup_old_backups(config)
    assert stats == {"deleted": 0, "kept": 0}


# ── send_notification ─────────────────────────────────────────────────────────

def test_send_notification_no_webhook_does_nothing(config):
    from app.services.backup_service import send_notification
    # Should not raise
    send_notification("Backup complete", config, success=True)


def test_send_notification_slack_called(config):
    from app.services.backup_service import send_notification
    config.slack_webhook = "https://hooks.slack.com/test"
    with patch("httpx.post") as mock_post:
        mock_post.return_value = MagicMock(status_code=200)
        send_notification("All good", config, success=True)
        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args
        assert call_kwargs[0][0] == "https://hooks.slack.com/test"
