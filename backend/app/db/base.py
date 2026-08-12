from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Declarative base every ORM model inherits from."""


# Importing the models here keeps `Base.metadata` complete for Alembic
# autogenerate. Add one line per model module.
from app.db import models  # noqa: E402,F401
