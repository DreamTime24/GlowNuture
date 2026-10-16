# Database

Use the SQLAlchemy models under backend/app/models/entities.py and the versioned Alembic migration in backend/migrations. Production requires PostgreSQL; SQLite is local-only.

See [schema, migration and backup instructions](../docs/DATABASE.md). Do not replace/stamp an existing database without reviewing an explicit data migration and verified backup. No customer database is included.
