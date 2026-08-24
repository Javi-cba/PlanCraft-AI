import {
  DEFAULT_OPENING_WIDTH,
  DEFAULT_WALL_THICKNESS,
  MIN_WALL_LENGTH,
  emptyLayout,
  type Layout,
  type Opening,
  type OpeningKind,
  type Point,
  type Room,
  type Wall,
} from "@/lib/schemas/layout";

import {
  direction,
  distance,
  lerp,
  polygonArea,
  polygonCentroid,
  projectOnSegment,
} from "./vector";

/**
 * Operations on a whole layout: creating and editing walls, openings and rooms,
 * plus the derived numbers the editor draws (lengths, areas, junctions).
 *
 * Every function is pure and returns a new layout — the editor's undo stack is
 * a list of these, so nothing may be mutated in place.
 */

/** Ids only have to be unique inside one layout, and readable while debugging. */
export function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

// --- reading ---------------------------------------------------------------

export function wallLength(wall: Wall): number {
  return distance(wall.a, wall.b);
}

/** Point at `t` along a wall: 0 at `a`, 1 at `b`. */
export function pointOnWall(wall: Wall, t: number): Point {
  return lerp(wall.a, wall.b, t);
}

export function findWall(layout: Layout, wallId: string): Wall | undefined {
  return layout.walls.find((wall) => wall.id === wallId);
}

export function openingsOfWall(layout: Layout, wallId: string): Opening[] {
  return layout.openings.filter((opening) => opening.wall_id === wallId);
}

/** Area of a room in cm². The layout never stores it: it would go stale. */
export function roomArea(room: Room): number {
  return polygonArea(room.points);
}

/** Where a room's name and area go. */
export function roomLabelAnchor(room: Room): Point {
  return polygonCentroid(room.points);
}

/**
 * The wall nearest to `point`, within `tolerance` centimetres.
 *
 * This is what "click on a wall to put a door there" runs on, so it also hands
 * back where along the wall the click landed.
 */
export function wallAt(
  layout: Layout,
  point: Point,
  tolerance: number,
): { wall: Wall; t: number; distance: number } | null {
  let best: { wall: Wall; t: number; distance: number } | null = null;

  for (const wall of layout.walls) {
    const hit = projectOnSegment(point, wall.a, wall.b);
    // Half the thickness counts as "on the wall", so a thick wall is not
    // harder to hit than a thin one.
    const reach = tolerance + wall.thickness / 2;

    if (hit.distance <= reach && (best === null || hit.distance < best.distance)) {
      best = { wall, t: hit.t, distance: hit.distance };
    }
  }

  return best;
}

/**
 * The endpoint of an existing wall nearest to `point`, within `tolerance`.
 *
 * Drawing snaps to these so consecutive walls actually meet: a corner that is
 * two centimetres apart looks joined and behaves like a hole.
 */
export function endpointAt(
  layout: Layout,
  point: Point,
  tolerance: number,
  options: { ignoreWallId?: string } = {},
): Point | null {
  let best: { point: Point; distance: number } | null = null;

  for (const wall of layout.walls) {
    if (wall.id === options.ignoreWallId) continue;

    for (const candidate of [wall.a, wall.b]) {
      const gap = distance(point, candidate);
      if (gap <= tolerance && (best === null || gap < best.distance)) {
        best = { point: candidate, distance: gap };
      }
    }
  }

  return best?.point ?? null;
}

/**
 * Points where two or more walls meet, with the thickness to draw there.
 *
 * Walls are drawn as butt-capped strokes, which leaves a notch on the outside
 * of every corner. Filling the junction closes it without rounding the free
 * ends of a wall, which is what a round cap would do.
 */
export function wallJunctions(layout: Layout): { point: Point; size: number }[] {
  const found = new Map<string, { point: Point; size: number; count: number }>();

  for (const wall of layout.walls) {
    for (const endpoint of [wall.a, wall.b]) {
      // Millimetre precision: endpoints that snapped together share a key.
      const key = `${endpoint.x.toFixed(1)}:${endpoint.y.toFixed(1)}`;
      const entry = found.get(key);

      if (entry === undefined) {
        found.set(key, { point: endpoint, size: wall.thickness, count: 1 });
      } else {
        entry.count += 1;
        entry.size = Math.max(entry.size, wall.thickness);
      }
    }
  }

  return [...found.values()]
    .filter((entry) => entry.count > 1)
    .map(({ point, size }) => ({ point, size }));
}

/**
 * The stretches of a wall that are actually built, as `[from, to]` pairs in
 * `t`. Doors and windows are gaps, so drawing the wall means drawing what is
 * left of it once the openings are cut out.
 */
export function solidSegments(wall: Wall, openings: Opening[]): [number, number][] {
  const total = wallLength(wall);
  if (total <= 0) return [];

  const holes = openings
    .map((opening) => {
      const half = opening.width / 2 / total;
      return [
        Math.max(0, opening.position - half),
        Math.min(1, opening.position + half),
      ] as [number, number];
    })
    .sort((left, right) => left[0] - right[0]);

  const segments: [number, number][] = [];
  let cursor = 0;

  for (const [start, end] of holes) {
    if (start > cursor) segments.push([cursor, start]);
    cursor = Math.max(cursor, end);
  }

  if (cursor < 1) segments.push([cursor, 1]);

  // A gap that swallowed the whole wall leaves nothing to draw.
  return segments.filter(([start, end]) => end - start > 0.0005);
}

