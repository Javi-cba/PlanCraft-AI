"""
The public demo catalogue: six projects by six fictitious users.

These are the plans anyone can be shown without touching a real account. The
database has no visibility column, so "public" here is a convention and not a
flag: every project below belongs to an `external_user_id` starting with
`MOCK_USER_PREFIX`, which is an id Clerk can never issue. That prefix is the
whole contract — it is what the seeder deletes before re-inserting, and what
guarantees a re-run cannot reach a real user's rows.

Everything is declarative: this module builds no database objects and opens no
session. `seeder.py` is what turns it into rows.

Coordinates are in centimetres, +y down, like the rest of the layout code. No
element is placed with a bare pair of numbers — they all go through `spot()`,
so a light stays in the middle of its room even if the room moves.
"""

from collections.abc import Sequence
from dataclasses import dataclass, field

from app.db.models.plan import InstallationType
from app.db.seeds.layouts import Rect, build_layout, door, spot, window
from app.schemas.layout import Layout

# An id Clerk cannot mint (its own are `user_<base58>`), so nothing here can
# ever collide with — or be mistaken for — a real account.
MOCK_USER_PREFIX = "user_mock_"


@dataclass(frozen=True, slots=True)
class MockElement:
    """One symbol on a plan: a socket, a light, a valve, a run of pipe."""

    type: str
    x: float
    y: float
    rotation: float = 0.0
    properties: dict = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class MockPlan:
    """One installation drawn over a storey."""

    name: str
    installation_type: InstallationType
    canvas_meta: dict = field(default_factory=dict)
    elements: Sequence[MockElement] = ()


@dataclass(frozen=True, slots=True)
class MockFloor:
    """A storey: its drawing, plus the installations traced over it."""

    name: str
    level: int
    layout: Layout
    plans: Sequence[MockPlan] = ()


@dataclass(frozen=True, slots=True)
class MockProject:
    """A whole project, owner included."""

    # Without the prefix — `user_id` puts it on, so no entry can forget it.
    owner_slug: str
    owner_name: str
    name: str
    description: str
    floors: Sequence[MockFloor] = ()

    @property
    def user_id(self) -> str:
        return f"{MOCK_USER_PREFIX}{self.owner_slug}"


def element(
    type_: str, point: tuple[float, float], *, rotation: float = 0.0, **properties
) -> MockElement:
    """`element("outlet", spot(HOUSE, "Cocina", 0.1, 0.9), circuit="TUG1")`."""
    return MockElement(
        type=type_, x=point[0], y=point[1], rotation=rotation, properties=properties
    )


def _canvas(width: float, height: float, scale: int = 50) -> dict:
    """The canvas state the editor opens a plan with. Free-form jsonb."""
    return {"scale": scale, "width": width, "height": height, "grid": 25, "snap": True}


# --- 1. Casa Ferrer — one storey, the three installations ------------------

CASA_FERRER = [
    Rect("Estar comedor", 0, 0, 550, 450),
    Rect("Dormitorio 1", 550, 0, 550, 450),
    Rect("Cocina", 0, 450, 350, 300),
    Rect("Lavadero", 0, 750, 350, 150),
    Rect("Pasillo", 350, 450, 450, 150),
    Rect("Baño", 800, 450, 300, 150),
    Rect("Dormitorio 2", 350, 600, 350, 300),
    Rect("Dormitorio 3", 700, 600, 400, 300),
]

CASA_FERRER_LAYOUT = build_layout(
    CASA_FERRER,
    [
        door(0, 225, 95),
        door(450, 450, 110),
        door(650, 450, 85),
        door(175, 450, 100),
        door(175, 750, 80),
        door(800, 525, 75),
        door(500, 600, 85),
        door(750, 600, 85),
        window(275, 0, 220),
        window(825, 0, 180),
        window(0, 600, 100),
        window(0, 825, 60),
        window(1100, 525, 60),
        window(500, 900, 150),
        window(900, 900, 150),
    ],
    thickness=20.0,
)

_CASA_FERRER_ELECTRICAL = [
    element("panel", spot(CASA_FERRER, "Pasillo", 0.05, 0.3),
            breakers=8, main_breaker_a=40, differential_ma=30, phases=1),
    element("light", spot(CASA_FERRER, "Estar comedor"), circuit="IUG1", lumens=1800),
    element("light", spot(CASA_FERRER, "Dormitorio 1"), circuit="IUG1", lumens=1200),
    element("light", spot(CASA_FERRER, "Cocina"), circuit="IUG1", lumens=1400),
    element("light", spot(CASA_FERRER, "Lavadero"), circuit="IUG1", lumens=800),
    element("light", spot(CASA_FERRER, "Pasillo"), circuit="IUG1", lumens=600),
    element("light", spot(CASA_FERRER, "Baño"), circuit="IUG1", lumens=900),
    element("light", spot(CASA_FERRER, "Dormitorio 2"), circuit="IUG1", lumens=1200),
    element("light", spot(CASA_FERRER, "Dormitorio 3"), circuit="IUG1", lumens=1200),
    element("switch", spot(CASA_FERRER, "Estar comedor", 0.04, 0.45),
            gang=2, kind="combinacion", circuit="IUG1"),
    element("switch", spot(CASA_FERRER, "Dormitorio 1", 0.04, 0.9),
            gang=1, kind="simple", circuit="IUG1"),
    element("switch", spot(CASA_FERRER, "Cocina", 0.9, 0.04),
            gang=1, kind="simple", circuit="IUG1"),
    element("switch", spot(CASA_FERRER, "Pasillo", 0.2, 0.9),
            gang=2, kind="combinacion", circuit="IUG1"),
    element("switch", spot(CASA_FERRER, "Baño", 0.05, 0.9),
            gang=1, kind="simple", circuit="IUG1"),
    element("switch", spot(CASA_FERRER, "Dormitorio 2", 0.9, 0.06),
            gang=1, kind="simple", circuit="IUG1"),
    element("switch", spot(CASA_FERRER, "Dormitorio 3", 0.06, 0.06),
            gang=1, kind="simple", circuit="IUG1"),
    element("outlet", spot(CASA_FERRER, "Estar comedor", 0.15, 0.04),
            circuit="TUG1", amperage=10, height_cm=30),
    element("outlet", spot(CASA_FERRER, "Estar comedor", 0.85, 0.04),
            circuit="TUG1", amperage=10, height_cm=30),
    element("outlet", spot(CASA_FERRER, "Estar comedor", 0.04, 0.8),
            circuit="TUG1", amperage=10, height_cm=30),
    element("outlet", spot(CASA_FERRER, "Dormitorio 1", 0.2, 0.95),
            circuit="TUG1", amperage=10, height_cm=30),
    element("outlet", spot(CASA_FERRER, "Dormitorio 1", 0.8, 0.95),
            circuit="TUG1", amperage=10, height_cm=30),
    element("outlet", spot(CASA_FERRER, "Cocina", 0.2, 0.08),
            circuit="TUE1", amperage=20, height_cm=110, label="Mesada"),
    element("outlet", spot(CASA_FERRER, "Cocina", 0.6, 0.08),
            circuit="TUE1", amperage=20, height_cm=110, label="Mesada"),
    element("outlet", spot(CASA_FERRER, "Cocina", 0.9, 0.55),
            circuit="TUE1", amperage=20, height_cm=30, label="Heladera"),
    element("outlet", spot(CASA_FERRER, "Lavadero", 0.85, 0.3),
            circuit="TUE2", amperage=20, height_cm=110, label="Lavarropas"),
    element("outlet", spot(CASA_FERRER, "Dormitorio 2", 0.15, 0.95),
            circuit="TUG2", amperage=10, height_cm=30),
    element("outlet", spot(CASA_FERRER, "Dormitorio 3", 0.85, 0.95),
            circuit="TUG2", amperage=10, height_cm=30),
    element("wall_light", spot(CASA_FERRER, "Baño", 0.5, 0.15),
            circuit="IUG1", lumens=500, mount="wall"),
    element("data_jack", spot(CASA_FERRER, "Estar comedor", 0.5, 0.04),
            kind="rj45", category="cat6"),
]

