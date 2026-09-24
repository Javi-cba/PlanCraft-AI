"""
CLI of the seed: `python -m app.db.seeds`.

This is the only place in the package that opens a session and commits. The
transaction wraps the whole run — the delete and every insert — so a failure
halfway leaves the database exactly as it was, and `--dry-run` is simply the
same run rolled back at the end.
"""

import argparse
import sys

from sqlalchemy.orm import Session

from app.db.seeds.mock_data import MOCK_PROJECTS, MOCK_USER_PREFIX
from app.db.seeds.seeder import SeedReport, purge_mock_data, seed_mock_data
from app.db.session import SessionLocal


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m app.db.seeds",
        description=(
            "Escribe el catálogo público de demo (proyectos de usuarios "
            f"ficticios, todos bajo el prefijo {MOCK_USER_PREFIX!r}). Es "
            "idempotente: borra los que ya están y los vuelve a insertar."
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Corre todo y hace rollback al final. No escribe nada.",
    )
    parser.add_argument(
        "--purge",
        action="store_true",
        help="Solo borra los datos de demo, sin volver a insertarlos.",
    )
    args = parser.parse_args(argv)

    with SessionLocal() as db:
        if args.purge:
            deleted = purge_mock_data(db)
            _finish(db, args.dry_run)
            print(f"Borrados {deleted} proyectos de demo.")
            return 0

        report = seed_mock_data(db)
        _print_catalogue(db)
        _finish(db, args.dry_run)
        _print_report(report, args.dry_run)

    return 0


def _finish(db: Session, dry_run: bool) -> None:
    if dry_run:
        db.rollback()
    else:
        db.commit()


def _print_catalogue(db: Session) -> None:
    """
    What was written, with the ids the database generated.

    Printed before the commit on purpose: the objects are still attached to the
    session, so reading them costs nothing extra.
    """
    print()
    print("Proyectos de demo")
    print("-" * 78)

    for mock in MOCK_PROJECTS:
        plans = sum(len(floor.plans) for floor in mock.floors)
        elements = sum(
            len(plan.elements) for floor in mock.floors for plan in floor.plans
        )
        print(f"  {mock.name}")
        print(f"    usuario   {mock.owner_name} · {mock.user_id}")
        print(
            f"    contenido {len(mock.floors)} piso(s) · {plans} plano(s) · "
            f"{elements} elemento(s)"
        )

        for floor in mock.floors:
            kinds = ", ".join(plan.installation_type.value for plan in floor.plans)
            print(
                f"      nivel {floor.level:>3}  {floor.name:<16} "
                f"{len(floor.layout.walls):>3} paredes, "
                f"{len(floor.layout.rooms):>2} ambientes  [{kinds}]"
            )
        print()


def _print_report(report: SeedReport, dry_run: bool) -> None:
    print("-" * 78)
    print(
        f"  borrados   {report.deleted_projects} proyecto(s) de demo previos\n"
        f"  insertados {report.projects} proyectos · {report.floors} pisos · "
        f"{report.plans} planos · {report.elements} elementos\n"
        f"  intactos   {report.untouched_projects} proyecto(s) de usuarios reales"
    )
    print("ROLLBACK (--dry-run): no se escribió nada." if dry_run else "Commit hecho.")


if __name__ == "__main__":
    sys.exit(main())
