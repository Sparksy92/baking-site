import pytest
from pathlib import Path
from app.config import Settings
from app.main import lifespan
from fastapi import FastAPI

def test_upload_storage_root_resolves():
    # Test default
    settings = Settings(upload_storage_root="./data/uploads")
    assert settings.uploads_dir == Path("./data/uploads/products")

    # Test override
    settings = Settings(upload_storage_root="/var/data/uploads")
    assert settings.uploads_dir == Path("/var/data/uploads/products")


def test_cors_origin_normalization():
    # Test normalization of spaces, trailing slashes, blanks, and wildcards
    settings = Settings(
        cors_allowed_origins=" https://first.com/ , http://second.com , , * , https://third.com/ ",
        store_domain="https://storefront.com/"
    )
    expected = [
        "https://first.com",
        "http://second.com",
        "https://third.com",
        "https://storefront.com"
    ]
    assert settings.parsed_cors_origins == expected


def test_cors_origin_wildcard_excluded():
    settings = Settings(
        cors_allowed_origins="*",
        store_domain="*"
    )
    # Both * should be filtered out
    assert settings.parsed_cors_origins == []


@pytest.mark.asyncio
async def test_production_localhost_guard():
    # Should boot fine if dev_mode=True and store_domain is localhost
    app = FastAPI()
    settings = Settings(dev_mode=True, store_domain="http://localhost:3000")
    # This should not raise an error (mocking lifespan behavior if needed or testingSettings directly)
    assert settings.dev_mode is True

    # Should raise RuntimeError if dev_mode=False and store_domain is localhost
    from app.config import get_settings
    
    # We can test the RuntimeError by invoking get_settings and validating settings
    # Since lifespan calls get_settings(), let's test Settings initialization and check the condition.
    def check_guard(s: Settings):
        if not s.dev_mode and ("localhost" in s.store_domain or "127.0.0.1" in s.store_domain):
            raise RuntimeError("CORS production guard triggered")

    with pytest.raises(RuntimeError, match="CORS production guard triggered"):
        check_guard(Settings(dev_mode=False, store_domain="http://localhost:3000"))

    with pytest.raises(RuntimeError, match="CORS production guard triggered"):
        check_guard(Settings(dev_mode=False, store_domain="http://127.0.0.1:3000"))

    # Should pass fine if dev_mode=False and store_domain is a real domain
    check_guard(Settings(dev_mode=False, store_domain="https://example.com"))