_CASA_FERRER_SANITARY = [
    element("water_meter", spot(CASA_FERRER, "Lavadero", 0.1, 0.85),
            diameter_mm=19, system="agua fría"),
    element("water_heater", spot(CASA_FERRER, "Lavadero", 0.8, 0.8),
            liters=80, fuel="gas", system="agua caliente"),
    element("toilet", spot(CASA_FERRER, "Baño", 0.2, 0.5),
            rotation=90, drain_mm=110, system="desagüe cloacal"),
    element("sink", spot(CASA_FERRER, "Baño", 0.55, 0.2),
            drain_mm=40, supply_mm=13, system="agua fría/caliente"),
    element("shower", spot(CASA_FERRER, "Baño", 0.85, 0.5),
            drain_mm=50, supply_mm=13, system="agua fría/caliente"),
    element("kitchen_sink", spot(CASA_FERRER, "Cocina", 0.35, 0.1),
            drain_mm=50, supply_mm=13, basins=2),
    element("laundry_sink", spot(CASA_FERRER, "Lavadero", 0.45, 0.2),
            drain_mm=50, supply_mm=13),
    element("washing_machine", spot(CASA_FERRER, "Lavadero", 0.75, 0.25),
            drain_mm=40, supply_mm=13),
    element("floor_drain", spot(CASA_FERRER, "Baño", 0.75, 0.8),
            kind="pileta de patio", drain_mm=110),
    element("floor_drain", spot(CASA_FERRER, "Lavadero", 0.15, 0.55),
            kind="rejilla", drain_mm=63),
    element("inspection_chamber", spot(CASA_FERRER, "Lavadero", 0.5, 0.9),
            kind="cámara de inspección", size_cm=60),
    element("pipe", spot(CASA_FERRER, "Baño", 0.2, 0.75),
            rotation=180, length_cm=310, diameter_mm=110,
            material="PVC", system="desagüe cloacal"),
    element("pipe", spot(CASA_FERRER, "Cocina", 0.35, 0.15),
            rotation=90, length_cm=240, diameter_mm=50,
            material="PVC", system="desagüe primario"),
]

_CASA_FERRER_GAS = [
    element("gas_meter", spot(CASA_FERRER, "Lavadero", 0.08, 0.15),
            kind="G-4", capacity_m3_h=6.0),
    element("gas_valve", spot(CASA_FERRER, "Lavadero", 0.3, 0.15),
            kind="llave de paso", diameter_mm=19),
    element("gas_stove", spot(CASA_FERRER, "Cocina", 0.65, 0.12),
            consumption_kcal_h=9000, burners=4, oven=True),
    element("water_heater", spot(CASA_FERRER, "Lavadero", 0.8, 0.8),
            consumption_kcal_h=7500, liters=80, vent="tiro natural"),
    element("heater", spot(CASA_FERRER, "Estar comedor", 0.5, 0.95),
            consumption_kcal_h=5000, vent="tiro balanceado"),
    element("heater", spot(CASA_FERRER, "Dormitorio 1", 0.5, 0.06),
            consumption_kcal_h=3000, vent="tiro balanceado"),
    element("gas_valve", spot(CASA_FERRER, "Cocina", 0.65, 0.2),
            kind="llave de paso", diameter_mm=13),
    element("pipe", spot(CASA_FERRER, "Lavadero", 0.3, 0.15),
            rotation=0, length_cm=290, diameter_mm=19,
            material="epoxi", system="gas natural"),
    element("pipe", spot(CASA_FERRER, "Cocina", 0.65, 0.5),
            rotation=270, length_cm=180, diameter_mm=13,
            material="epoxi", system="gas natural"),
]

# --- 2. Loft Güemes — a studio on the second floor -------------------------

LOFT_GUEMES = [
    Rect("Ambiente principal", 0, 0, 500, 500),
    Rect("Cocina", 500, 0, 200, 250),
    Rect("Baño", 500, 250, 200, 250),
]

LOFT_GUEMES_LAYOUT = build_layout(
    LOFT_GUEMES,
    [
        door(0, 250, 95),
        door(500, 125, 100),
        door(500, 375, 75),
        window(250, 0, 180),
        window(700, 125, 90),
        window(700, 375, 60),
    ],
)

_LOFT_ELECTRICAL = [
    element("panel", spot(LOFT_GUEMES, "Ambiente principal", 0.05, 0.1),
            breakers=4, main_breaker_a=25, differential_ma=30, phases=1),
    element("light", spot(LOFT_GUEMES, "Ambiente principal", 0.35, 0.35),
            circuit="IUG1", lumens=1600),
    element("light", spot(LOFT_GUEMES, "Ambiente principal", 0.7, 0.75),
            circuit="IUG1", lumens=1200),
    element("light", spot(LOFT_GUEMES, "Cocina"), circuit="IUG1", lumens=1000),
    element("light", spot(LOFT_GUEMES, "Baño"), circuit="IUG1", lumens=900),
    element("switch", spot(LOFT_GUEMES, "Ambiente principal", 0.04, 0.42),
            gang=2, kind="simple", circuit="IUG1"),
    element("switch", spot(LOFT_GUEMES, "Cocina", 0.08, 0.6),
            gang=1, kind="simple", circuit="IUG1"),
    element("switch", spot(LOFT_GUEMES, "Baño", 0.08, 0.6),
            gang=1, kind="simple", circuit="IUG1"),
    element("outlet", spot(LOFT_GUEMES, "Ambiente principal", 0.2, 0.04),
            circuit="TUG1", amperage=10, height_cm=30),
    element("outlet", spot(LOFT_GUEMES, "Ambiente principal", 0.75, 0.04),
            circuit="TUG1", amperage=10, height_cm=30),
    element("outlet", spot(LOFT_GUEMES, "Ambiente principal", 0.04, 0.8),
            circuit="TUG1", amperage=10, height_cm=30),
    element("outlet", spot(LOFT_GUEMES, "Ambiente principal", 0.9, 0.9),
            circuit="TUG1", amperage=10, height_cm=30),
    element("outlet", spot(LOFT_GUEMES, "Cocina", 0.5, 0.1),
            circuit="TUE1", amperage=20, height_cm=110, label="Mesada"),
    element("outlet", spot(LOFT_GUEMES, "Cocina", 0.85, 0.85),
            circuit="TUE1", amperage=20, height_cm=30, label="Heladera"),
    element("wall_light", spot(LOFT_GUEMES, "Baño", 0.5, 0.12),
            circuit="IUG1", lumens=450, mount="wall"),
    element("data_jack", spot(LOFT_GUEMES, "Ambiente principal", 0.5, 0.96),
            kind="rj45", category="cat6"),
]

