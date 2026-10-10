import os
 
from sqlalchemy import create_engine
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

is_production = (
    os.environ.get("ENVIRONMENT", "").lower() in ("production", "prod")
    or os.environ.get("RENDER") is not None
)

raw_env_url = os.environ.get("DATABASE_URL")

if is_production:
    if not raw_env_url or not raw_env_url.strip():
        raise RuntimeError(
            "CRITICAL: DATABASE_URL environment variable is required in production. "
            "Silent fallback to SQLite is disallowed in production to prevent data loss on ephemeral storage."
        )
    if raw_env_url.strip().startswith("sqlite"):
        raise RuntimeError(
            "CRITICAL: SQLite database is disallowed in production environment. "
            "Please configure a PostgreSQL connection URL via DATABASE_URL."
        )
    _raw_url = raw_env_url.strip()
else:
    _raw_url = raw_env_url.strip() if (raw_env_url and raw_env_url.strip()) else _DEFAULT_URL

# Render and Heroku provide PostgreSQL connection strings starting with postgres://
# SQLAlchemy 1.4+ requires postgresql://
if _raw_url.startswith("postgres://"):
    _raw_url = _raw_url.replace("postgres://", "postgresql://", 1)

SQLALCHEMY_DATABASE_URL = _raw_url

_connect_args = {}
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    _connect_args = {"check_same_thread": False}
 
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args=_connect_args,
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
 
 
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()