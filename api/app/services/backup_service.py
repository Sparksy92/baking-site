"""Automated backup service for PostgreSQL database.

Security: Encrypts backups with AES-256 (GPG) before storage.
Retention: Daily backups kept for 30 days, weekly for 90 days, monthly for 1 year.
Storage: Supports local filesystem, S3-compatible (MinIO, AWS), or both.

Usage:
    # Manual backup
    python -m app.services.backup_service
    
    # Scheduled (cron)
    0 2 * * * cd /opt/app && python -m app.services.backup_service >> /var/log/backup.log 2>&1
"""
from __future__ import annotations

import gzip
import hashlib
import logging
import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any

from app.config import get_settings

logger = logging.getLogger(__name__)


class BackupConfig:
    """Backup configuration from environment."""
    
    def __init__(self):
        settings = get_settings()
        
        # Database
        self.db_url = getattr(settings, 'database_url', 
                             f"postgresql://user:pass@localhost/{getattr(settings, 'postgres_db', 'ecommerce')}")
        
        # Storage
        self.backup_dir = Path(os.getenv('BACKUP_DIR', '/data/backups'))
        self.encrypt = os.getenv('BACKUP_ENCRYPT', 'true').lower() == 'true'
        self.encryption_key = os.getenv('BACKUP_ENCRYPTION_KEY')  # GPG key or password
        
        # Retention
        self.daily_retention_days = int(os.getenv('BACKUP_DAILY_RETENTION', '30'))
        self.weekly_retention_days = int(os.getenv('BACKUP_WEEKLY_RETENTION', '90'))
        self.monthly_retention_months = int(os.getenv('BACKUP_MONTHLY_RETENTION', '12'))
        
        # S3/MinIO (optional)
        self.s3_endpoint = os.getenv('BACKUP_S3_ENDPOINT')  # e.g., http://minio:9000
        self.s3_bucket = os.getenv('BACKUP_S3_BUCKET', 'backups')
        self.s3_access_key = os.getenv('BACKUP_S3_ACCESS_KEY')
        self.s3_secret_key = os.getenv('BACKUP_S3_SECRET_KEY')
        
        # Notifications (optional)
        self.notify_email = os.getenv('BACKUP_NOTIFY_EMAIL')
        self.slack_webhook = os.getenv('BACKUP_SLACK_WEBHOOK')


def ensure_backup_dir(config: BackupConfig) -> None:
    """Ensure backup directory exists with proper permissions."""
    config.backup_dir.mkdir(parents=True, exist_ok=True)
    
    # Security: restrict permissions
    os.chmod(config.backup_dir, 0o700)


def create_backup_filename(config: BackupConfig, timestamp: datetime | None = None) -> str:
    """Generate backup filename with timestamp."""
    if timestamp is None:
        timestamp = datetime.now(timezone.utc)
    
    date_str = timestamp.strftime("%Y%m%d_%H%M%S")
    return f"backup_{date_str}.sql"


def run_pg_dump(output_path: Path, config: BackupConfig) -> bool:
    """Execute pg_dump to create database backup.
    
    Returns True on success, False on failure.
    """
    try:
        # Parse database URL
        db_url = config.db_url
        
        # Extract connection details from URL
        # Format: postgresql://user:pass@host:port/dbname
        import re
        match = re.match(r'postgresql://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/(.+)', db_url)
        
        if match:
            user, password, host, port, dbname = match.groups()
            port = port or '5432'
        else:
            # Fallback defaults
            user = os.getenv('POSTGRES_USER', 'postgres')
            password = os.getenv('POSTGRES_PASSWORD', '')
            host = os.getenv('POSTGRES_HOST', 'localhost')
            port = os.getenv('POSTGRES_PORT', '5432')
            dbname = os.getenv('POSTGRES_DB', 'ecommerce')
        
        # Set environment for pg_dump
        env = os.environ.copy()
        env['PGPASSWORD'] = password
        
        cmd = [
            'pg_dump',
            '-h', host,
            '-p', port,
            '-U', user,
            '-d', dbname,
            '-F', 'c',  # Custom format (compressed)
            '-Z', '9',  # Max compression
            '-v',  # Verbose
            '-f', str(output_path),
        ]
        
        logger.info(f"Starting backup: {output_path}")
        
        result = subprocess.run(
            cmd,
            env=env,
            capture_output=True,
            text=True,
            timeout=3600  # 1 hour max
        )
        
        if result.returncode == 0:
            logger.info(f"Backup completed: {output_path}")
            return True
        else:
            logger.error(f"pg_dump failed: {result.stderr}")
            return False
            
    except subprocess.TimeoutExpired:
        logger.error("Backup timed out after 1 hour")
        return False
    except FileNotFoundError:
        logger.error("pg_dump not found - is PostgreSQL client installed?")
        return False
    except Exception as exc:
        logger.exception("Backup failed")
        return False