_LOFT_SANITARY = [
    element("water_heater", spot(LOFT_GUEMES, "Baño", 0.85, 0.15),
            liters=50, fuel="eléctrico", system="agua caliente"),
    element("toilet", spot(LOFT_GUEMES, "Baño", 0.25, 0.75),
            rotation=270, drain_mm=110, system="desagüe cloacal"),
    element("sink", spot(LOFT_GUEMES, "Baño", 0.25, 0.3),
            drain_mm=40, supply_mm=13, system="agua fría/caliente"),
    element("shower", spot(LOFT_GUEMES, "Baño", 0.7, 0.6),
            drain_mm=50, supply_mm=13, system="agua fría/caliente"),
    element("kitchen_sink", spot(LOFT_GUEMES, "Cocina", 0.5, 0.2),
            drain_mm=50, supply_mm=13, basins=1),
    element("washing_machine", spot(LOFT_GUEMES, "Cocina", 0.8, 0.5),
            drain_mm=40, supply_mm=13),
    element("floor_drain", spot(LOFT_GUEMES, "Baño", 0.5, 0.9),
            kind="rejilla", drain_mm=63),
    element("pipe", spot(LOFT_GUEMES, "Baño", 0.25, 0.75),
            rotation=90, length_cm=110, diameter_mm=110,
            material="PVC", system="desagüe cloacal"),
]

# --- 3. Dúplex Los Álamos — two storeys ------------------------------------

DUPLEX_PB = [
    Rect("Estar comedor", 0, 0, 500, 450),
    Rect("Cocina", 500, 0, 300, 450),
    Rect("Escalera", 0, 450, 250, 250),
    Rect("Toilette", 250, 450, 250, 250),
    Rect("Lavadero", 500, 450, 300, 250),
]

DUPLEX_PB_LAYOUT = build_layout(
    DUPLEX_PB,
    [
        door(0, 225, 95),
        door(500, 225, 100),
        door(125, 450, 120),
        door(375, 450, 75),
        door(500, 575, 85),
        window(250, 0, 200),
        window(650, 0, 150),
        window(800, 575, 90),
        window(375, 700, 50),
    ],
    thickness=20.0,
)

DUPLEX_PA = [
    Rect("Dormitorio principal", 0, 0, 450, 400),
    Rect("Dormitorio 2", 450, 0, 350, 400),
    Rect("Escalera", 0, 400, 250, 300),
    Rect("Pasillo", 250, 400, 550, 150),
    Rect("Baño", 250, 550, 300, 150),
    Rect("Placard", 550, 550, 250, 150),
]

DUPLEX_PA_LAYOUT = build_layout(
    DUPLEX_PA,
    [
        door(350, 400, 85),
        door(600, 400, 85),
        door(400, 550, 75),
        door(675, 550, 90),
        door(250, 475, 120),
        window(225, 0, 180),
        window(625, 0, 150),
        window(400, 700, 60),
        window(0, 550, 90),
    ],
    thickness=20.0,
)

_DUPLEX_PB_ELECTRICAL = [
    element("panel", spot(DUPLEX_PB, "Escalera", 0.85, 0.15),
            breakers=10, main_breaker_a=40, differential_ma=30, phases=1,
            label="Tablero general"),
    element("light", spot(DUPLEX_PB, "Estar comedor", 0.35, 0.4),
            circuit="IUG1", lumens=1600),
    element("light", spot(DUPLEX_PB, "Estar comedor", 0.75, 0.75),
            circuit="IUG1", lumens=1200),
    element("light", spot(DUPLEX_PB, "Cocina"), circuit="IUG1", lumens=1400),
    element("light", spot(DUPLEX_PB, "Escalera"), circuit="IUG2", lumens=900),
    element("light", spot(DUPLEX_PB, "Toilette"), circuit="IUG1", lumens=700),
    element("light", spot(DUPLEX_PB, "Lavadero"), circuit="IUG1", lumens=900),
    element("switch", spot(DUPLEX_PB, "Estar comedor", 0.04, 0.4),
            gang=2, kind="simple", circuit="IUG1"),
    element("switch", spot(DUPLEX_PB, "Escalera", 0.15, 0.08),
            gang=1, kind="combinacion", circuit="IUG2", pairs_with="planta alta"),
    element("switch", spot(DUPLEX_PB, "Cocina", 0.08, 0.1),
            gang=1, kind="simple", circuit="IUG1"),
    element("switch", spot(DUPLEX_PB, "Toilette", 0.1, 0.08),
            gang=1, kind="simple", circuit="IUG1"),
    element("outlet", spot(DUPLEX_PB, "Estar comedor", 0.2, 0.04),
            circuit="TUG1", amperage=10, height_cm=30),
    element("outlet", spot(DUPLEX_PB, "Estar comedor", 0.8, 0.04),
            circuit="TUG1", amperage=10, height_cm=30),
    element("outlet", spot(DUPLEX_PB, "Estar comedor", 0.04, 0.85),
            circuit="TUG1", amperage=10, height_cm=30),
    element("outlet", spot(DUPLEX_PB, "Cocina", 0.5, 0.08),
            circuit="TUE1", amperage=20, height_cm=110, label="Mesada"),
    element("outlet", spot(DUPLEX_PB, "Cocina", 0.85, 0.5),
            circuit="TUE1", amperage=20, height_cm=30, label="Heladera"),
    element("outlet", spot(DUPLEX_PB, "Lavadero", 0.25, 0.85),
            circuit="TUE2", amperage=20, height_cm=110, label="Lavarropas"),
    element("outlet", spot(DUPLEX_PB, "Lavadero", 0.75, 0.85),
            circuit="TUE2", amperage=20, height_cm=110, label="Secarropas"),
    element("data_jack", spot(DUPLEX_PB, "Estar comedor", 0.5, 0.95),
            kind="rj45", category="cat6"),
]

_DUPLEX_PB_SANITARY = [
    element("water_meter", spot(DUPLEX_PB, "Lavadero", 0.9, 0.12),
            diameter_mm=19, system="agua fría"),
    element("water_heater", spot(DUPLEX_PB, "Lavadero", 0.6, 0.15),
            liters=110, fuel="gas", system="agua caliente"),
    element("toilet", spot(DUPLEX_PB, "Toilette", 0.3, 0.7),
            rotation=90, drain_mm=110, system="desagüe cloacal"),
    element("sink", spot(DUPLEX_PB, "Toilette", 0.72, 0.25),
            drain_mm=40, supply_mm=13, system="agua fría/caliente"),
    element("kitchen_sink", spot(DUPLEX_PB, "Cocina", 0.5, 0.15),
            drain_mm=50, supply_mm=13, basins=2),
    element("laundry_sink", spot(DUPLEX_PB, "Lavadero", 0.25, 0.25),
            drain_mm=50, supply_mm=13),
    element("washing_machine", spot(DUPLEX_PB, "Lavadero", 0.25, 0.75),
            drain_mm=40, supply_mm=13),
    element("floor_drain", spot(DUPLEX_PB, "Lavadero", 0.5, 0.5),
            kind="pileta de patio", drain_mm=110),
    element("inspection_chamber", spot(DUPLEX_PB, "Lavadero", 0.85, 0.85),
            kind="cámara de inspección", size_cm=60),
    element("pipe", spot(DUPLEX_PB, "Toilette", 0.3, 0.7),
            rotation=0, length_cm=270, diameter_mm=110,
            material="PVC", system="desagüe cloacal"),
    element("pipe", spot(DUPLEX_PB, "Cocina", 0.5, 0.5),
            rotation=90, length_cm=200, diameter_mm=50,
            material="PVC", system="desagüe primario"),
]

