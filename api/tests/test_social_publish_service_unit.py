"""Unit tests for social_publish_service pure functions.
No network calls or DB access."""
import pytest


# ── _youtube_mime_type ────────────────────────────────────────────────────────

def test_youtube_mime_mp4_default():
    from app.services.social_publish_service import _youtube_mime_type
    assert _youtube_mime_type("https://cdn.example.com/video.mp4") == "video/mp4"


def test_youtube_mime_webm():
    from app.services.social_publish_service import _youtube_mime_type
    assert _youtube_mime_type("https://cdn.example.com/video.webm") == "video/webm"


def test_youtube_mime_mov():
    from app.services.social_publish_service import _youtube_mime_type
    assert _youtube_mime_type("https://cdn.example.com/clip.mov") == "video/quicktime"


def test_youtube_mime_avi():
    from app.services.social_publish_service import _youtube_mime_type
    assert _youtube_mime_type("https://cdn.example.com/clip.avi") == "video/x-msvideo"


def test_youtube_mime_mkv():
    from app.services.social_publish_service import _youtube_mime_type
    assert _youtube_mime_type("https://cdn.example.com/clip.mkv") == "video/x-matroska"


def test_youtube_mime_ignores_query_string():
    from app.services.social_publish_service import _youtube_mime_type
    assert _youtube_mime_type("https://cdn.example.com/video.webm?token=abc") == "video/webm"


def test_youtube_mime_unknown_extension_defaults_mp4():
    from app.services.social_publish_service import _youtube_mime_type
    assert _youtube_mime_type("https://cdn.example.com/video.flv") == "video/mp4"


def test_youtube_mime_no_extension_defaults_mp4():
    from app.services.social_publish_service import _youtube_mime_type
    assert _youtube_mime_type("https://cdn.example.com/video") == "video/mp4"


def test_youtube_mime_uppercase_extension():
    from app.services.social_publish_service import _youtube_mime_type
    assert _youtube_mime_type("https://cdn.example.com/VIDEO.WEBM") == "video/webm"


# ── _make_absolute ────────────────────────────────────────────────────────────

def test_make_absolute_already_absolute_https():
    from app.services.social_publish_service import _make_absolute
    url = "https://cdn.example.com/image.jpg"
    assert _make_absolute(url, "https://store.example.com") == url


def test_make_absolute_already_absolute_http():
    from app.services.social_publish_service import _make_absolute
    url = "http://cdn.example.com/image.jpg"
    assert _make_absolute(url, "https://store.example.com") == url


def test_make_absolute_relative_with_leading_slash():
    from app.services.social_publish_service import _make_absolute
    result = _make_absolute("/images/photo.jpg", "https://store.example.com")
    assert result == "https://store.example.com/images/photo.jpg"


def test_make_absolute_relative_without_leading_slash():
    from app.services.social_publish_service import _make_absolute
    result = _make_absolute("images/photo.jpg", "https://store.example.com")
    assert result == "https://store.example.com/images/photo.jpg"


def test_make_absolute_domain_with_trailing_slash():
    from app.services.social_publish_service import _make_absolute
    result = _make_absolute("/img.jpg", "https://store.example.com/")
    assert result == "https://store.example.com/img.jpg"
    assert "//" not in result.replace("https://", "").replace("http://", "")


def test_make_absolute_no_double_slash():
    from app.services.social_publish_service import _make_absolute
    result = _make_absolute("/img.jpg", "https://store.example.com///")
    # Should not have double slashes between domain and path
    path_part = result.replace("https://", "")
    assert "//" not in path_part


def test_make_absolute_empty_relative():
    from app.services.social_publish_service import _make_absolute
    result = _make_absolute("", "https://store.example.com")
    assert result == "https://store.example.com/"


# ── PublishError ──────────────────────────────────────────────────────────────

def test_publish_error_is_exception():
    from app.services.social_publish_service import PublishError
    err = PublishError("Something went wrong")
    assert isinstance(err, Exception)
    assert "Something went wrong" in str(err)


# ── Threads token refresh SQL placeholder regression ─────────────────────────

def test_threads_token_refresh_uses_postgres_placeholders():
    """Regression: Threads token refresh UPDATE must use $1/$2/$3 (Postgres),
    not ? (SQLite). Using ? causes asyncpg to raise a syntax error at runtime
    when a Threads token expires, silently breaking the refresh path."""
    import inspect
    import app.services.social_publish_service as svc
    source = inspect.getsource(svc)
    # Find the Threads token refresh UPDATE block
    threads_block_start = source.find("Threads token auto-refreshed")
    assert threads_block_start != -1, "Could not locate Threads token refresh log line"
    # Walk back to find the UPDATE statement preceding the log line
    update_start = source.rfind("UPDATE social_connections", 0, threads_block_start)
    assert update_start != -1, "Could not locate Threads token refresh UPDATE statement"
    update_block = source[update_start:threads_block_start]
    assert "?" not in update_block, (
        "Threads token refresh UPDATE uses SQLite '?' placeholder — must use Postgres '$1/$2/$3'"
    )
    assert "$1" in update_block and "$2" in update_block and "$3" in update_block, (
        "Threads token refresh UPDATE must use $1, $2, $3 Postgres placeholders"
    )
