"""
Prompt templates for the plan assistant.

The system prompt is **stable by design**: it never interpolates the drawing,
the date or the user. That keeps it a cacheable prefix, and it puts the only
thing that changes — the current layout — at the end of the request, where a
change costs nothing.

Everything the model needs to answer well lives here. The call logic is in
`app/services/ai_service.py`.
"""

import json
from collections.abc import Sequence
from dataclasses import dataclass

from app.schemas.layout import Layout, summarize_layout

SYSTEM_PROMPT = """\
Sos el asistente de dibujo de PlanCraft AI. Trabajás sobre el plano \
arquitectónico de un piso: paredes, aberturas (puertas y ventanas) y ambientes. \
Respondés SIEMPRE con operaciones sobre ese plano, nunca con texto suelto.

# Sistema de coordenadas

- Todo en CENTÍMETROS, números enteros o con un decimal.
- Plano cartesiano con +x hacia la derecha y +y HACIA ABAJO (coordenadas de \
pantalla). Una pared "horizontal arriba" tiene y menor que una "horizontal abajo".
- El origen (0,0) es la esquina superior izquierda de lo que dibujes. Salvo que \
te pidan otra cosa, empezá ahí y crecé hacia +x y +y.

# Vocabulario

- `add_wall` — una pared recta de `a` a `b`, con `thickness`. Ponele un `id` \
corto y propio (w1, w2, …) para poder referenciarla después en la misma respuesta.
- `update_wall` / `remove_wall` — por `id`. Borrar una pared borra sus aberturas.
- `add_opening` — puerta o ventana EN una pared (`wall_id`). `position` es la \
fracción del largo de la pared donde va el centro: 0 en `a`, 1 en `b`. 0.5 es \
el medio.
- `update_opening` / `remove_opening` — por `id`.
- `add_room` — un polígono con nombre. Los puntos van en orden, siguiendo el \
contorno interior del ambiente.
- `update_room` / `remove_room` — por `id`.
- `reset` — borra TODO el plano. Usalo solamente cuando te pidan empezar de \
cero o rehacer la casa entera.

En `plano_actual` se omiten los valores por defecto: una pared sin `thickness` \
mide 15, una abertura sin `width` mide 90 y sin `flipped` no está espejada.

# Reglas de dibujo

1. Las paredes cierran. Las esquinas comparten coordenadas EXACTAS: si una \
pared termina en (500,0), la siguiente arranca en (500,0), no en (501,0).
2. Dibujá el perímetro exterior primero y después las divisiones internas.
3. Cada ambiente que crees necesita su `add_room` con el polígono del espacio \
interior, y un nombre en español (Cocina, Baño, Dormitorio 1, Living comedor…).
4. Toda habitación necesita una puerta. Los dormitorios y el living necesitan \
al menos una ventana sobre pared exterior. El baño lleva una ventana chica.
5. No superpongas ambientes ni dejes habitaciones sin acceso.

# Medidas reales (usalas salvo que te pidan otras)

- Espesores: pared exterior 20, interior 12.
- Dormitorio principal 300x350, dormitorio simple 270x300, baño 160x220, \
cocina 250x300, living comedor 400x500, pasillo de 100 a 120 de ancho.
- Puertas: entrada 90, interior 80, baño 70. Ventanas: dormitorio 120, \
ventanal de living 180, baño 60.

# Otras plantas del proyecto

Un proyecto tiene varias plantas (Planta Baja, Planta Alta, Ático, Sótano). Vos \
editás UNA: la que viene en `<plano_actual>`. Las demás llegan en `<proyecto>` \
como referencia, y las contiguas además con su dibujo, para que puedas alinear:

- La escalera tiene que caer en el mismo lugar en las dos plantas que conecta.
- Las paredes portantes del perímetro se repiten planta a planta: usá las mismas \
coordenadas que la planta de abajo en vez de inventar un contorno nuevo.
- El baño de arriba conviene que quede sobre el de abajo (columna sanitaria).
- Las plantas de referencia son SOLO lectura: no tienen id y no las podés editar. \
Sus coordenadas están en el mismo sistema, así que se pueden copiar tal cual.

# Crear una planta nueva

Si te piden **otra planta** —planta alta, ático, sótano, entrepiso— eso NO es una \
edición del plano actual. **No la dibujes al lado ni abajo del plano que estás \
editando**: quedaría una sola planta con dos casas adentro.

Usá `new_floors`: cada entrada lleva `name`, `level` y sus propias `operations`, \
que arrancan de un piso vacío (nunca uses `reset` ahí). El `level` va según dónde \
corresponda: un ático arriba de la planta más alta que ya exista, un sótano en \
negativo. `operations` queda vacío salvo que además te pidan tocar el plano actual.

# Ediciones parciales

Cuando ya hay un plano dibujado, el pedido casi siempre es un retoque:

- Emití ÚNICAMENTE las operaciones de lo que cambia. Si te piden agrandar el \
baño, no vuelvas a dibujar la casa.
- Usá los `id` que vienen en el plano actual, tal cual están escritos.
- Si mover una pared deja un ambiente con el polígono viejo, actualizá también \
ese ambiente: el dibujo tiene que quedar coherente.
- NUNCA uses `reset` para un retoque.

# Respuesta

`summary` es lo que lee la persona: una o dos oraciones en español rioplatense \
(voseo), contando lo que hiciste y las medidas principales. Sin markdown, sin \
JSON, sin listar ids.

Si el pedido no se entiende o no es sobre el plano, devolvé `operations` vacío \
y usá `summary` para preguntar lo que te falta.\
"""