_DUPLEX_PB_GAS = [
    element("gas_meter", spot(DUPLEX_PB, "Lavadero", 0.12, 0.12),
            kind="G-4", capacity_m3_h=6.0),
    element("gas_valve", spot(DUPLEX_PB, "Lavadero", 0.4, 0.12),
            kind="llave de paso", diameter_mm=19),
    element("gas_stove", spot(DUPLEX_PB, "Cocina", 0.5, 0.35),
            consumption_kcal_h=9000, burners=4, oven=True),
    element("water_heater", spot(DUPLEX_PB, "Lavadero", 0.6, 0.15),
            consumption_kcal_h=10500, liters=110, vent="tiro balanceado"),
    element("heater", spot(DUPLEX_PB, "Estar comedor", 0.5, 0.96),
            consumption_kcal_h=5000, vent="tiro balanceado"),
    element("pipe", spot(DUPLEX_PB, "Lavadero", 0.4, 0.12),
            rotation=180, length_cm=230, diameter_mm=19,
            material="epoxi", system="gas natural"),
    element("pipe", spot(DUPLEX_PB, "Escalera", 0.5, 0.5),
            rotation=270, length_cm=430, diameter_mm=19,
            material="epoxi", system="gas natural", note="montante a planta alta"),
]

_DUPLEX_PA_ELECTRICAL = [
    element("panel", spot(DUPLEX_PA, "Pasillo", 0.08, 0.3),
            breakers=6, main_breaker_a=25, differential_ma=30, phases=1,
            label="Tablero seccional"),
    element("light", spot(DUPLEX_PA, "Dormitorio principal"), circuit="IUG1", lumens=1400),
    element("light", spot(DUPLEX_PA, "Dormitorio 2"), circuit="IUG1", lumens=1200),
    element("light", spot(DUPLEX_PA, "Pasillo"), circuit="IUG2", lumens=700),
    element("light", spot(DUPLEX_PA, "Baño"), circuit="IUG1", lumens=900),
    element("light", spot(DUPLEX_PA, "Placard"), circuit="IUG1", lumens=400),
    element("light", spot(DUPLEX_PA, "Escalera"), circuit="IUG2", lumens=900),
    element("switch", spot(DUPLEX_PA, "Escalera", 0.8, 0.12),
            gang=1, kind="combinacion", circuit="IUG2", pairs_with="planta baja"),
    element("switch", spot(DUPLEX_PA, "Dormitorio principal", 0.85, 0.94),
            gang=2, kind="combinacion", circuit="IUG1"),
    element("switch", spot(DUPLEX_PA, "Dormitorio 2", 0.15, 0.94),
            gang=1, kind="simple", circuit="IUG1"),
    element("switch", spot(DUPLEX_PA, "Baño", 0.9, 0.2),
            gang=1, kind="simple", circuit="IUG1"),
    element("outlet", spot(DUPLEX_PA, "Dormitorio principal", 0.2, 0.06),
            circuit="TUG1", amperage=10, height_cm=30),
    element("outlet", spot(DUPLEX_PA, "Dormitorio principal", 0.75, 0.06),
            circuit="TUG1", amperage=10, height_cm=30),
    element("outlet", spot(DUPLEX_PA, "Dormitorio principal", 0.06, 0.6),
            circuit="TUG1", amperage=10, height_cm=30),
    element("outlet", spot(DUPLEX_PA, "Dormitorio 2", 0.25, 0.06),
            circuit="TUG1", amperage=10, height_cm=30),
    element("outlet", spot(DUPLEX_PA, "Dormitorio 2", 0.9, 0.5),
            circuit="TUG1", amperage=10, height_cm=30),
    element("outlet", spot(DUPLEX_PA, "Pasillo", 0.6, 0.2),
            circuit="TUG2", amperage=10, height_cm=30),
    element("wall_light", spot(DUPLEX_PA, "Baño", 0.5, 0.12),
            circuit="IUG1", lumens=500, mount="wall"),
    element("data_jack", spot(DUPLEX_PA, "Dormitorio principal", 0.5, 0.06),
            kind="rj45", category="cat6"),
]

_DUPLEX_PA_SANITARY = [
    element("toilet", spot(DUPLEX_PA, "Baño", 0.18, 0.6),
            rotation=90, drain_mm=110, system="desagüe cloacal"),
    element("sink", spot(DUPLEX_PA, "Baño", 0.5, 0.22),
            drain_mm=40, supply_mm=13, system="agua fría/caliente"),
    element("bathtub", spot(DUPLEX_PA, "Baño", 0.82, 0.55),
            drain_mm=50, supply_mm=13, length_cm=150),
    element("floor_drain", spot(DUPLEX_PA, "Baño", 0.62, 0.85),
            kind="rejilla", drain_mm=63),
    element("pipe", spot(DUPLEX_PA, "Baño", 0.18, 0.6),
            rotation=90, length_cm=60, diameter_mm=110,
            material="PVC", system="desagüe cloacal", note="baja a planta baja"),
    element("pipe", spot(DUPLEX_PA, "Pasillo", 0.5, 0.5),
            rotation=180, length_cm=300, diameter_mm=19,
            material="polipropileno", system="agua fría"),
]

# --- 4. Oficinas Nodo 47 — a basement and the ground floor -----------------

NODO_SUBSUELO = [
    Rect("Depósito", 0, 0, 600, 400),
    Rect("Sala de máquinas", 600, 0, 300, 220),
    Rect("Baño de servicio", 600, 220, 300, 180),
]

NODO_SUBSUELO_LAYOUT = build_layout(
    NODO_SUBSUELO,
    [
        door(300, 0, 140),
        door(600, 110, 90),
        door(600, 310, 80),
    ],
    thickness=25.0,
)

NODO_PB = [
    Rect("Recepción", 0, 0, 300, 600),
    Rect("Sala de reuniones", 300, 0, 300, 300),
    Rect("Oficina 1", 600, 0, 300, 300),
    Rect("Espacio de trabajo", 300, 300, 600, 300),
]

NODO_PB_LAYOUT = build_layout(
    NODO_PB,
    [
        door(0, 300, 100),
        door(300, 150, 90),
        door(300, 450, 110),
        door(750, 300, 90),
        window(450, 0, 200),
        window(750, 0, 150),
        window(900, 150, 120),
        window(450, 600, 200),
        window(750, 600, 200),
    ],
    thickness=20.0,
)

