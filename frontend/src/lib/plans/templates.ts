import {
  addOpening,
  addRoom,
  createId,
  mergeCollinearWalls,
  rectanglePoints,
  wallAt,
} from "@/lib/geometry/layout";
import { polygonArea } from "@/lib/geometry/vector";
import {
  DEFAULT_WALL_THICKNESS,
  emptyLayout,
  type Layout,
  type OpeningKind,
  type Point,
} from "@/lib/schemas/layout";

/**
 * Pre-built floors: pick one and the storey is already drawn.
 *
 * Templates are authored as a list of **rectangular rooms** in centimetres plus
 * the doors and windows on them, and the walls are derived from the rectangles'
 * edges. That is the only way these stay readable: writing forty wall segments
 * by hand is how a template ends up with a corner that does not close.
 *
 * `mergeCollinearWalls` is what makes it work — the edge two adjoining rooms
 * share arrives twice, and a long wall arrives in pieces.
 */

/** A room of a template: origin plus size, in centimetres. */
type TemplateRoom = {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * A door or a window, placed by pointing at where it goes. The builder finds
 * the wall under that point, which is far easier to author (and to re-read)
 * than naming a wall that does not exist yet.
 */
type TemplateOpening = {
  kind: OpeningKind;
  at: Point;
  width: number;
};

export type PlanTemplate = {
  id: string;
  name: string;
  description: string;
  /** Built once at import: applying a template just copies this layout. */
  layout: Layout;
};

/** How far from a wall a template's opening may point and still find it. */
const OPENING_TOLERANCE = 25;

function buildLayout(
  rooms: TemplateRoom[],
  openings: TemplateOpening[],
  thickness = DEFAULT_WALL_THICKNESS,
): Layout {
  const corners = rooms.map((room) =>
    rectanglePoints(
      { x: room.x, y: room.y },
      { x: room.x + room.width, y: room.y + room.height },
    ),
  );

  const edges = corners.flatMap((points) =>
    points.map((point, index) => ({
      id: createId("w"),
      a: point,
      b: points[(index + 1) % points.length],
      thickness,
    })),
  );

  let layout: Layout = { ...emptyLayout(), walls: mergeCollinearWalls(edges) };

  rooms.forEach((room, index) => {
    layout = addRoom(layout, room.name, corners[index]);
  });

  for (const opening of openings) {
    const hit = wallAt(layout, opening.at, OPENING_TOLERANCE);
    // A template whose opening points at nothing simply has no opening there.
    // Failing the import instead would take the whole picker down with it.
    if (hit === null) continue;
    layout = addOpening(layout, hit.wall.id, opening.kind, hit.t, opening.width);
  }

  return layout;
}

const door = (x: number, y: number, width = 90): TemplateOpening => ({
  kind: "door",
  at: { x, y },
  width,
});

const window_ = (x: number, y: number, width = 120): TemplateOpening => ({
  kind: "window",
  at: { x, y },
  width,
});

export const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: "blank",
    name: "En blanco",
    description: "Un piso vacío para dibujar desde cero con las herramientas.",
    layout: emptyLayout(),
  },
  {
    id: "studio",
    name: "Monoambiente",
    description: "Ambiente único de 5 × 5 m con cocina y baño sobre un lateral.",
    layout: buildLayout(
      [
        { name: "Ambiente principal", x: 0, y: 0, width: 500, height: 500 },
        { name: "Cocina", x: 500, y: 0, width: 200, height: 250 },
        { name: "Baño", x: 500, y: 250, width: 200, height: 250 },
      ],
      [
        door(0, 250, 95),
        door(500, 125, 100),
        door(500, 375, 75),
        window_(250, 0, 180),
        window_(700, 125, 90),
        window_(700, 375, 60),
      ],
    ),
  },
  {
    id: "apartment",
    name: "Departamento 2 ambientes",
    description: "Estar comedor, dormitorio, cocina y baño alrededor de un paso.",
    layout: buildLayout(
      [
        { name: "Estar comedor", x: 0, y: 0, width: 520, height: 380 },
        { name: "Cocina", x: 0, y: 380, width: 300, height: 220 },
        { name: "Baño", x: 300, y: 380, width: 220, height: 220 },
        { name: "Dormitorio", x: 520, y: 0, width: 380, height: 330 },
        { name: "Paso", x: 520, y: 330, width: 380, height: 270 },
      ],
      [
        door(900, 465, 95),
        door(520, 165, 85),
        door(520, 465, 95),
        door(150, 380, 140),
        door(410, 380, 75),
        window_(260, 0, 200),
        window_(700, 0, 150),
        window_(0, 490, 100),
        window_(410, 600, 60),
      ],
    ),
  },
  {
    id: "house",
    name: "Casa 3 dormitorios",
    description: "Casa de una planta, unos 99 m²: tres dormitorios sobre un pasillo.",
    layout: buildLayout(
      [
        { name: "Estar comedor", x: 0, y: 0, width: 550, height: 450 },
        { name: "Dormitorio 1", x: 550, y: 0, width: 550, height: 450 },
        { name: "Cocina", x: 0, y: 450, width: 350, height: 300 },
        { name: "Lavadero", x: 0, y: 750, width: 350, height: 150 },
        { name: "Pasillo", x: 350, y: 450, width: 450, height: 150 },
        { name: "Baño", x: 800, y: 450, width: 300, height: 150 },
        { name: "Dormitorio 2", x: 350, y: 600, width: 350, height: 300 },
        { name: "Dormitorio 3", x: 700, y: 600, width: 400, height: 300 },
      ],
      [
        door(0, 225, 95),
        door(450, 450, 110),
        door(650, 450, 85),
        door(175, 450, 100),
        door(175, 750, 80),
        door(800, 525, 75),
        door(500, 600, 85),
        door(750, 600, 85),
        window_(275, 0, 220),
        window_(825, 0, 180),
        window_(0, 600, 100),
        window_(0, 825, 60),
        window_(1100, 525, 60),
        window_(500, 900, 150),
        window_(900, 900, 150),
      ],
    ),
  },
  {
    id: "duplex-ground",
    name: "Dúplex · planta baja",
    description: "Planta baja con estar, cocina, toilette y el hueco de escalera.",
    layout: buildLayout(
      [
        { name: "Estar comedor", x: 0, y: 0, width: 500, height: 450 },
        { name: "Cocina", x: 500, y: 0, width: 300, height: 450 },
        { name: "Escalera", x: 0, y: 450, width: 250, height: 250 },
        { name: "Toilette", x: 250, y: 450, width: 250, height: 250 },
        { name: "Lavadero", x: 500, y: 450, width: 300, height: 250 },
      ],
      [
        door(0, 225, 95),
        door(500, 225, 100),
        door(125, 450, 120),
        door(375, 450, 75),
        door(500, 575, 85),
        window_(250, 0, 200),
        window_(650, 0, 150),
        window_(800, 575, 90),
        window_(375, 700, 50),
      ],
    ),
  },
  {
    id: "duplex-upper",
    name: "Dúplex · planta alta",
    description: "Planta alta con dos dormitorios, baño y placard sobre el pasillo.",
    layout: buildLayout(
      [
        { name: "Dormitorio principal", x: 0, y: 0, width: 450, height: 400 },
        { name: "Dormitorio 2", x: 450, y: 0, width: 350, height: 400 },
        { name: "Escalera", x: 0, y: 400, width: 250, height: 300 },
        { name: "Pasillo", x: 250, y: 400, width: 550, height: 150 },
        { name: "Baño", x: 250, y: 550, width: 300, height: 150 },
        { name: "Placard", x: 550, y: 550, width: 250, height: 150 },
      ],
      [
        door(350, 400, 85),
        door(600, 400, 85),
        door(400, 550, 75),
        door(675, 550, 90),
        door(250, 475, 120),
        window_(225, 0, 180),
        window_(625, 0, 150),
        window_(400, 700, 60),
        window_(0, 550, 90),
      ],
    ),
  },
  {
    id: "office",
    name: "Oficina",
    description: "Recepción, sala de reuniones, oficina privada y espacio abierto.",
    layout: buildLayout(
      [
        { name: "Recepción", x: 0, y: 0, width: 300, height: 600 },
        { name: "Sala de reuniones", x: 300, y: 0, width: 300, height: 300 },
        { name: "Oficina 1", x: 600, y: 0, width: 300, height: 300 },
        { name: "Espacio de trabajo", x: 300, y: 300, width: 600, height: 300 },
      ],
      [
        door(0, 300, 100),
        door(300, 150, 90),
        door(300, 450, 110),
        door(750, 300, 90),
        window_(450, 0, 200),
        window_(750, 0, 150),
        window_(900, 150, 120),
        window_(450, 600, 200),
        window_(750, 600, 200),
      ],
    ),
  },
  {
    id: "shop",
    name: "Local comercial",
    description: "Salón de ventas al frente, con depósito, baño y oficina al fondo.",
    layout: buildLayout(
      [
        { name: "Salón de ventas", x: 0, y: 0, width: 800, height: 650 },
        { name: "Depósito", x: 0, y: 650, width: 500, height: 350 },
        { name: "Baño", x: 500, y: 650, width: 150, height: 350 },
        { name: "Oficina", x: 650, y: 650, width: 150, height: 350 },
      ],
      [
        door(400, 0, 160),
        door(250, 650, 110),
        door(575, 650, 75),
        door(725, 650, 85),
        window_(150, 0, 220),
        window_(650, 0, 220),
        window_(0, 825, 90),
        window_(800, 825, 90),
      ],
    ),
  },
];