/** Bounding box of everything drawn, or `null` for an empty layout. */
export function layoutBounds(
  layout: Layout,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const points: Point[] = [
    ...layout.walls.flatMap((wall) => [wall.a, wall.b]),
    ...layout.rooms.flatMap((room) => room.points),
  ];

  if (points.length === 0) return null;

  return points.reduce(
    (box, point) => ({
      minX: Math.min(box.minX, point.x),
      minY: Math.min(box.minY, point.y),
      maxX: Math.max(box.maxX, point.x),
      maxY: Math.max(box.maxY, point.y),
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    },
  );
}

// --- writing ---------------------------------------------------------------

export function addWall(
  layout: Layout,
  a: Point,
  b: Point,
  thickness = DEFAULT_WALL_THICKNESS,
): Layout {
  if (distance(a, b) < MIN_WALL_LENGTH) return layout;

  const wall: Wall = { id: createId("w"), a, b, thickness };
  return { ...layout, walls: [...layout.walls, wall] };
}

export function updateWall(
  layout: Layout,
  wallId: string,
  changes: Partial<Omit<Wall, "id">>,
): Layout {
  return {
    ...layout,
    walls: layout.walls.map((wall) =>
      wall.id === wallId ? { ...wall, ...changes } : wall,
    ),
  };
}

/** Removes a wall and the openings that were cut into it. */
export function removeWall(layout: Layout, wallId: string): Layout {
  return {
    ...layout,
    walls: layout.walls.filter((wall) => wall.id !== wallId),
    openings: layout.openings.filter((opening) => opening.wall_id !== wallId),
  };
}

/**
 * Adds a door or a window at `t` along a wall, nudged so it fits inside it.
 *
 * An opening that ran past the end of its wall would leave a stub of wall
 * floating, so the position is clamped instead of rejected.
 */
export function addOpening(
  layout: Layout,
  wallId: string,
  kind: OpeningKind,
  t: number,
  width = DEFAULT_OPENING_WIDTH[kind],
): Layout {
  const wall = findWall(layout, wallId);
  if (wall === undefined) return layout;

  const position = fitOpening(wall, t, width);
  if (position === null) return layout;

  const opening: Opening = {
    id: createId("o"),
    wall_id: wallId,
    kind,
    position,
    width: Math.min(width, wallLength(wall)),
    flipped: false,
  };

  return { ...layout, openings: [...layout.openings, opening] };
}

/**
 * `t` moved so an opening of `width` fits entirely inside the wall, or `null`
 * when the wall is too short to hold one.
 */
export function fitOpening(wall: Wall, t: number, width: number): number | null {
  const total = wallLength(wall);
  if (total <= 0) return null;

  const half = Math.min(width, total) / 2 / total;
  // Strictly inside: the backend rejects 0 and 1, and an opening flush with a
  // corner is a doorway with no jamb.
  const min = Math.min(half, 0.499);
  const max = Math.max(1 - half, 0.501);

  return Math.min(Math.max(t, min), max);
}

export function updateOpening(
  layout: Layout,
  openingId: string,
  changes: Partial<Omit<Opening, "id" | "wall_id">>,
): Layout {
  return {
    ...layout,
    openings: layout.openings.map((opening) => {
      if (opening.id !== openingId) return opening;

      const merged = { ...opening, ...changes };
      const wall = findWall(layout, opening.wall_id);
      if (wall === undefined) return merged;

      const position = fitOpening(wall, merged.position, merged.width);
      return position === null ? merged : { ...merged, position };
    }),
  };
}

export function removeOpening(layout: Layout, openingId: string): Layout {
  return {
    ...layout,
    openings: layout.openings.filter((opening) => opening.id !== openingId),
  };
}

export function addRoom(layout: Layout, name: string, points: Point[]): Layout {
  const room: Room = { id: createId("r"), name, points };
  return { ...layout, rooms: [...layout.rooms, room] };
}

export function updateRoom(
  layout: Layout,
  roomId: string,
  changes: Partial<Omit<Room, "id">>,
): Layout {
  return {
    ...layout,
    rooms: layout.rooms.map((room) =>
      room.id === roomId ? { ...room, ...changes } : room,
    ),
  };
}

export function removeRoom(layout: Layout, roomId: string): Layout {
  return { ...layout, rooms: layout.rooms.filter((room) => room.id !== roomId) };
}

/** The four corners of the rectangle two opposite points describe. */
export function rectanglePoints(a: Point, b: Point): Point[] {
  return [
    { x: a.x, y: a.y },
    { x: b.x, y: a.y },
    { x: b.x, y: b.y },
    { x: a.x, y: b.y },
  ];
}

/**
 * A closed run of walls around a rectangle, plus the room it encloses.
 *
 * This is the "draw a room" tool: dragging a box is how anyone expects to
 * start a plan, and four separate wall clicks is not.
 */
export function addRectangularRoom(
  layout: Layout,
  a: Point,
  b: Point,
  name: string,
  thickness = DEFAULT_WALL_THICKNESS,
): Layout {
  const corners = rectanglePoints(a, b);
  if (polygonArea(corners) <= 0) return layout;

  let next = layout;
  for (let index = 0; index < corners.length; index += 1) {
    next = addWall(next, corners[index], corners[(index + 1) % corners.length], thickness);
  }

  return addRoom(next, name, corners);
}

/** Moves a whole entity by a delta, in centimetres. */
export function translateWall(layout: Layout, wallId: string, delta: Point): Layout {
  const wall = findWall(layout, wallId);
  if (wall === undefined) return layout;

  return updateWall(layout, wallId, {
    a: { x: wall.a.x + delta.x, y: wall.a.y + delta.y },
    b: { x: wall.b.x + delta.x, y: wall.b.y + delta.y },
  });
}

export function translateRoom(layout: Layout, roomId: string, delta: Point): Layout {
  const room = layout.rooms.find((candidate) => candidate.id === roomId);
  if (room === undefined) return layout;

  return updateRoom(layout, roomId, {
    points: room.points.map((point) => ({ x: point.x + delta.x, y: point.y + delta.y })),
  });
}

/**
 * Fuses walls that lie on the same straight line and touch or overlap.
 *
 * Templates are authored as a list of rectangles, so a wall shared by two rooms
 * arrives twice and a long wall arrives as the two halves the rooms on either
 * side contributed. Left alone that is drawn twice and, worse, an opening cut
 * into one copy leaves the other one solid across the doorway.
 *
 * Thickness is part of the grouping: a partition and a load-bearing wall on the
 * same line are two different walls, not one.
 */
export function mergeCollinearWalls(walls: Wall[], tolerance = 0.5): Wall[] {
  const groups = new Map<string, { unit: Point; offset: number; wall: Wall }[]>();

  for (const wall of walls) {
    const unit = direction(wall.a, wall.b);
    if (unit.x === 0 && unit.y === 0) continue;

    // One orientation per line, so `a→b` and `b→a` land in the same group.
    const forward = unit.x < -1e-9 || (Math.abs(unit.x) <= 1e-9 && unit.y < 0);
    const oriented = forward ? { x: -unit.x, y: -unit.y } : unit;
    // Signed distance from the origin to the line, along its normal.
    const offset = wall.a.x * -oriented.y + wall.a.y * oriented.x;

    const key = [
      oriented.x.toFixed(4),
      oriented.y.toFixed(4),
      offset.toFixed(1),
      wall.thickness,
    ].join(":");

    const group = groups.get(key);
    if (group === undefined) groups.set(key, [{ unit: oriented, offset, wall }]);
    else group.push({ unit: oriented, offset, wall });
  }

  const merged: Wall[] = [];

  for (const group of groups.values()) {
    const { unit, offset } = group[0];
    // Position along the line, so an overlap is a plain interval overlap.
    const along = (point: Point): number => point.x * unit.x + point.y * unit.y;

    const spans = group
      .map(({ wall }) => {
        const [from, to] = [along(wall.a), along(wall.b)].sort((l, r) => l - r);
        return { from, to, thickness: wall.thickness };
      })
      .sort((left, right) => left.from - right.from);

    let current = spans[0];
    const runs: typeof spans = [];

    for (const span of spans.slice(1)) {
      if (span.from <= current.to + tolerance) {
        current = { ...current, to: Math.max(current.to, span.to) };
      } else {
        runs.push(current);
        current = span;
      }
    }
    runs.push(current);

    const at = (position: number): Point => ({
      x: unit.x * position - unit.y * offset,
      y: unit.y * position + unit.x * offset,
    });

    for (const run of runs) {
      merged.push({
        id: createId("w"),
        a: at(run.from),
        b: at(run.to),
        thickness: run.thickness,
      });
    }
  }

  return merged;
}

/** Shifts every wall, opening anchor and room so the drawing starts at `origin`. */
export function translateLayout(layout: Layout, delta: Point): Layout {
  const move = (point: Point): Point => ({ x: point.x + delta.x, y: point.y + delta.y });

  return {
    ...layout,
    walls: layout.walls.map((wall) => ({ ...wall, a: move(wall.a), b: move(wall.b) })),
    rooms: layout.rooms.map((room) => ({ ...room, points: room.points.map(move) })),
  };
}

/** Everything gone, version and units kept. */
export function clearLayout(): Layout {
  return emptyLayout();
}

// --- formatting ------------------------------------------------------------

const metreFormatter = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const areaFormatter = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Centimetres as metres, the way a plan is dimensioned: "3,20 m". */
export function formatLength(centimetres: number): string {
  return `${metreFormatter.format(centimetres / 100)} m`;
}

/** Square centimetres as square metres: "12,4 m²". */
export function formatArea(squareCentimetres: number): string {
  return `${areaFormatter.format(squareCentimetres / 10_000)} m²`;
}