_NODO_SUBSUELO_ELECTRICAL = [
    element("panel", spot(NODO_SUBSUELO, "Sala de máquinas", 0.15, 0.2),
            breakers=12, main_breaker_a=63, differential_ma=30, phases=3,
            label="Tablero general trifásico"),
    element("light", spot(NODO_SUBSUELO, "Depósito", 0.25, 0.3),
            circuit="IUG1", lumens=2400, mount="ceiling"),
    element("light", spot(NODO_SUBSUELO, "Depósito", 0.75, 0.3),
            circuit="IUG1", lumens=2400, mount="ceiling"),
    element("light", spot(NODO_SUBSUELO, "Depósito", 0.25, 0.75),
            circuit="IUG1", lumens=2400, mount="ceiling"),
    element("light", spot(NODO_SUBSUELO, "Depósito", 0.75, 0.75),
            circuit="IUG1", lumens=2400, mount="ceiling"),
    element("light", spot(NODO_SUBSUELO, "Sala de máquinas"), circuit="IUG1", lumens=1600),
    element("light", spot(NODO_SUBSUELO, "Baño de servicio"), circuit="IUG1", lumens=800),
    element("emergency_light", spot(NODO_SUBSUELO, "Depósito", 0.5, 0.06),
            circuit="IUG2", autonomy_min=90, mount="wall"),
    element("emergency_light", spot(NODO_SUBSUELO, "Sala de máquinas", 0.5, 0.9),
            circuit="IUG2", autonomy_min=90, mount="wall"),
    element("switch", spot(NODO_SUBSUELO, "Depósito", 0.42, 0.06),
            gang=2, kind="simple", circuit="IUG1"),
    element("switch", spot(NODO_SUBSUELO, "Sala de máquinas", 0.08, 0.6),
            gang=1, kind="simple", circuit="IUG1"),
    element("outlet", spot(NODO_SUBSUELO, "Depósito", 0.1, 0.06),
            circuit="TUG1", amperage=10, height_cm=110),
    element("outlet", spot(NODO_SUBSUELO, "Depósito", 0.9, 0.94),
            circuit="TUG1", amperage=10, height_cm=110),
    element("outlet", spot(NODO_SUBSUELO, "Sala de máquinas", 0.5, 0.88),
            circuit="TUE1", amperage=20, height_cm=110, label="Bomba presurizadora"),
    element("smoke_detector", spot(NODO_SUBSUELO, "Depósito", 0.5, 0.5),
            circuit="IUG2", kind="óptico"),
]

_NODO_SUBSUELO_SANITARY = [
    element("water_tank", spot(NODO_SUBSUELO, "Sala de máquinas", 0.7, 0.3),
            liters=1100, system="reserva", material="polietileno"),
    element("pump", spot(NODO_SUBSUELO, "Sala de máquinas", 0.45, 0.72),
            kind="presurizadora", power_hp=0.75, system="agua fría"),
    element("water_meter", spot(NODO_SUBSUELO, "Sala de máquinas", 0.12, 0.72),
            diameter_mm=25, system="agua fría"),
    element("toilet", spot(NODO_SUBSUELO, "Baño de servicio", 0.25, 0.6),
            rotation=90, drain_mm=110, system="desagüe cloacal"),
    element("sink", spot(NODO_SUBSUELO, "Baño de servicio", 0.62, 0.22),
            drain_mm=40, supply_mm=13, system="agua fría"),
    element("floor_drain", spot(NODO_SUBSUELO, "Baño de servicio", 0.75, 0.75),
            kind="rejilla", drain_mm=63),
    element("floor_drain", spot(NODO_SUBSUELO, "Depósito", 0.5, 0.9),
            kind="rejilla", drain_mm=63),
    element("pipe", spot(NODO_SUBSUELO, "Sala de máquinas", 0.45, 0.72),
            rotation=180, length_cm=250, diameter_mm=32,
            material="polipropileno", system="agua fría", note="impulsión al tanque"),
]

_NODO_PB_ELECTRICAL = [
    element("panel", spot(NODO_PB, "Recepción", 0.85, 0.08),
            breakers=10, main_breaker_a=40, differential_ma=30, phases=3,
            label="Tablero seccional planta baja"),
    element("light", spot(NODO_PB, "Recepción", 0.5, 0.25), circuit="IUG1", lumens=1800),
    element("light", spot(NODO_PB, "Recepción", 0.5, 0.75), circuit="IUG1", lumens=1800),
    element("light", spot(NODO_PB, "Sala de reuniones"), circuit="IUG1", lumens=2000),
    element("light", spot(NODO_PB, "Oficina 1"), circuit="IUG1", lumens=1800),
    element("light", spot(NODO_PB, "Espacio de trabajo", 0.25, 0.3),
            circuit="IUG2", lumens=2400),
    element("light", spot(NODO_PB, "Espacio de trabajo", 0.75, 0.3),
            circuit="IUG2", lumens=2400),
    element("light", spot(NODO_PB, "Espacio de trabajo", 0.25, 0.75),
            circuit="IUG2", lumens=2400),
    element("light", spot(NODO_PB, "Espacio de trabajo", 0.75, 0.75),
            circuit="IUG2", lumens=2400),
    element("emergency_light", spot(NODO_PB, "Recepción", 0.5, 0.5),
            circuit="IUG3", autonomy_min=90, mount="wall"),
    element("switch", spot(NODO_PB, "Recepción", 0.1, 0.55),
            gang=2, kind="simple", circuit="IUG1"),
    element("switch", spot(NODO_PB, "Sala de reuniones", 0.06, 0.6),
            gang=1, kind="dimmer", circuit="IUG1"),
    element("switch", spot(NODO_PB, "Espacio de trabajo", 0.06, 0.55),
            gang=2, kind="simple", circuit="IUG2"),
    element("outlet", spot(NODO_PB, "Recepción", 0.15, 0.1),
            circuit="TUG1", amperage=10, height_cm=30),
    element("outlet", spot(NODO_PB, "Recepción", 0.85, 0.9),
            circuit="TUG1", amperage=10, height_cm=30),
    element("outlet", spot(NODO_PB, "Sala de reuniones", 0.5, 0.5),
            circuit="TUG1", amperage=10, height_cm=5, label="Caja de piso"),
    element("outlet", spot(NODO_PB, "Oficina 1", 0.2, 0.9),
            circuit="TUG1", amperage=10, height_cm=30),
    element("outlet", spot(NODO_PB, "Espacio de trabajo", 0.2, 0.08),
            circuit="TUG2", amperage=10, height_cm=30),
    element("outlet", spot(NODO_PB, "Espacio de trabajo", 0.5, 0.08),
            circuit="TUG2", amperage=10, height_cm=30),
    element("outlet", spot(NODO_PB, "Espacio de trabajo", 0.8, 0.08),
            circuit="TUG2", amperage=10, height_cm=30),
    element("outlet", spot(NODO_PB, "Espacio de trabajo", 0.35, 0.92),
            circuit="TUE1", amperage=20, height_cm=30, label="UPS"),
    element("data_jack", spot(NODO_PB, "Espacio de trabajo", 0.2, 0.12),
            kind="rj45", category="cat6a"),
    element("data_jack", spot(NODO_PB, "Espacio de trabajo", 0.5, 0.12),
            kind="rj45", category="cat6a"),
    element("data_jack", spot(NODO_PB, "Espacio de trabajo", 0.8, 0.12),
            kind="rj45", category="cat6a"),
    element("data_jack", spot(NODO_PB, "Sala de reuniones", 0.5, 0.56),
            kind="rj45", category="cat6a", label="Caja de piso"),
    element("smoke_detector", spot(NODO_PB, "Espacio de trabajo", 0.5, 0.5),
            circuit="IUG3", kind="óptico"),
]

