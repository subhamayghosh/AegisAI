---
name: database
description: Use when defining SQLAlchemy 2.0 models, writing Alembic migrations, seeding data, or changing the DB schema under backend/src/promptshield/db/ and backend/alembic/.
---
# Database

Use this skill for anything under `backend/src/promptshield/db/` or `backend/alembic/`. Covers SQLAlchemy 2.0 declarative style (`Mapped[...]`, `mapped_column`), async session usage with `AsyncSession`, migration workflow (`alembic revision --autogenerate` → always review the generated SQL before committing), migration file naming (`YYYYMMDD_HHMM_<slug>.py`), and the seed script pattern in `scripts/seed_db.py` for the admin user and demo data. Never edit an already-applied migration — write a new one.
