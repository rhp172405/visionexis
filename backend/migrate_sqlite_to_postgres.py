"""
VISIONEXIS — SQLite to PostgreSQL Migration Utility
Transfers historical patient records, assessments, sessions, and gaze events
from local SQLite (eyecog.db) to production PostgreSQL.

Safety Guarantees:
- Opens SQLite database in strictly READ-ONLY mode.
- Never alters, truncates, or deletes the source SQLite database.
- Idempotently copies rows (skips already existing IDs).
- Maintains all foreign key relationships in topological order.
"""

import os
import sys
import argparse
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

import models
from database import Base

def migrate(sqlite_path: str, postgres_url: str):
    if not os.path.exists(sqlite_path):
        print(f"Error: SQLite source database not found at {sqlite_path}")
        sys.exit(1)

    # Normalize PostgreSQL URL
    if postgres_url.startswith("postgres://"):
        postgres_url = postgres_url.replace("postgres://", "postgresql://", 1)

    print("=" * 70)
    print("VISIONEXIS — SQLITE TO POSTGRESQL DATA MIGRATION")
    print("=" * 70)
    print(f"Source SQLite:     {sqlite_path}")
    print(f"Target PostgreSQL: {postgres_url.split('@')[-1] if '@' in postgres_url else 'configured target'}")
    print("-" * 70)

    # SQLite read-only engine
    sqlite_url = "sqlite:///" + os.path.abspath(sqlite_path).replace("\\", "/") + "?mode=ro"
    src_engine = create_engine(sqlite_url)
    SrcSession = sessionmaker(bind=src_engine)

    # PostgreSQL target engine
    tgt_engine = create_engine(postgres_url, pool_pre_ping=True)
    TgtSession = sessionmaker(bind=tgt_engine)

    # Ensure schema exists on target
    print("[1/9] Verifying schema on PostgreSQL target...")
    Base.metadata.create_all(bind=tgt_engine)
    print("  ✓ Schema tables verified.")

    # Tables in topological order of foreign keys
    tables = [
        ("patients", models.Patient),
        ("visual_history", models.VisualHistory),
        ("clinical_findings", models.ClinicalFindings),
        ("assessments", models.Assessment),
        ("sessions", models.TaskSession),
        ("gaze_events", models.GazeEvent),
        ("task_results", models.TaskResult),
        ("reports", models.Report),
    ]

    with SrcSession() as src_db, TgtSession() as tgt_db:
        for idx, (table_name, model_cls) in enumerate(tables, start=2):
            print(f"[{idx}/9] Migrating '{table_name}'...")
            src_rows = src_db.query(model_cls).all()
            if not src_rows:
                print(f"  - No rows in {table_name}. Skipping.")
                continue

            migrated_count = 0
            skipped_count = 0

            for row in src_rows:
                # Check if row exists in target
                exists = tgt_db.get(model_cls, row.id)
                if exists:
                    skipped_count += 1
                    continue

                # Detach and recreate attributes for target session
                data = {c.name: getattr(row, c.name) for c in model_cls.__table__.columns}
                new_row = model_cls(**data)
                tgt_db.add(new_row)
                migrated_count += 1

                # Commit in batches of 500 for high-volume gaze events
                if migrated_count % 500 == 0:
                    tgt_db.commit()

            tgt_db.commit()
            print(f"  ✓ {migrated_count} inserted, {skipped_count} already existed in PostgreSQL.")

    print("\n" + "=" * 70)
    print("MIGRATION COMPLETED SUCCESSFULLY! SQLite source remains untouched.")
    print("=" * 70)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate VISIONEXIS data from SQLite to PostgreSQL")
    parser.add_argument(
        "--sqlite-path",
        default=os.path.join(os.path.dirname(__file__), "eyecog.db"),
        help="Path to local eyecog.db SQLite database",
    )
    parser.add_argument(
        "--postgres-url",
        default=os.environ.get("TARGET_DATABASE_URL") or os.environ.get("DATABASE_URL"),
        help="Target PostgreSQL connection URL",
    )
    args = parser.parse_args()

    if not args.postgres_url or args.postgres_url.startswith("sqlite"):
        print("Error: Target PostgreSQL URL is required.")
        print("Provide via --postgres-url or set TARGET_DATABASE_URL environment variable.")
        sys.exit(1)

    migrate(args.sqlite_path, args.postgres_url)