_NODO_PB_SANITARY = [
    element("kitchen_sink", spot(NODO_PB, "Espacio de trabajo", 0.92, 0.12),
            drain_mm=50, supply_mm=13, basins=1, label="Kitchenette"),
    element("water_heater", spot(NODO_PB, "Espacio de trabajo", 0.92, 0.3),
            liters=30, fuel="eléctrico", system="agua caliente"),
    element("floor_drain", spot(NODO_PB, "Espacio de trabajo", 0.86, 0.22),
            kind="rejilla", drain_mm=63),
    element("pipe", spot(NODO_PB, "Espacio de trabajo", 0.92, 0.12),
            rotation=90, length_cm=250, diameter_mm=50,
            material="PVC", system="desagüe primario"),
]

# --- 5. Local Av. Colón — a shop -------------------------------------------

LOCAL_COLON = [
    Rect("Salón de ventas", 0, 0, 800, 650),
    Rect("Depósito", 0, 650, 500, 350),
    Rect("Baño", 500, 650, 150, 350),
    Rect("Oficina", 650, 650, 150, 350),
]

LOCAL_COLON_LAYOUT = build_layout(
    LOCAL_COLON,
    [
        door(400, 0, 160),
        door(250, 650, 110),
        door(575, 650, 75),
        door(725, 650, 85),
        window(150, 0, 220),
        window(650, 0, 220),
        window(0, 825, 90),
        window(800, 825, 90),
    ],
    thickness=25.0,
)

_LOCAL_ELECTRICAL = [
    element("panel", spot(LOCAL_COLON, "Depósito", 0.08, 0.15),
            breakers=12, main_breaker_a=63, differential_ma=30, phases=3,
            label="Tablero general"),
    element("light", spot(LOCAL_COLON, "Salón de ventas", 0.2, 0.25),
            circuit="IUG1", lumens=2400, mount="ceiling"),
    element("light", spot(LOCAL_COLON, "Salón de ventas", 0.5, 0.25),
            circuit="IUG1", lumens=2400, mount="ceiling"),
    element("light", spot(LOCAL_COLON, "Salón de ventas", 0.8, 0.25),
            circuit="IUG1", lumens=2400, mount="ceiling"),
    element("light", spot(LOCAL_COLON, "Salón de ventas", 0.2, 0.7),
            circuit="IUG1", lumens=2400, mount="ceiling"),
    element("light", spot(LOCAL_COLON, "Salón de ventas", 0.5, 0.7),
            circuit="IUG1", lumens=2400, mount="ceiling"),
    element("light", spot(LOCAL_COLON, "Salón de ventas", 0.8, 0.7),
            circuit="IUG1", lumens=2400, mount="ceiling"),
    element("light", spot(LOCAL_COLON, "Depósito", 0.3, 0.5), circuit="IUG2", lumens=1800),
    element("light", spot(LOCAL_COLON, "Depósito", 0.75, 0.5), circuit="IUG2", lumens=1800),
    element("light", spot(LOCAL_COLON, "Baño"), circuit="IUG2", lumens=800),
    element("light", spot(LOCAL_COLON, "Oficina"), circuit="IUG2", lumens=1200),
    element("wall_light", spot(LOCAL_COLON, "Salón de ventas", 0.5, 0.04),
            circuit="IUG3", lumens=3000, mount="wall", label="Vidriera"),
    element("emergency_light", spot(LOCAL_COLON, "Salón de ventas", 0.5, 0.96),
            circuit="IUG3", autonomy_min=90, mount="wall"),
    element("emergency_light", spot(LOCAL_COLON, "Depósito", 0.5, 0.08),
            circuit="IUG3", autonomy_min=90, mount="wall"),
    element("switch", spot(LOCAL_COLON, "Salón de ventas", 0.06, 0.9),
            gang=3, kind="simple", circuit="IUG1"),
    element("switch", spot(LOCAL_COLON, "Depósito", 0.45, 0.08),
            gang=2, kind="simple", circuit="IUG2"),
    element("switch", spot(LOCAL_COLON, "Oficina", 0.15, 0.08),
            gang=1, kind="simple", circuit="IUG2"),
    element("outlet", spot(LOCAL_COLON, "Salón de ventas", 0.15, 0.06),
            circuit="TUG1", amperage=10, height_cm=30),
    element("outlet", spot(LOCAL_COLON, "Salón de ventas", 0.5, 0.06),
            circuit="TUG1", amperage=10, height_cm=30),
    element("outlet", spot(LOCAL_COLON, "Salón de ventas", 0.85, 0.06),
            circuit="TUG1", amperage=10, height_cm=30),
    element("outlet", spot(LOCAL_COLON, "Salón de ventas", 0.06, 0.5),
            circuit="TUG1", amperage=10, height_cm=30),
    element("outlet", spot(LOCAL_COLON, "Salón de ventas", 0.94, 0.5),
            circuit="TUG1", amperage=10, height_cm=30),
    element("outlet", spot(LOCAL_COLON, "Salón de ventas", 0.7, 0.92),
            circuit="TUE1", amperage=20, height_cm=110, label="Caja / POS"),
    element("outlet", spot(LOCAL_COLON, "Depósito", 0.9, 0.85),
            circuit="TUE2", amperage=20, height_cm=110, label="Aire acondicionado"),
    element("outlet", spot(LOCAL_COLON, "Oficina", 0.5, 0.25),
            circuit="TUG2", amperage=10, height_cm=30),
    element("data_jack", spot(LOCAL_COLON, "Salón de ventas", 0.75, 0.92),
            kind="rj45", category="cat6", label="POS"),
    element("data_jack", spot(LOCAL_COLON, "Oficina", 0.5, 0.35),
            kind="rj45", category="cat6"),
    element("smoke_detector", spot(LOCAL_COLON, "Depósito", 0.5, 0.5),
            circuit="IUG3", kind="óptico"),
]

_LOCAL_SANITARY = [
    element("water_meter", spot(LOCAL_COLON, "Depósito", 0.12, 0.9),
            diameter_mm=19, system="agua fría"),
    element("water_tank", spot(LOCAL_COLON, "Depósito", 0.85, 0.15),
            liters=600, system="reserva", material="polietileno"),
    element("water_heater", spot(LOCAL_COLON, "Baño", 0.5, 0.12),
            liters=30, fuel="gas", system="agua caliente"),
    element("toilet", spot(LOCAL_COLON, "Baño", 0.45, 0.72),
            rotation=90, drain_mm=110, system="desagüe cloacal"),
    element("sink", spot(LOCAL_COLON, "Baño", 0.5, 0.4),
            drain_mm=40, supply_mm=13, system="agua fría/caliente"),
    element("floor_drain", spot(LOCAL_COLON, "Baño", 0.5, 0.9),
            kind="rejilla", drain_mm=63),
    element("laundry_sink", spot(LOCAL_COLON, "Depósito", 0.4, 0.9),
            drain_mm=50, supply_mm=13),
    element("inspection_chamber", spot(LOCAL_COLON, "Depósito", 0.65, 0.9),
            kind="cámara de inspección", size_cm=60),
    element("pipe", spot(LOCAL_COLON, "Baño", 0.45, 0.72),
            rotation=180, length_cm=190, diameter_mm=110,
            material="PVC", system="desagüe cloacal"),
]

