import os

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import declarative_base, sessionmaker
 
# ---------------------------------------------------------------------------
# Database configuration
#
# Default: SQLite file (backend/eyecog.db) - no database server or password
# needed, the file is created automatically on first run.
#
# To use PostgreSQL instead, set DATABASE_URL before starting the backend:
#   PowerShell:
#     $env:DATABASE_URL = "postgresql+pg8000://USER:PASSWORD@localhost:5432/eyecog"
#   (URL-encode special characters in the password, e.g. @ -> %40)
# ---------------------------------------------------------------------------
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_DEFAULT_URL = "sqlite:///" + os.path.join(_BASE_DIR, "eyecog.db").replace("\\", "/")
PRIMARY_STUDY_DB_PATH = os.path.realpath(os.path.join(_BASE_DIR, "eyecog.db"))


def extract_canonical_sqlite_path(url_or_path: str | None) -> str | None:
    """Extract and canonicalize the filesystem path of an SQLite database from a URL or raw path."""
    if not url_or_path:
        return None
    s = url_or_path.strip()
    if s.startswith("sqlite:///"):
        s = s[len("sqlite:///"):]
    elif s.startswith("sqlite:////"):
        s = s[len("sqlite:////"):]
    elif s.startswith("sqlite://"):
        s = s[len("sqlite://"):]
    if "?" in s:
        s = s.split("?")[0]
    import urllib.parse
    s = urllib.parse.unquote(s)
    if not s or s == ":memory:":
        return None
    if not os.path.isabs(s):
        s = os.path.join(os.getcwd(), s)
    return os.path.realpath(s)


def is_primary_study_database(url_or_path: str | None) -> bool:
    """Return True if the target URL or path resolves to the protected primary study database."""
    resolved = extract_canonical_sqlite_path(url_or_path)
    if not resolved:
        return False
    return os.path.normcase(resolved) == os.path.normcase(PRIMARY_STUDY_DB_PATH)


is_production = (
    os.environ.get("ENVIRONMENT", "").lower() in ("production", "prod", "staging")
    or os.environ.get("RENDER") is not None
)

is_test_mode = (
    os.environ.get("TEST_MODE", "").lower() in ("true", "1", "yes")
    or os.environ.get("PYTEST_CURRENT_TEST") is not None
)

raw_env_url = os.environ.get("DATABASE_URL")

if is_test_mode:
    if not raw_env_url or not raw_env_url.strip():
        raise RuntimeError(
            "FAIL-CLOSED TEST ISOLATION GUARD: TEST_MODE is active but no isolated test "
            "DATABASE_URL was provided. Refusing silent fallback to the primary study database."
        )
    if is_primary_study_database(raw_env_url):
        raise RuntimeError(
            f"FAIL-CLOSED TEST ISOLATION GUARD: TEST_MODE is active but DATABASE_URL targets "
            f"the protected primary study database ({PRIMARY_STUDY_DB_PATH}). "
            f"Automated test execution against the primary database is strictly prohibited."
        )
    _raw_url = raw_env_url.strip()
elif is_production:
    if not raw_env_url or not raw_env_url.strip():
        raise RuntimeError(
            "CRITICAL: DATABASE_URL environment variable is required in production and staging environments. "
            "Silent fallback to SQLite is disallowed to prevent data loss on ephemeral storage."
        )
    if raw_env_url.strip().startswith("sqlite"):
        raise RuntimeError(
            "CRITICAL: SQLite database is disallowed in production and staging environments. "
            "Please configure a PostgreSQL connection URL via DATABASE_URL."
        )
    _raw_url = raw_env_url.strip()
else:
    _raw_url = raw_env_url.strip() if (raw_env_url and raw_env_url.strip()) else _DEFAULT_URL

# Render and Heroku provide PostgreSQL connection strings starting with postgres://
# SQLAlchemy 1.4+ requires postgresql://
if _raw_url.startswith("postgres://"):
    _raw_url = _raw_url.replace("postgres://", "postgresql://", 1)

# In pure-Python or environments without psycopg/psycopg2, route postgresql:// to the designated pg8000 driver
if _raw_url.startswith("postgresql://"):
    try:
        import psycopg2  # type: ignore
    except ImportError:
        try:
            import psycopg  # type: ignore
        except ImportError:
            _raw_url = _raw_url.replace("postgresql://", "postgresql+pg8000://", 1)

SQLALCHEMY_DATABASE_URL = _raw_url

_connect_args = {}
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    _connect_args = {"check_same_thread": False}
 
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args=_connect_args,
    pool_pre_ping=True,
)
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Enable foreign key constraints for SQLite connections."""
    if type(dbapi_connection).__module__.startswith("sqlite3"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
 
 
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()