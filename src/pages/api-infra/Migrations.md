---
title: Database migrations
category: api-infra
slug: Migrations
nav_order: 3
---

# Database migrations

Core owns the Alembic revision history in `migrations/versions/`.
The released `projectdavid-orm` package owns the SQLAlchemy model definitions.

Create narrowly scoped revisions and validate them against the exact released
ORM version required by the change.

## Connection configuration

`migrations/env.py` selects the database connection as follows:

| Condition | Connection source |
|---|---|
| `.env.migrations` exists in the Core root | `SPECIAL_DB_URL` in that file |
| `.env.migrations` does not exist | `DATABASE_URL` from the environment |

A missing required value raises an error. The file takes precedence regardless
of whether Alembic runs on the host or in a container.

Keep `.env.migrations` local, out of source control and out of container
filesystems. Use the intended host-mapped MySQL endpoint for host-side
migrations, not the Docker-network hostname.

## Create a revision

1. Test and publish the intended ORM change.
2. Install the exact released ORM version in the migration environment.
3. Check the revision graph and create a narrowly scoped migration with the
   correct `down_revision`.
4. Review explicit DDL and any data backfill. Guard destructive downgrades.
5. Test against a disposable database or an approved local test database
   before promoting the runtime.

```bash
python -m alembic heads
python -m pip show projectdavid-orm
```

Do not accept an unrelated autogenerate diff as part of a migration.

## Apply locally

Core's `ALEMBIC.md` runbook documents the local-only `scripts.db_migrate`
runner. Use an existing local MySQL instance and verify a usable backup
before applying changes.

From the Core repository root, in the migration Python environment:

```powershell
$OrmVersion = Read-Host "Exact released ORM version"
python -m scripts.db_migrate status --env local --orm-version $OrmVersion
python -m scripts.db_migrate plan --env local --orm-version $OrmVersion
```

Confirm the target database, installed ORM provenance and pending revisions.
Review the migration source files in the plan. The plan is not a SQL dry run.

Only after that review:

```powershell
python -m scripts.db_migrate apply --env local --orm-version $OrmVersion
```

The runbook requires interactive, target-specific approval for a non-empty
plan. Do not automate or bypass that approval.

```powershell
python -m scripts.db_migrate verify --env local --orm-version $OrmVersion
```

For a migration that adds or changes a column, include the relevant
`--expect-column table.column` option when verifying.

The local runner is not a production or staging migration procedure.

## SafeDDL helpers

`migrations/utilities/safe_ddl.py` provides MySQL-specific existence checks
and guarded DDL operations.

| Helper | Behaviour |
|---|---|
| `has_table`, `has_column` | Check schema object existence |
| `add_column_if_missing` | Add a column if absent |
| `drop_column_if_exists` | Drop a column if present |
| `safe_alter_column` | Alter an existing column |
| `create_index_if_not_exists` | Create an index if absent |
| `drop_index_if_exists` | Drop an existing index |
| `drop_fk_if_exists` | Drop an existing foreign key |
| `drop_table_if_exists` | Drop an existing table |

Example migration body for a proposed nullable column:

```python
import sqlalchemy as sa
from migrations.utilities.safe_ddl import add_column_if_missing


def upgrade():
    add_column_if_missing(
        "users",
        sa.Column("profile_url", sa.String(255), nullable=True),
    )
```

Existence checks do not establish that an existing column or index has the
correct definition. These helpers do not suppress every database error,
provide transactional rollback, or make destructive DDL safe.

Use fixed, reviewed schema identifiers. Drop dependent foreign keys before
removing their supporting indexes.

## Startup and recovery

The API entrypoint runs `alembic upgrade head` before starting Supervisor.
With `set -e`, a failed migration stops that startup sequence.

Coordinate each deployed database upgrade with the runtime's required
schema. Do not assume that publishing a package or rebuilding an image
upgrades every environment.

MySQL DDL can commit independently of the enclosing migration transaction.
If a migration fails, inspect both the actual schema and Alembic revision.
Do not blindly retry, stamp revisions, reset credentials or delete volumes.

If `alembic check` reports differences, compare the previous and target ORM
metadata with the live schema. Classify unrelated drift separately rather
than generating blanket corrective migrations.

## Reference

- [Core configuration](/docs/core-configuration)
- [Upgrading Core](/docs/core-upgrading)