export const DEFAULT_TEMPLATE_ID = "blank";

export function findTemplate(templateId: string): PlanTemplate | undefined {
  return PLAN_TEMPLATES.find((template) => template.id === templateId);
}

/**
 * A fresh copy of a template's layout, with ids of its own.
 *
 * Ids only have to be unique inside one layout, but reusing the same strings on
 * two floors makes anything keyed by id — a debug session, a future "copy this
 * wall over there" — quietly ambiguous.
 */
export function instantiateTemplate(template: PlanTemplate): Layout {
  const wallIds = new Map(template.layout.walls.map((wall) => [wall.id, createId("w")]));

  return {
    ...template.layout,
    walls: template.layout.walls.map((wall) => ({
      ...wall,
      id: wallIds.get(wall.id) ?? createId("w"),
      a: { ...wall.a },
      b: { ...wall.b },
    })),
    openings: template.layout.openings.map((opening) => ({
      ...opening,
      id: createId("o"),
      wall_id: wallIds.get(opening.wall_id) ?? opening.wall_id,
    })),
    rooms: template.layout.rooms.map((room) => ({
      ...room,
      id: createId("r"),
      points: room.points.map((point) => ({ ...point })),
    })),
  };
}

/** Total covered area of a template, for the label on its card. */
export function templateArea(template: PlanTemplate): number {
  return template.layout.rooms.reduce(
    (total, room) => total + polygonArea(room.points),
    0,
  );
}