_LOCAL_GAS = [
    element("gas_meter", spot(LOCAL_COLON, "Depósito", 0.2, 0.9),
            kind="G-4", capacity_m3_h=6.0),
    element("gas_valve", spot(LOCAL_COLON, "Depósito", 0.45, 0.9),
            kind="llave de paso", diameter_mm=19),
    element("water_heater", spot(LOCAL_COLON, "Baño", 0.5, 0.12),
            consumption_kcal_h=5500, liters=30, vent="tiro balanceado"),
    element("heater", spot(LOCAL_COLON, "Salón de ventas", 0.1, 0.5),
            consumption_kcal_h=8000, vent="tiro balanceado"),
    element("heater", spot(LOCAL_COLON, "Salón de ventas", 0.9, 0.5),
            consumption_kcal_h=8000, vent="tiro balanceado"),
    element("pipe", spot(LOCAL_COLON, "Depósito", 0.45, 0.9),
            rotation=0, length_cm=300, diameter_mm=19,
            material="epoxi", system="gas natural"),
]

# --- 6. Nogal 3B — a flat on the third floor -------------------------------

NOGAL_3B = [
    Rect("Estar comedor", 0, 0, 520, 380),
    Rect("Cocina", 0, 380, 300, 220),
    Rect("Baño", 300, 380, 220, 220),
    Rect("Dormitorio", 520, 0, 380, 330),
    Rect("Paso", 520, 330, 380, 270),
]

NOGAL_3B_LAYOUT = build_layout(
    NOGAL_3B,
    [
        door(900, 465, 95),
        door(520, 165, 85),
        door(520, 465, 95),
        door(150, 380, 140),
        door(410, 380, 75),
        window(260, 0, 200),
        window(700, 0, 150),
        window(0, 490, 100),
        window(410, 600, 60),
    ],
)

_NOGAL_ELECTRICAL = [
    element("panel", spot(NOGAL_3B, "Paso", 0.85, 0.12),
            breakers=6, main_breaker_a=25, differential_ma=30, phases=1),
    element("light", spot(NOGAL_3B, "Estar comedor", 0.35, 0.4), circuit="IUG1", lumens=1600),
    element("light", spot(NOGAL_3B, "Estar comedor", 0.8, 0.7), circuit="IUG1", lumens=1000),
    element("light", spot(NOGAL_3B, "Cocina"), circuit="IUG1", lumens=1200),
    element("light", spot(NOGAL_3B, "Baño"), circuit="IUG1", lumens=900),
    element("light", spot(NOGAL_3B, "Dormitorio"), circuit="IUG1", lumens=1200),
    element("light", spot(NOGAL_3B, "Paso"), circuit="IUG1", lumens=600),
    element("switch", spot(NOGAL_3B, "Estar comedor", 0.94, 0.5),
            gang=2, kind="simple", circuit="IUG1"),
    element("switch", spot(NOGAL_3B, "Cocina", 0.6, 0.08),
            gang=1, kind="simple", circuit="IUG1"),
    element("switch", spot(NOGAL_3B, "Baño", 0.15, 0.1),
            gang=1, kind="simple", circuit="IUG1"),
    element("switch", spot(NOGAL_3B, "Dormitorio", 0.08, 0.9),
            gang=1, kind="simple", circuit="IUG1"),
    element("outlet", spot(NOGAL_3B, "Estar comedor", 0.2, 0.05),
            circuit="TUG1", amperage=10, height_cm=30),
    element("outlet", spot(NOGAL_3B, "Estar comedor", 0.7, 0.05),
            circuit="TUG1", amperage=10, height_cm=30),
    element("outlet", spot(NOGAL_3B, "Estar comedor", 0.05, 0.75),
            circuit="TUG1", amperage=10, height_cm=30),
    element("outlet", spot(NOGAL_3B, "Cocina", 0.35, 0.12),
            circuit="TUE1", amperage=20, height_cm=110, label="Mesada"),
    element("outlet", spot(NOGAL_3B, "Cocina", 0.85, 0.6),
            circuit="TUE1", amperage=20, height_cm=30, label="Heladera"),
    element("outlet", spot(NOGAL_3B, "Cocina", 0.12, 0.85),
            circuit="TUE2", amperage=20, height_cm=110, label="Lavarropas"),
    element("outlet", spot(NOGAL_3B, "Dormitorio", 0.25, 0.94),
            circuit="TUG1", amperage=10, height_cm=30),
    element("outlet", spot(NOGAL_3B, "Dormitorio", 0.8, 0.94),
            circuit="TUG1", amperage=10, height_cm=30),
    element("wall_light", spot(NOGAL_3B, "Baño", 0.5, 0.12),
            circuit="IUG1", lumens=450, mount="wall"),
    element("data_jack", spot(NOGAL_3B, "Estar comedor", 0.5, 0.05),
            kind="rj45", category="cat6"),
]

_NOGAL_GAS = [
    element("gas_meter", spot(NOGAL_3B, "Paso", 0.15, 0.12),
            kind="G-1.6", capacity_m3_h=2.5, note="nicho sobre el paso"),
    element("gas_valve", spot(NOGAL_3B, "Cocina", 0.55, 0.2),
            kind="llave de paso", diameter_mm=13),
    element("gas_stove", spot(NOGAL_3B, "Cocina", 0.55, 0.12),
            consumption_kcal_h=9000, burners=4, oven=True),
    element("water_heater", spot(NOGAL_3B, "Cocina", 0.9, 0.12),
            consumption_kcal_h=7500, liters=14, vent="tiro balanceado", kind="calefón"),
    element("heater", spot(NOGAL_3B, "Estar comedor", 0.5, 0.95),
            consumption_kcal_h=3000, vent="tiro balanceado"),
    element("pipe", spot(NOGAL_3B, "Paso", 0.15, 0.12),
            rotation=180, length_cm=560, diameter_mm=13,
            material="epoxi", system="gas natural"),
]

# --- The catalogue ---------------------------------------------------------