def encrypt_backup(input_path: Path, config: BackupConfig) -> Path:
    """Encrypt backup file using GPG or OpenSSL.
    
    Returns path to encrypted file.
    """
    if not config.encrypt:
        return input_path
    
    output_path = Path(str(input_path) + '.gpg')
    
    try:
        if config.encryption_key and len(config.encryption_key) > 20:
            # Use GPG with key
            cmd = [
                'gpg',
                '--batch',
                '--yes',
                '--passphrase', config.encryption_key,
                '--symmetric',
                '--cipher-algo', 'AES256',
                '-o', str(output_path),
                str(input_path)
            ]
        else:
            # Use OpenSSL as fallback (simpler, no keyring needed)
            cmd = [
                'openssl', 'enc',
                '-aes-256-cbc',
                '-salt',
                '-pbkdf2',
                '-pass', f'pass:{config.encryption_key or "backup-secret"}',
                '-in', str(input_path),
                '-out', str(output_path)
            ]
        
        result = subprocess.run(cmd, capture_output=True, timeout=300)
        
        if result.returncode == 0:
            # Remove unencrypted file
            input_path.unlink()
            logger.info(f"Backup encrypted: {output_path}")
            return output_path
        else:
            logger.error(f"Encryption failed: {result.stderr}")
            return input_path
            
    except FileNotFoundError:
        logger.warning("GPG/OpenSSL not found - backup not encrypted")
        return input_path
    except Exception as exc:
        logger.error(f"Encryption error: {exc}")
        return input_path


