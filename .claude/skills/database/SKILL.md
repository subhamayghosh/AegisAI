---
name: database
description: Use when defining SQLAlchemy 2.0 models, writing Alembic migrations, seeding data, or changing the DB schema under backend/src/aegisai/db/ and backend/alembic/.
---
# Database

Use this skill for anything under `backend/src/aegisai/db/` or `backend/alembic/`. Covers SQLAlchemy 2.0 declarative style (`Mapped[...]`, `mapped_column`), async session usage with `AsyncSession`, migration workflow (`alembic revision --autogenerate` → always review the generated SQL before committing), migration file naming (`YYYYMMDD_HHMM_<slug>.py`), and the seed script pattern in `scripts/seed_db.py` for the admin user and demo data. Never edit an already-applied migration — write a new one.

Verify a migration against a throwaway SQLite file before committing:
`DATABASE_URL=sqlite+aiosqlite:///./_check.db alembic upgrade head && alembic check && alembic downgrade -1`
(`alembic check` must report "No new upgrade operations detected"), then
delete the file.

`TZDateTime` normalizes timezone-aware values to UTC on write. SQLite
stores only the wall-clock digits and drops the offset, so a `+05:30`
filter value would otherwise compare as the wrong instant.