MOCK_PROJECTS: tuple[MockProject, ...] = (
    MockProject(
        owner_slug="lucia_ferrer",
        owner_name="Lucía Ferrer",
        name="Casa Ferrer — Barrio Jardín",
        description=(
            "Vivienda unifamiliar de una planta, 99 m² cubiertos, tres "
            "dormitorios sobre un pasillo. Las tres instalaciones completas "
            "sobre la misma planta."
        ),
        floors=[
            MockFloor(
                name="Planta Baja",
                level=0,
                layout=CASA_FERRER_LAYOUT,
                plans=[
                    MockPlan(
                        name="Eléctrica — Planta Baja",
                        installation_type=InstallationType.ELECTRICAL,
                        canvas_meta=_canvas(1100, 900),
                        elements=_CASA_FERRER_ELECTRICAL,
                    ),
                    MockPlan(
                        name="Sanitaria — Planta Baja",
                        installation_type=InstallationType.SANITARY,
                        canvas_meta=_canvas(1100, 900),
                        elements=_CASA_FERRER_SANITARY,
                    ),
                    MockPlan(
                        name="Gas — Planta Baja",
                        installation_type=InstallationType.GAS,
                        canvas_meta=_canvas(1100, 900),
                        elements=_CASA_FERRER_GAS,
                    ),
                ],
            )
        ],
    ),
    MockProject(
        owner_slug="bruno_salas",
        owner_name="Bruno Salas",
        name="Loft Güemes",
        description=(
            "Monoambiente de 35 m² en un segundo piso: ambiente único con "
            "cocina y baño sobre el lateral. Reforma de instalaciones."
        ),
        floors=[
            MockFloor(
                name="Piso 2",
                level=2,
                layout=LOFT_GUEMES_LAYOUT,
                plans=[
                    MockPlan(
                        name="Eléctrica — Piso 2",
                        installation_type=InstallationType.ELECTRICAL,
                        canvas_meta=_canvas(700, 500, scale=60),
                        elements=_LOFT_ELECTRICAL,
                    ),
                    MockPlan(
                        name="Sanitaria — Piso 2",
                        installation_type=InstallationType.SANITARY,
                        canvas_meta=_canvas(700, 500, scale=60),
                        elements=_LOFT_SANITARY,
                    ),
                ],
            )
        ],
    ),
    MockProject(
        owner_slug="camila_ortiz",
        owner_name="Camila Ortiz",
        name="Dúplex Los Álamos",
        description=(
            "Dúplex de dos plantas, 112 m² en total. La montante de gas y la "
            "bajada cloacal atraviesan las dos plantas, por eso van dibujadas "
            "en los dos pisos."
        ),
        floors=[
            MockFloor(
                name="Planta Baja",
                level=0,
                layout=DUPLEX_PB_LAYOUT,
                plans=[
                    MockPlan(
                        name="Eléctrica — Planta Baja",
                        installation_type=InstallationType.ELECTRICAL,
                        canvas_meta=_canvas(800, 700),
                        elements=_DUPLEX_PB_ELECTRICAL,
                    ),
                    MockPlan(
                        name="Sanitaria — Planta Baja",
                        installation_type=InstallationType.SANITARY,
                        canvas_meta=_canvas(800, 700),
                        elements=_DUPLEX_PB_SANITARY,
                    ),
                    MockPlan(
                        name="Gas — Planta Baja",
                        installation_type=InstallationType.GAS,
                        canvas_meta=_canvas(800, 700),
                        elements=_DUPLEX_PB_GAS,
                    ),
                ],
            ),
            MockFloor(
                name="Planta Alta",
                level=1,
                layout=DUPLEX_PA_LAYOUT,
                plans=[
                    MockPlan(
                        name="Eléctrica — Planta Alta",
                        installation_type=InstallationType.ELECTRICAL,
                        canvas_meta=_canvas(800, 700),
                        elements=_DUPLEX_PA_ELECTRICAL,
                    ),
                    MockPlan(
                        name="Sanitaria — Planta Alta",
                        installation_type=InstallationType.SANITARY,
                        canvas_meta=_canvas(800, 700),
                        elements=_DUPLEX_PA_SANITARY,
                    ),
                ],
            ),
        ],
    ),
    MockProject(
        owner_slug="martin_bianchi",
        owner_name="Martín Bianchi",
        name="Oficinas Nodo 47",
        description=(
            "Oficina de 54 m² con subsuelo técnico. Tablero trifásico, "
            "iluminación de emergencia y tanque de reserva con presurizadora "
            "en la sala de máquinas."
        ),
        floors=[
            MockFloor(
                name="Subsuelo",
                level=-1,
                layout=NODO_SUBSUELO_LAYOUT,
                plans=[
                    MockPlan(
                        name="Eléctrica — Subsuelo",
                        installation_type=InstallationType.ELECTRICAL,
                        canvas_meta=_canvas(900, 400, scale=55),
                        elements=_NODO_SUBSUELO_ELECTRICAL,
                    ),
                    MockPlan(
                        name="Sanitaria — Subsuelo",
                        installation_type=InstallationType.SANITARY,
                        canvas_meta=_canvas(900, 400, scale=55),
                        elements=_NODO_SUBSUELO_SANITARY,
                    ),
                ],
            ),
            MockFloor(
                name="Planta Baja",
                level=0,
                layout=NODO_PB_LAYOUT,
                plans=[
                    MockPlan(
                        name="Eléctrica — Planta Baja",
                        installation_type=InstallationType.ELECTRICAL,
                        canvas_meta=_canvas(900, 600, scale=55),
                        elements=_NODO_PB_ELECTRICAL,
                    ),
                    MockPlan(
                        name="Sanitaria — Planta Baja",
                        installation_type=InstallationType.SANITARY,
                        canvas_meta=_canvas(900, 600, scale=55),
                        elements=_NODO_PB_SANITARY,
                    ),
                ],
            ),
        ],
    ),
    MockProject(
        owner_slug="valentina_rua",
        owner_name="Valentina Rúa",
        name="Local Av. Colón 1200",
        description=(
            "Local comercial de 80 m²: salón de ventas al frente, depósito, "
            "baño y oficina al fondo. Habilitación comercial, con iluminación "
            "de emergencia y detección de humo."
        ),
        floors=[
            MockFloor(
                name="Planta Baja",
                level=0,
                layout=LOCAL_COLON_LAYOUT,
                plans=[
                    MockPlan(
                        name="Eléctrica — Salón y depósito",
                        installation_type=InstallationType.ELECTRICAL,
                        canvas_meta=_canvas(800, 1000, scale=45),
                        elements=_LOCAL_ELECTRICAL,
                    ),
                    MockPlan(
                        name="Sanitaria — Salón y depósito",
                        installation_type=InstallationType.SANITARY,
                        canvas_meta=_canvas(800, 1000, scale=45),
                        elements=_LOCAL_SANITARY,
                    ),
                    MockPlan(
                        name="Gas — Salón y depósito",
                        installation_type=InstallationType.GAS,
                        canvas_meta=_canvas(800, 1000, scale=45),
                        elements=_LOCAL_GAS,
                    ),
                ],
            )
        ],
    ),
    MockProject(
        owner_slug="diego_paniagua",
        owner_name="Diego Paniagua",
        name="Edificio Nogal — Depto 3B",
        description=(
            "Departamento de dos ambientes, 54 m², en un tercer piso. "
            "Actualización de la instalación eléctrica y de gas para el "
            "certificado del consorcio."
        ),
        floors=[
            MockFloor(
                name="Piso 3",
                level=3,
                layout=NOGAL_3B_LAYOUT,
                plans=[
                    MockPlan(
                        name="Eléctrica — Depto 3B",
                        installation_type=InstallationType.ELECTRICAL,
                        canvas_meta=_canvas(900, 600),
                        elements=_NOGAL_ELECTRICAL,
                    ),
                    MockPlan(
                        name="Gas — Depto 3B",
                        installation_type=InstallationType.GAS,
                        canvas_meta=_canvas(900, 600),
                        elements=_NOGAL_GAS,
                    ),
                ],
            )
        ],
    ),
)


__all__ = [
    "MOCK_PROJECTS",
    "MOCK_USER_PREFIX",
    "MockElement",
    "MockFloor",
    "MockPlan",
    "MockProject",
]