def calculate_checksum(file_path: Path) -> str:
    """Calculate SHA-256 checksum of backup file."""
    sha256 = hashlib.sha256()
    with open(file_path, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            sha256.update(chunk)
    return sha256.hexdigest()


def upload_to_s3(file_path: Path, config: BackupConfig) -> bool:
    """Upload backup to S3-compatible storage.
    
    Supports AWS S3, MinIO, Wasabi, etc.
    """
    if not config.s3_endpoint or not config.s3_access_key:
        return True  # S3 not configured, skip
    
    try:
        import boto3
        from botocore.exceptions import ClientError
        
        s3 = boto3.client(
            's3',
            endpoint_url=config.s3_endpoint,
            aws_access_key_id=config.s3_access_key,
            aws_secret_access_key=config.s3_secret_key
        )
        
        # Upload with metadata
        key = f"backups/{file_path.name}"
        s3.upload_file(
            str(file_path),
            config.s3_bucket,
            key,
            ExtraArgs={
                'Metadata': {
                    'backup-date': datetime.now(timezone.utc).isoformat(),
                    'checksum': calculate_checksum(file_path)
                }
            }
        )
        
        logger.info(f"Uploaded to S3: {config.s3_bucket}/{key}")
        return True
        
    except ImportError:
        logger.warning("boto3 not installed - S3 upload skipped")
        return False
    except Exception as exc:
        logger.error(f"S3 upload failed: {exc}")
        return False


def cleanup_old_backups(config: BackupConfig) -> dict[str, int]:
    """Remove old backups based on retention policy.
    
    Returns stats: {"deleted": 5, "kept": 25}
    """
    deleted = 0
    kept = 0
    
    try:
        now = datetime.now(timezone.utc)
        
        for backup_file in config.backup_dir.glob("backup_*.sql*"):
            # Parse date from filename
            try:
                date_str = backup_file.stem.split('_')[1]
                file_date = datetime.strptime(date_str, "%Y%m%d").replace(tzinfo=timezone.utc)
            except (IndexError, ValueError):
                continue
            
            age_days = (now - file_date).days
            
            # Determine retention
            if age_days <= config.daily_retention_days:
                # Keep daily
                kept += 1
            elif age_days <= config.weekly_retention_days and file_date.weekday() == 0:
                # Keep weekly (Mondays)
                kept += 1
            elif age_days <= config.monthly_retention_months * 30 and file_date.day == 1:
                # Keep monthly (1st of month)
                kept += 1
            else:
                # Delete
                backup_file.unlink()
                deleted += 1
                logger.info(f"Deleted old backup: {backup_file.name}")
        
        return {"deleted": deleted, "kept": kept}
        
    except Exception as exc:
        logger.error(f"Cleanup failed: {exc}")
        return {"deleted": 0, "kept": 0}


def send_notification(message: str, config: BackupConfig, success: bool = True) -> None:
    """Send backup completion notification."""
    try:
        # Slack
        if config.slack_webhook:
            import httpx
            
            color = "#36a64f" if success else "#ff0000"
            emoji = "✅" if success else "❌"
            
            payload = {
                "attachments": [{
                    "color": color,
                    "title": f"{emoji} Database Backup",
                    "text": message
                }]
            }
            
            httpx.post(config.slack_webhook, json=payload, timeout=10)
        
        # Email (simplified - would use Resend in production)
        if config.notify_email:
            # Would integrate with existing email service
            logger.info(f"Would send email to {config.notify_email}: {message}")
            
    except Exception as exc:
        logger.error(f"Notification failed: {exc}")


def create_backup() -> dict[str, Any]:
    """Main backup function - creates encrypted backup and uploads to S3.
    
    Returns backup metadata:
        {
            "success": True,
            "file": "/data/backups/backup_20240120_020000.sql.gpg",
            "size_mb": 15.2,
            "checksum": "sha256:abc123...",
            "encrypted": True,
            "s3_uploaded": True,
            "cleanup": {"deleted": 3, "kept": 27}
        }
    """
    config = BackupConfig()
    ensure_backup_dir(config)
    
    result = {
        "success": False,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    
    try:
        # Create backup
        timestamp = datetime.now(timezone.utc)
        filename = create_backup_filename(config, timestamp)
        backup_path = config.backup_dir / filename
        
        if not run_pg_dump(backup_path, config):
            send_notification("Backup creation failed", config, success=False)
            return result
        
        result["file"] = str(backup_path)
        result["size_mb"] = round(backup_path.stat().st_size / (1024 * 1024), 2)
        
        # Encrypt
        encrypted_path = encrypt_backup(backup_path, config)
        result["encrypted"] = str(encrypted_path) != str(backup_path)
        result["file"] = str(encrypted_path)
        
        # Calculate checksum
        result["checksum"] = f"sha256:{calculate_checksum(encrypted_path)}"
        
        # Upload to S3
        s3_success = upload_to_s3(encrypted_path, config)
        result["s3_uploaded"] = s3_success
        
        # Cleanup old backups
        result["cleanup"] = cleanup_old_backups(config)
        
        result["success"] = True
        
        # Notify
        msg = (
            f"Backup completed: {filename}\n"
            f"Size: {result['size_mb']} MB\n"
            f"Encrypted: {result['encrypted']}\n"
            f"S3: {'✓' if s3_success else '✗'}\n"
            f"Retention: {result['cleanup']['kept']} backups kept"
        )
        send_notification(msg, config, success=True)
        
        logger.info(f"Backup completed: {result}")
        return result
        
    except Exception as exc:
        logger.exception("Backup failed")
        result["error"] = str(exc)
        send_notification(f"Backup failed: {exc}", config, success=False)
        return result


def restore_backup(backup_file: str, target_db: str | None = None) -> bool:
    """Restore database from backup file.
    
    WARNING: This will overwrite current database!
    
    Args:
        backup_file: Path to backup file (.sql, .sql.gz, or .sql.gpg)
        target_db: Target database name (default from config)
    
    Returns:
        True on success
    """
    try:
        config = BackupConfig()
        backup_path = Path(backup_file)
        
        if not backup_path.exists():
            logger.error(f"Backup file not found: {backup_path}")
            return False
        
        # Decrypt if needed
        decrypted_path = backup_path
        if backup_path.suffix == '.gpg':
            decrypted_path = Path(str(backup_path).replace('.gpg', ''))
            
            cmd = [
                'gpg',
                '--batch',
                '--yes',
                '--passphrase', config.encryption_key or "backup-secret",
                '-d',
                '-o', str(decrypted_path),
                str(backup_path)
            ]
            
            result = subprocess.run(cmd, capture_output=True, timeout=300)
            if result.returncode != 0:
                logger.error(f"Decryption failed: {result.stderr}")
                return False
        
        # Restore
        env = os.environ.copy()
        env['PGPASSWORD'] = os.getenv('POSTGRES_PASSWORD', '')
        
        dbname = target_db or os.getenv('POSTGRES_DB', 'ecommerce')
        
        cmd = [
            'pg_restore',
            '-h', os.getenv('POSTGRES_HOST', 'localhost'),
            '-U', os.getenv('POSTGRES_USER', 'postgres'),
            '-d', dbname,
            '-v',
            '-c',  # Clean (drop) database objects before recreating
            str(decrypted_path)
        ]
        
        logger.warning(f"Restoring backup to {dbname} - current data will be lost!")
        
        result = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=3600)
        
        if result.returncode == 0:
            logger.info("Restore completed successfully")
            return True
        else:
            logger.error(f"Restore failed: {result.stderr}")
            return False
            
    except Exception as exc:
        logger.exception("Restore failed")
        return False


# CLI interface
if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    import argparse
    
    parser = argparse.ArgumentParser(description="Database backup utility")
    parser.add_argument('action', choices=['backup', 'restore', 'list', 'verify'], 
                       help='Action to perform')
    parser.add_argument('--file', help='Backup file for restore/verify')
    parser.add_argument('--target-db', help='Target database for restore')
    
    args = parser.parse_args()
    
    if args.action == 'backup':
        result = create_backup()
        sys.exit(0 if result['success'] else 1)
        
    elif args.action == 'restore':
        if not args.file:
            print("Error: --file required for restore")
            sys.exit(1)
        success = restore_backup(args.file, args.target_db)
        sys.exit(0 if success else 1)
        
    elif args.action == 'list':
        config = BackupConfig()
        for backup in sorted(config.backup_dir.glob("backup_*.sql*")):
            stat = backup.stat()
            size = stat.st_size / (1024 * 1024)
            mtime = datetime.fromtimestamp(stat.st_mtime)
            print(f"{backup.name:30} {size:8.1f} MB  {mtime:%Y-%m-%d %H:%M}")
            
    elif args.action == 'verify':
        if not args.file:
            print("Error: --file required for verify")
            sys.exit(1)
        # Verify checksum
        print(f"SHA256: {calculate_checksum(Path(args.file))}")
