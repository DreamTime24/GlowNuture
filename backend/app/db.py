from sqlalchemy import create_engine,event
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from .core.config import get_settings

settings = get_settings()
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

engine = create_engine(settings.database_url, future=True, pool_pre_ping=True, connect_args=connect_args)
if settings.database_url.startswith("sqlite"):
    @event.listens_for(engine,"connect")
    def configure_sqlite(connection,record):
        connection.execute("PRAGMA foreign_keys=ON")
        connection.execute("PRAGMA busy_timeout=15000")
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
