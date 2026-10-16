from alembic import context
from sqlalchemy import create_engine,pool
from app.core.config import get_settings
from app.db import Base
from app.models import entities
S=get_settings()
if context.is_offline_mode():
    context.configure(url=S.database_url,target_metadata=Base.metadata,literal_binds=True,compare_type=True)
    with context.begin_transaction():context.run_migrations()
else:
    engine=create_engine(S.database_url,poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(connection=connection,target_metadata=Base.metadata,compare_type=True,render_as_batch=connection.dialect.name=="sqlite")
        with context.begin_transaction():context.run_migrations()
