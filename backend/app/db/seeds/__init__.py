"""
The public demo catalogue: plans by fictitious users, and the code that writes
them into the database.

    python -m app.db.seeds              # replace the demo data (idempotent)
    python -m app.db.seeds --dry-run    # print what it would write, touch nothing
    python -m app.db.seeds --purge      # remove the demo data and stop

Everything here is scoped to owners starting with `MOCK_USER_PREFIX`, an id
Clerk cannot issue. No function in this package can read or delete a row that
belongs to a real account.
"""

from app.db.seeds.mock_data import MOCK_PROJECTS, MOCK_USER_PREFIX
from app.db.seeds.seeder import (
    SeedReport,
    count_mock_rows,
    purge_mock_data,
    seed_mock_data,
)

__all__ = [
    "MOCK_PROJECTS",
    "MOCK_USER_PREFIX",
    "SeedReport",
    "count_mock_rows",
    "purge_mock_data",
    "seed_mock_data",
]