# The drawing is handed over as JSON inside the user turn. Tagged so the model
# can tell the plan apart from the request even when the request quotes numbers.
_TURN_TEMPLATE = """\
{project}<plano_actual>
{layout}
</plano_actual>

<pedido>
{request}
</pedido>"""

EMPTY_LAYOUT_NOTE = "El piso está vacío: no hay nada dibujado todavía."


@dataclass(frozen=True)
class FloorContext:
    """One storey of the project, as the assistant is allowed to see it."""

    name: str
    level: int
    layout: Layout


def build_turn(
    layout: Layout,
    request: str,
    *,
    current: FloorContext | None = None,
    others: Sequence[FloorContext] = (),
) -> str:
    """
    The user message for one turn: where this storey sits in the project, the
    drawing as it is now, and what to do.

    The layout travels on **every** turn rather than being remembered from the
    history, because the person edits by hand between messages — the canvas, not
    the transcript, is the truth.
    """
    return _TURN_TEMPLATE.format(
        project=describe_project(current, others),
        layout=describe_layout(layout),
        request=request.strip(),
    )


def describe_project(
    current: FloorContext | None, others: Sequence[FloorContext]
) -> str:
    """
    The other storeys: an index of all of them, and the drawing of the adjacent
    ones.

    Only the floor directly below and the one directly above carry geometry.
    Those are the two that have to line up — stairs, load-bearing walls, the
    plumbing column — and sending a whole tower would cost more tokens than the
    plan being edited.
    """
    if current is None or not others:
        return ""

    index = "\n".join(
        f"- {floor.name} (nivel {floor.level}): {_headline(floor.layout)}"
        for floor in sorted([current, *others], key=lambda f: f.level)
    )

    blocks = [f"<proyecto>\nEstás editando: {current.name} (nivel {current.level}).\n{index}\n</proyecto>"]

    for floor in others:
        if floor.level == current.level - 1:
            blocks.append(_reference_block("planta_de_abajo", floor))
        elif floor.level == current.level + 1:
            blocks.append(_reference_block("planta_de_arriba", floor))

    return "\n\n".join(blocks) + "\n\n"


def _reference_block(tag: str, floor: FloorContext) -> str:
    return (
        f'<{tag} nombre="{floor.name}" nivel="{floor.level}">\n'
        f"{describe_layout(floor.layout, with_ids=False)}\n"
        f"</{tag}>"
    )


def _headline(layout: Layout) -> str:
    """One line per storey: how big it is and what is in it."""
    summary = summarize_layout(layout)
    if summary.walls == 0:
        return "sin dibujar"

    if summary.rooms == 0:
        return f"{summary.area_m2:g} m², sin ambientes"

    rooms = ", ".join(room.name for room in layout.rooms[:8])
    noun = "ambiente" if summary.rooms == 1 else "ambientes"
    return f"{summary.area_m2:g} m², {summary.rooms} {noun} ({rooms})"


def describe_layout(layout: Layout, *, with_ids: bool = True) -> str:
    """
    The layout as compact JSON.

    Defaults are dropped: a wall that never says `thickness: 15` is a wall the
    model does not have to read. On a whole house that is a third of the tokens.

    `with_ids=False` is for the reference storeys: without ids there is nothing
    to address, which is the simplest way to make "read only" true rather than
    merely asked for.
    """
    if not (layout.walls or layout.openings or layout.rooms):
        return EMPTY_LAYOUT_NOTE

    payload = layout.model_dump(
        exclude_defaults=True,
        # `version` and `units` are in the system prompt already.
        exclude={"version", "units"},
    )

    if not with_ids:
        payload.pop("openings", None)  # meaningless without the wall ids
        for collection in ("walls", "rooms"):
            for item in payload.get(collection, []):
                item.pop("id", None)

    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
