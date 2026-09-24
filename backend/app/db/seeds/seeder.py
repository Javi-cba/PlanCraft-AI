"""
Writes the public demo catalogue into the database.

The seed is **idempotent by replacement**: it first deletes every project whose
owner starts with `MOCK_USER_PREFIX` and then inserts the catalogue again, so
running it twice leaves the same rows and not two copies. That prefix is also
the only thing standing between this and real data, so the delete is expressed
as one `startswith` filter and never as "everything" — a real Clerk id cannot
match it, and no row without it is ever selected.

Children go with their project through the `ON DELETE CASCADE` the migration
put on floors → plans → elements, which is why the delete is a single statement
instead of a walk down the tree.
"""

import logging
from dataclasses import dataclass

from sqlalchemy import delete, func, not_, select
from sqlalchemy.orm import Session

from app.db.models.element import Element
from app.db.models.floor import Floor
from app.db.models.plan import Plan
from app.db.models.project import Project
from app.db.seeds.mock_data import MOCK_PROJECTS, MOCK_USER_PREFIX, MockProject

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class SeedReport:
    """What a run did, so the CLI can print it and a test can assert on it."""

    deleted_projects: int
    projects: int
    floors: int
    plans: int
    elements: int
    # Rows that are not part of the seed. Printed on every run: it is the proof
    # that a re-seed left the real accounts alone.
    untouched_projects: int


def is_mock(external_user_id: str) -> bool:
    return external_user_id.startswith(MOCK_USER_PREFIX)


def _mock_filter():
    """
    The one predicate that scopes every write here.

    `autoescape` matters: the prefix contains `_`, which is a LIKE wildcard, so
    without it `user_mock_` would also match `userXmockY` — and a real id is one
    unlucky character away from being deleted.
    """
    return Project.external_user_id.startswith(MOCK_USER_PREFIX, autoescape=True)


def purge_mock_data(db: Session) -> int:
    """Deletes every mock project. Their floors, plans and elements cascade."""
    result = db.execute(delete(Project).where(_mock_filter()))
    return result.rowcount or 0


def count_mock_rows(db: Session) -> dict[str, int]:
    """How much of each table currently belongs to the mock users."""
    mock_projects = select(Project.id).where(_mock_filter()).scalar_subquery()
    mock_floors = (
        select(Floor.id).where(Floor.project_id.in_(mock_projects)).scalar_subquery()
    )
    mock_plans = (
        select(Plan.id).where(Plan.floor_id.in_(mock_floors)).scalar_subquery()
    )

    return {
        "projects": _count(db, Project, Project.id.in_(mock_projects)),
        "floors": _count(db, Floor, Floor.id.in_(mock_floors)),
        "plans": _count(db, Plan, Plan.id.in_(mock_plans)),
        "elements": _count(db, Element, Element.plan_id.in_(mock_plans)),
    }


def seed_mock_data(db: Session, projects=MOCK_PROJECTS) -> SeedReport:
    """
    Replaces the mock catalogue in one transaction.

    Nothing is committed here: the caller owns the transaction, so a seed that
    blows up halfway leaves the database exactly as it was instead of half a
    house.
    """
    for project in projects:
        if not is_mock(project.user_id):
            # Unreachable through `MockProject.user_id`, which always prefixes.
            # Kept because the day someone builds a project a different way, the
            # delete above would not clean it up and this seed stops being safe.
            raise ValueError(
                f"El proyecto {project.name!r} no pertenece a un usuario mock "
                f"({project.user_id!r}). El seed solo escribe bajo "
                f"{MOCK_USER_PREFIX!r}."
            )

    deleted = purge_mock_data(db)

    floors = plans = elements = 0

    for mock in projects:
        db.add(_build(mock))
        floors += len(mock.floors)
        plans += sum(len(floor.plans) for floor in mock.floors)
        elements += sum(
            len(plan.elements) for floor in mock.floors for plan in floor.plans
        )

    db.flush()

    untouched = _count(db, Project, not_(_mock_filter()))

    logger.info(
        "Seed: %d proyectos borrados, %d insertados (%d pisos, %d planos, "
        "%d elementos). Quedaron %d proyectos reales intactos.",
        deleted, len(projects), floors, plans, elements, untouched,
    )

    return SeedReport(
        deleted_projects=deleted,
        projects=len(projects),
        floors=floors,
        plans=plans,
        elements=elements,
        untouched_projects=untouched,
    )


def _build(mock: MockProject) -> Project:
    """
    The whole tree as ORM objects, so one `db.add` cascades all four tables.

    Ids are left to the database: the seed is re-runnable by replacement, and
    fixed ids would mean a re-run collides with the rows it is replacing if the
    delete ever failed to reach them.
    """
    project = Project(
        external_user_id=mock.user_id,
        name=mock.name,
        description=mock.description,
    )

    for mock_floor in mock.floors:
        floor = Floor(
            project=project,
            name=mock_floor.name,
            level=mock_floor.level,
            layout=mock_floor.layout.model_dump(),
        )

        for mock_plan in mock_floor.plans:
            plan = Plan(
                floor=floor,
                name=mock_plan.name,
                installation_type=mock_plan.installation_type,
                canvas_meta=mock_plan.canvas_meta,
            )
            plan.elements = [
                Element(
                    type=mock_element.type,
                    x=mock_element.x,
                    y=mock_element.y,
                    rotation=mock_element.rotation,
                    properties=mock_element.properties,
                )
                for mock_element in mock_plan.elements
            ]

    return project


def _count(db: Session, model, condition) -> int:
    return db.scalar(select(func.count()).select_from(model).where(condition)) or 0
