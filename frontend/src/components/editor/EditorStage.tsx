"use client";

import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { useCallback, useMemo, useRef, useState } from "react";
import { Arc, Circle, Group, Layer, Line, Rect, Stage, Text } from "react-konva";

import { CANVAS_COLORS, CANVAS_WEIGHTS } from "@/components/editor/theme";
import {
  endpointAt,
  findWall,
  formatArea,
  formatLength,
  openingsOfWall,
  pointOnWall,
  roomArea,
  roomLabelAnchor,
  solidSegments,
  translateRoom,
  translateWall,
  updateOpening,
  updateWall,
  wallAt,
  wallJunctions,
  wallLength,
} from "@/lib/geometry/layout";
import {
  direction,
  distance,
  perpendicular,
  projectOnSegment,
  snapPoint,
  subtract,
} from "@/lib/geometry/vector";
import type { Layout, Opening, Point, Room, Wall } from "@/lib/schemas/layout";
import {
  useEditorStore,
  type Camera,
  type EditorTool,
  type Selection,
} from "@/lib/store/editorStore";

/**
 * The drawing surface. Everything visual about a plan happens here: the grid,
 * the walls, the doors and windows cut into them, the rooms and the previews of
 * whatever is being drawn.
 *
 * Coordinates are in centimetres and the whole scene lives in one Konva layer
 * carrying the camera transform, so a world point is just
 * `(screen - camera.xy) / camera.scale` — no per-shape maths, and one place to
 * change if the projection ever does.
 */

/** Grid spacings offered, in cm. The first one that is legible wins. */
const GRID_STEPS = [10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000] as const;

/** A grid line closer together than this on screen is noise, not a guide. */
const MIN_GRID_PIXELS = 9;

/** How far two clicks can land apart and still be one double click, in px. */
const DOUBLE_CLICK_SLOP = 8;
const MIN_MAJOR_GRID_PIXELS = 70;

/** Hard cap on grid lines per axis, so a zoomed-out view cannot stall. */
const MAX_GRID_LINES = 240;

/**
 * A drag in progress. `opened` tracks whether it has already taken its undo
 * point: a click that selects a shape without moving it must not leave an undo
 * step behind, so the snapshot is taken on the first real movement.
 */
type DragTarget =
  | { kind: "pan"; screen: Point }
  | { kind: "wall"; id: string; from: Point }
  | { kind: "endpoint"; id: string; end: "a" | "b" }
  | { kind: "room"; id: string; from: Point }
  | { kind: "opening"; id: string };

type DragState = DragTarget & { opened: boolean };

type EditorStageProps = { width: number; height: number };

export function EditorStage({ width, height }: EditorStageProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const dragRef = useRef<DragState | null>(null);
  /** Where the last two clicks landed on screen, for the double click check. */
  const clicksRef = useRef<[Point | null, Point | null]>([null, null]);
  const [hoverWallId, setHoverWallId] = useState<string | null>(null);

  const layout = useEditorStore((state) => state.layout);
  const camera = useEditorStore((state) => state.camera);
  const tool = useEditorStore((state) => state.tool);
  const selection = useEditorStore((state) => state.selection);
  const showGrid = useEditorStore((state) => state.showGrid);
  const showRooms = useEditorStore((state) => state.showRooms);
  const wallDraft = useEditorStore((state) => state.wallDraft);
  const roomDraft = useEditorStore((state) => state.roomDraft);

  const scale = camera.scale;
  /** Screen pixels expressed in world units, so strokes keep their weight. */
  const px = useCallback((value: number) => value / scale, [scale]);

  const worldAt = useCallback(
    (stage: Konva.Stage): Point | null => {
      const pointer = stage.getPointerPosition();
      if (pointer === null) return null;

      const { x, y, scale: zoom } = useEditorStore.getState().camera;
      return { x: (pointer.x - x) / zoom, y: (pointer.y - y) / zoom };
    },
    [],
  );

  /**
   * Turns a raw pointer position into where the drawing should actually go:
   * an existing corner if one is near, otherwise the grid, kept square with
   * `anchor` while ortho is on.
   */
  const resolvePoint = useCallback(
    (raw: Point, anchor: Point | null, options: { freeAngle?: boolean } = {}) => {
      const snapRadius = px(CANVAS_WEIGHTS.hitPadding);
      const corner = endpointAt(useEditorStore.getState().layout, raw, snapRadius);
      if (corner !== null) return corner;

      let point = snapPoint(raw, useEditorStore.getState().snapStep);

      const ortho = useEditorStore.getState().orthoEnabled && !options.freeAngle;
      if (ortho && anchor !== null) {
        // Axis lock rather than an angle rotation: it keeps the point on the
        // grid, which rotating it would not.
        const delta = subtract(point, anchor);
        point =
          Math.abs(delta.x) >= Math.abs(delta.y)
            ? { x: point.x, y: anchor.y }
            : { x: anchor.x, y: point.y };
      }

      return point;
    },
    [px],
  );

  // --- pointer handling ----------------------------------------------------

  const handleWheel = useCallback((event: KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault();

    const stage = event.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;

    // A trackpad pinch arrives as a wheel event with ctrlKey set; both end up
    // as the same zoom, just with different sensitivity.
    const intensity = event.evt.ctrlKey ? 0.01 : 0.0015;
    useEditorStore
      .getState()
      .zoomAt(Math.exp(-event.evt.deltaY * intensity), pointer);
  }, []);

  const handlePointerDown = useCallback(
    (event: KonvaEventObject<PointerEvent>) => {
      const stage = event.target.getStage();
      if (stage === null) return;

      // Konva decides a double click on timing alone, so keep the last two
      // click positions around to tell one apart from two quick corners.
      const pointer = stage.getPointerPosition();
      clicksRef.current = [clicksRef.current[1], pointer];

      const store = useEditorStore.getState();
      const world = worldAt(stage);
      if (world === null) return;

      // Middle button pans from any tool: the shortcut everyone tries first.
      const isMiddle = event.evt.button === 1;
      if (store.tool === "pan" || isMiddle) {
        // Panning moves the camera, never the drawing, so it takes no undo
        // point: `opened` starts true and nothing here ever calls `open`.
        if (pointer !== null) {
          dragRef.current = { kind: "pan", screen: pointer, opened: true };
        }
        return;
      }

      if (event.evt.button !== 0) return;

      switch (store.tool) {
        case "wall": {
          const anchor = store.wallDraft?.points.at(-1) ?? null;
          const point = resolvePoint(world, anchor, {
            freeAngle: event.evt.shiftKey,
          });

          if (store.wallDraft === null) store.beginWall(point);
          else store.commitWallPoint(point);
          return;
        }

        case "room": {
          store.beginRoom(resolvePoint(world, null));
          return;
        }

        case "door":
        case "window": {
          const hit = wallAt(store.layout, world, px(CANVAS_WEIGHTS.hitPadding));
          if (hit !== null) store.placeOpening(hit.wall.id, store.tool, hit.t);
          return;
        }

        default: {
          // Select: a click that did not land on a shape clears the selection.
          // The shapes stop propagation, so reaching here means empty canvas.
          store.select(null);
        }
      }
    },
    [px, resolvePoint, worldAt],
  );

  const handlePointerMove = useCallback(
    (event: KonvaEventObject<PointerEvent>) => {
      const stage = event.target.getStage();
      if (stage === null) return;

      const store = useEditorStore.getState();
      const world = worldAt(stage);
      if (world === null) return;

      const drag = dragRef.current;

      if (drag !== null) {
        applyDrag(drag, world, stage, {
          freeAngle: event.evt.shiftKey,
          resolvePoint,
        });
        return;
      }

      if (store.tool === "wall" && store.wallDraft !== null) {
        const anchor = store.wallDraft.points.at(-1) ?? null;
        store.moveWallCursor(
          resolvePoint(world, anchor, { freeAngle: event.evt.shiftKey }),
        );
        return;
      }

      if (store.tool === "room" && store.roomDraft !== null) {
        // No anchor: ortho is an axis lock, and locking a box drag to one axis
        // would flatten it into a line with no area to build a room from.
        store.moveRoom(resolvePoint(world, null));
        return;
      }

      // Highlight the wall a door or a window would land on.
      if (store.tool === "door" || store.tool === "window") {
        const hit = wallAt(store.layout, world, px(CANVAS_WEIGHTS.hitPadding));
        setHoverWallId(hit?.wall.id ?? null);
      } else if (hoverWallId !== null) {
        setHoverWallId(null);
      }
    },
    [hoverWallId, px, resolvePoint, worldAt],
  );

  const handlePointerUp = useCallback(() => {
    const store = useEditorStore.getState();

    if (store.tool === "room" && store.roomDraft !== null) store.commitRoom();

    dragRef.current = null;
  }, []);

  /** Double click, right click and Escape all mean "this run of walls is done". */
  const finishDraft = useCallback(() => useEditorStore.getState().endWall(), []);

  /**
   * Konva fires a double click for any two clicks inside its 400ms window,
   * however far apart they landed — and a wall run is drawn with quick clicks
   * on distant corners. Only a double click that stayed put means "done".
   */
  const finishDraftOnDoubleClick = useCallback(() => {
    const [previous, last] = clicksRef.current;
    if (
      previous === null ||
      last === null ||
      distance(previous, last) <= DOUBLE_CLICK_SLOP
    ) {
      finishDraft();
    }
  }, [finishDraft]);

  const handleContextMenu = useCallback(
    (event: KonvaEventObject<PointerEvent>) => {
      event.evt.preventDefault();
      finishDraft();
    },
    [finishDraft],
  );

  const startDrag = useCallback((state: DragTarget) => {
    // No undo point yet: `applyDrag` takes one the first time it moves
    // something, so selecting a shape stays free of history.
    dragRef.current = { ...state, opened: false };
  }, []);

  // --- derived scene data --------------------------------------------------

  const grid = useMemo(
    () => (showGrid ? buildGrid(camera, width, height) : null),
    [camera, height, showGrid, width],
  );

  const junctions = useMemo(() => wallJunctions(layout), [layout]);

  const draftPreview = useMemo(
    () => buildWallPreview(wallDraft),
    [wallDraft],
  );

  const cursorStyle = CURSORS[tool];

  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      style={{ cursor: cursorStyle }}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onDblClick={finishDraftOnDoubleClick}
      onDblTap={finishDraftOnDoubleClick}
      onContextMenu={handleContextMenu}
    >
      <Layer x={camera.x} y={camera.y} scaleX={scale} scaleY={scale}>
        {/* Millimetre paper. Never listens: it would swallow every click. */}
        {grid !== null ? (
          <Group listening={false}>
            {grid.minor.map((points, index) => (
              <Line
                key={`minor-${index}`}
                points={points}
                stroke={CANVAS_COLORS.gridMinor}
                strokeWidth={px(CANVAS_WEIGHTS.hairline)}
              />
            ))}
            {grid.major.map((points, index) => (
              <Line
                key={`major-${index}`}
                points={points}
                stroke={CANVAS_COLORS.gridMajor}
                strokeWidth={px(CANVAS_WEIGHTS.hairline)}
              />
            ))}
          </Group>
        ) : null}

        {showRooms
          ? layout.rooms.map((room) => (
              <RoomShape
                key={room.id}
                room={room}
                selected={isSelected(selection, "room", room.id)}
                px={px}
                onSelect={() => useEditorStore.getState().select({ kind: "room", id: room.id })}
                onDragStart={(from) => startDrag({ kind: "room", id: room.id, from })}
                interactive={tool === "select"}
              />
            ))
          : null}

        {layout.walls.map((wall) => (
          <WallShape
            key={wall.id}
            wall={wall}
            openings={openingsOfWall(layout, wall.id)}
            selected={isSelected(selection, "wall", wall.id)}
            highlighted={hoverWallId === wall.id}
            px={px}
            interactive={tool === "select"}
            onSelect={() => useEditorStore.getState().select({ kind: "wall", id: wall.id })}
            onDragStart={(from) => startDrag({ kind: "wall", id: wall.id, from })}
          />
        ))}

        {/* Corners are filled after the walls, so a junction is never notched. */}
        <Group listening={false}>
          {junctions.map((junction, index) => (
            <Circle
              key={`junction-${index}`}
              x={junction.point.x}
              y={junction.point.y}
              radius={junction.size / 2}
              fill={CANVAS_COLORS.wall}
            />
          ))}
        </Group>

        {layout.openings.map((opening) => {
          const wall = findWall(layout, opening.wall_id);
          if (wall === undefined) return null;

          return (
            <OpeningShape
              key={opening.id}
              opening={opening}
              wall={wall}
              selected={isSelected(selection, "opening", opening.id)}
              px={px}
              interactive={tool === "select"}
              onSelect={() =>
                useEditorStore.getState().select({ kind: "opening", id: opening.id })
              }
              onDragStart={() => startDrag({ kind: "opening", id: opening.id })}
            />
          );
        })}

        {/* Handles and previews sit on top of everything they describe. */}
        <SelectionOverlay
          layout={layout}
          selection={selection}
          px={px}
          interactive={tool === "select"}
          onEndpointDragStart={(id, end) => startDrag({ kind: "endpoint", id, end })}
        />

        {draftPreview !== null ? (
          <Group listening={false}>
            <Line
              points={draftPreview.points}
              stroke={CANVAS_COLORS.accentSoft}
              strokeWidth={px(CANVAS_WEIGHTS.medium)}
              dash={[px(10), px(8)]}
            />
            {draftPreview.length !== null ? (
              <LengthBadge
                at={draftPreview.midpoint}
                text={formatLength(draftPreview.length)}
                px={px}
              />
            ) : null}
          </Group>
        ) : null}

        {roomDraft !== null ? (
          <Group listening={false}>
            <Rect
              x={Math.min(roomDraft.from.x, roomDraft.to.x)}
              y={Math.min(roomDraft.from.y, roomDraft.to.y)}
              width={Math.abs(roomDraft.to.x - roomDraft.from.x)}
              height={Math.abs(roomDraft.to.y - roomDraft.from.y)}
              fill={CANVAS_COLORS.roomFillSelected}
              stroke={CANVAS_COLORS.accent}
              strokeWidth={px(CANVAS_WEIGHTS.medium)}
              dash={[px(10), px(8)]}
            />
            <LengthBadge
              at={{
                x: (roomDraft.from.x + roomDraft.to.x) / 2,
                y: (roomDraft.from.y + roomDraft.to.y) / 2,
              }}
              text={`${formatLength(Math.abs(roomDraft.to.x - roomDraft.from.x))} × ${formatLength(
                Math.abs(roomDraft.to.y - roomDraft.from.y),
              )}`}
              px={px}
            />
          </Group>
        ) : null}
      </Layer>
    </Stage>
  );
}

// --- drag handling ---------------------------------------------------------

function applyDrag(
  drag: DragState,
  world: Point,
  stage: Konva.Stage,
  options: {
    freeAngle: boolean;
    resolvePoint: (raw: Point, anchor: Point | null, opts?: { freeAngle?: boolean }) => Point;
  },
): void {
  const store = useEditorStore.getState();

  /** Takes the undo point, once, right before the first change of this drag. */
  const open = () => {
    if (drag.opened) return;
    drag.opened = true;
    store.beginTransaction();
  };

  if (drag.kind === "pan") {
    const pointer = stage.getPointerPosition();
    if (pointer === null) return;

    store.panBy(pointer.x - drag.screen.x, pointer.y - drag.screen.y);
    drag.screen = pointer;
    return;
  }

  if (drag.kind === "wall") {
    const target = snapPoint(world, store.snapStep);
    const delta = subtract(target, drag.from);
    if (delta.x === 0 && delta.y === 0) return;

    open();
    store.updateLive((layout) => translateWall(layout, drag.id, delta));
    drag.from = target;
    return;
  }

  if (drag.kind === "endpoint") {
    const wall = findWall(store.layout, drag.id);
    if (wall === undefined) return;

    const anchor = drag.end === "a" ? wall.b : wall.a;
    const point = options.resolvePoint(world, anchor, { freeAngle: options.freeAngle });

    // A wall collapsed onto itself would be rejected by the API anyway.
    if (distance(point, anchor) < 1) return;

    open();
    store.updateLive((layout) =>
      updateWall(layout, drag.id, drag.end === "a" ? { a: point } : { b: point }),
    );
    return;
  }

  if (drag.kind === "room") {
    const target = snapPoint(world, store.snapStep);
    const delta = subtract(target, drag.from);
    if (delta.x === 0 && delta.y === 0) return;

    open();
    store.updateLive((layout) => translateRoom(layout, drag.id, delta));
    drag.from = target;
    return;
  }

  // An opening only slides along the wall it was cut into.
  const opening = store.layout.openings.find((candidate) => candidate.id === drag.id);
  if (opening === undefined) return;

  const wall = findWall(store.layout, opening.wall_id);
  if (wall === undefined) return;

  const { t } = projectOnSegment(world, wall.a, wall.b);
  if (Math.abs(t - opening.position) < 0.0005) return;

  open();
  store.updateLive((layout) => updateOpening(layout, drag.id, { position: t }));
}

// --- shapes ----------------------------------------------------------------

type Pixels = (value: number) => number;

function WallShape({
  wall,
  openings,
  selected,
  highlighted,
  px,
  interactive,
  onSelect,
  onDragStart,
}: {
  wall: Wall;
  openings: Opening[];
  selected: boolean;
  highlighted: boolean;
  px: Pixels;
  interactive: boolean;
  onSelect: () => void;
  onDragStart: (from: Point) => void;
}) {
  const segments = solidSegments(wall, openings);

  return (
    <Group>
      {selected || highlighted ? (
        <Line
          listening={false}
          points={[wall.a.x, wall.a.y, wall.b.x, wall.b.y]}
          stroke={selected ? CANVAS_COLORS.accent : CANVAS_COLORS.accentSoft}
          strokeWidth={wall.thickness + px(8)}
          opacity={selected ? 0.35 : 0.22}
          lineCap="round"
        />
      ) : null}

      {/* What is actually built: the wall minus its doors and windows. */}
      {segments.map(([from, to], index) => {
        const start = pointOnWall(wall, from);
        const end = pointOnWall(wall, to);

        return (
          <Line
            key={`${wall.id}-${index}`}
            listening={false}
            points={[start.x, start.y, end.x, end.y]}
            stroke={CANVAS_COLORS.wall}
            strokeWidth={wall.thickness}
            lineCap="butt"
          />
        );
      })}

      {/*
        One invisible line covers the whole wall so it can be picked even where
        a door left a gap — clicking a doorway should still select its wall.
      */}
      <Line
        points={[wall.a.x, wall.a.y, wall.b.x, wall.b.y]}
        stroke="transparent"
        strokeWidth={wall.thickness}
        hitStrokeWidth={wall.thickness + px(CANVAS_WEIGHTS.hitPadding)}
        listening={interactive}
        onPointerDown={(event) => {
          if (event.evt.button !== 0) return;
          event.cancelBubble = true;
          onSelect();

          const stage = event.target.getStage();
          const pointer = stage?.getPointerPosition();
          if (!stage || !pointer) return;

          const { x, y, scale } = useEditorStore.getState().camera;
          const world = { x: (pointer.x - x) / scale, y: (pointer.y - y) / scale };
          onDragStart(snapPoint(world, useEditorStore.getState().snapStep));
        }}
      />
    </Group>
  );
}

function RoomShape({
  room,
  selected,
  px,
  interactive,
  onSelect,
  onDragStart,
}: {
  room: Room;
  selected: boolean;
  px: Pixels;
  interactive: boolean;
  onSelect: () => void;
  onDragStart: (from: Point) => void;
}) {
  const anchor = roomLabelAnchor(room);
  const area = roomArea(room);
  // A fixed width in screen pixels, so `align="center"` centres the label at
  // every zoom without measuring the text.
  const labelWidth = px(220);

  return (
    <Group>
      <Line
        points={room.points.flatMap((point) => [point.x, point.y])}
        closed
        fill={selected ? CANVAS_COLORS.roomFillSelected : CANVAS_COLORS.roomFill}
        listening={interactive}
        onPointerDown={(event) => {
          if (event.evt.button !== 0) return;
          event.cancelBubble = true;
          onSelect();

          const stage = event.target.getStage();
          const pointer = stage?.getPointerPosition();
          if (!stage || !pointer) return;

          const { x, y, scale } = useEditorStore.getState().camera;
          const world = { x: (pointer.x - x) / scale, y: (pointer.y - y) / scale };
          onDragStart(snapPoint(world, useEditorStore.getState().snapStep));
        }}
      />

      <Text
        listening={false}
        text={room.name}
        x={anchor.x - labelWidth / 2}
        y={anchor.y - px(CANVAS_WEIGHTS.roomFontSize)}
        width={labelWidth}
        align="center"
        fontSize={px(CANVAS_WEIGHTS.roomFontSize)}
        fontStyle="600"
        fill={CANVAS_COLORS.roomLabel}
      />
      <Text
        listening={false}
        text={formatArea(area)}
        x={anchor.x - labelWidth / 2}
        y={anchor.y + px(3)}
        width={labelWidth}
        align="center"
        fontSize={px(CANVAS_WEIGHTS.fontSize - 1)}
        fill={CANVAS_COLORS.roomLabel}
        opacity={0.65}
      />
    </Group>
  );
}

/**
 * A door or a window. The gap is already missing from the wall, so this only
 * draws the symbol: the leaf and its swing for a door, the glass line for a
 * window.
 */
function OpeningShape({
  opening,
  wall,
  selected,
  px,
  interactive,
  onSelect,
  onDragStart,
}: {
  opening: Opening;
  wall: Wall;
  selected: boolean;
  px: Pixels;
  interactive: boolean;
  onSelect: () => void;
  onDragStart: () => void;
}) {
  const total = wallLength(wall);
  if (total <= 0) return null;

  const unit = direction(wall.a, wall.b);
  const normal = perpendicular(unit);
  const half = Math.min(opening.width, total) / 2;
  const centre = pointOnWall(wall, opening.position);

  const start = { x: centre.x - unit.x * half, y: centre.y - unit.y * half };
  const end = { x: centre.x + unit.x * half, y: centre.y + unit.y * half };
  const offset = wall.thickness / 2;

  const stroke = selected ? CANVAS_COLORS.accent : CANVAS_COLORS.opening;
  const face = (sign: number): number[] => [
    start.x + normal.x * offset * sign,
    start.y + normal.y * offset * sign,
    end.x + normal.x * offset * sign,
    end.y + normal.y * offset * sign,
  ];

  const baseAngle = (Math.atan2(unit.y, unit.x) * 180) / Math.PI;
  const swing = opening.flipped ? -1 : 1;
  const leafEnd = {
    x: start.x + normal.x * half * 2 * swing,
    y: start.y + normal.y * half * 2 * swing,
  };

  return (
    <Group>
      <Group listening={false}>
        {/* The jambs: the wall faces carry on across the opening. */}
        <Line
          points={face(1)}
          stroke={CANVAS_COLORS.wall}
          strokeWidth={px(CANVAS_WEIGHTS.hairline)}
        />
        <Line
          points={face(-1)}
          stroke={CANVAS_COLORS.wall}
          strokeWidth={px(CANVAS_WEIGHTS.hairline)}
        />

        {opening.kind === "window" ? (
          <Line
            points={[start.x, start.y, end.x, end.y]}
            stroke={stroke}
            strokeWidth={px(CANVAS_WEIGHTS.medium)}
          />
        ) : (
          <>
            <Line
              points={[start.x, start.y, leafEnd.x, leafEnd.y]}
              stroke={stroke}
              strokeWidth={px(CANVAS_WEIGHTS.medium)}
            />
            <Arc
              x={start.x}
              y={start.y}
              innerRadius={half * 2}
              outerRadius={half * 2}
              angle={90}
              rotation={swing > 0 ? baseAngle : baseAngle - 90}
              stroke={stroke}
              strokeWidth={px(CANVAS_WEIGHTS.thin)}
              opacity={0.75}
            />
          </>
        )}
      </Group>

      <Line
        points={[start.x, start.y, end.x, end.y]}
        stroke="transparent"
        strokeWidth={Math.max(wall.thickness, px(10))}
        hitStrokeWidth={wall.thickness + px(CANVAS_WEIGHTS.hitPadding)}
        listening={interactive}
        onPointerDown={(event) => {
          if (event.evt.button !== 0) return;
          event.cancelBubble = true;
          onSelect();
          onDragStart();
        }}
      />
    </Group>
  );
}

/** Handles on whatever is selected: wall endpoints, room corners. */
function SelectionOverlay({
  layout,
  selection,
  px,
  interactive,
  onEndpointDragStart,
}: {
  layout: Layout;
  selection: Selection;
  px: Pixels;
  interactive: boolean;
  onEndpointDragStart: (wallId: string, end: "a" | "b") => void;
}) {
  if (selection === null || !interactive) return null;

  if (selection.kind === "wall") {
    const wall = findWall(layout, selection.id);
    if (wall === undefined) return null;

    const midpoint = pointOnWall(wall, 0.5);

    return (
      <Group>
        {(["a", "b"] as const).map((end) => (
          <Circle
            key={end}
            x={wall[end].x}
            y={wall[end].y}
            radius={px(CANVAS_WEIGHTS.handle)}
            fill={CANVAS_COLORS.sheet}
            stroke={CANVAS_COLORS.accent}
            strokeWidth={px(CANVAS_WEIGHTS.medium)}
            hitStrokeWidth={px(CANVAS_WEIGHTS.hitPadding)}
            onPointerDown={(event) => {
              if (event.evt.button !== 0) return;
              event.cancelBubble = true;
              onEndpointDragStart(wall.id, end);
            }}
          />
        ))}
        <LengthBadge at={midpoint} text={formatLength(wallLength(wall))} px={px} />
      </Group>
    );
  }

  if (selection.kind === "room") {
    const room = layout.rooms.find((candidate) => candidate.id === selection.id);
    if (room === undefined) return null;

    return (
      <Group listening={false}>
        <Line
          points={room.points.flatMap((point) => [point.x, point.y])}
          closed
          stroke={CANVAS_COLORS.accent}
          strokeWidth={px(CANVAS_WEIGHTS.selection)}
          dash={[px(8), px(6)]}
        />
      </Group>
    );
  }

  const opening = layout.openings.find((candidate) => candidate.id === selection.id);
  if (opening === undefined) return null;

  const wall = findWall(layout, opening.wall_id);
  if (wall === undefined) return null;

  const centre = pointOnWall(wall, opening.position);

  return (
    <Group listening={false}>
      <Circle
        x={centre.x}
        y={centre.y}
        radius={px(CANVAS_WEIGHTS.handle + 2)}
        stroke={CANVAS_COLORS.accent}
        strokeWidth={px(CANVAS_WEIGHTS.medium)}
      />
      <LengthBadge at={centre} text={formatLength(opening.width)} px={px} />
    </Group>
  );
}

/** A dark chip with a measurement, kept at a constant size on screen. */
function LengthBadge({ at, text, px }: { at: Point; text: string; px: Pixels }) {
  const fontSize = px(CANVAS_WEIGHTS.fontSize);
  const paddingX = px(7);
  const paddingY = px(4);
  // Monospaced-ish estimate: good enough for a chip that only holds numbers.
  const width = text.length * fontSize * 0.58 + paddingX * 2;
  const height = fontSize + paddingY * 2;

  return (
    <Group listening={false} x={at.x - width / 2} y={at.y - height - px(10)}>
      <Rect
        width={width}
        height={height}
        cornerRadius={height / 2}
        fill={CANVAS_COLORS.badge}
        opacity={0.88}
      />
      <Text
        text={text}
        width={width}
        y={paddingY}
        align="center"
        fontSize={fontSize}
        fill={CANVAS_COLORS.badgeText}
      />
    </Group>
  );
}

// --- helpers ---------------------------------------------------------------

function isSelected(
  selection: Selection,
  kind: NonNullable<Selection>["kind"],
  id: string,
): boolean {
  return selection !== null && selection.kind === kind && selection.id === id;
}

const CURSORS: Record<EditorTool, string> = {
  select: "default",
  pan: "grab",
  wall: "crosshair",
  room: "crosshair",
  door: "copy",
  window: "copy",
};

/**
 * Grid lines for what is on screen, and only for what is on screen: a fixed
 * grid over the whole coordinate space would be tens of thousands of lines.
 */
function buildGrid(camera: Camera, width: number, height: number) {
  const step = GRID_STEPS.find((candidate) => candidate * camera.scale >= MIN_GRID_PIXELS);
  const major =
    GRID_STEPS.find((candidate) => candidate * camera.scale >= MIN_MAJOR_GRID_PIXELS) ??
    null;

  if (step === undefined) return null;

  const left = -camera.x / camera.scale;
  const top = -camera.y / camera.scale;
  const right = left + width / camera.scale;
  const bottom = top + height / camera.scale;

  const minorLines: number[][] = [];
  const majorLines: number[][] = [];

  const push = (points: number[], value: number) => {
    if (major !== null && Math.abs(value % major) < 0.001) majorLines.push(points);
    else minorLines.push(points);
  };

  const firstX = Math.floor(left / step) * step;
  for (let x = firstX, count = 0; x <= right && count < MAX_GRID_LINES; x += step, count += 1) {
    push([x, top, x, bottom], x);
  }

  const firstY = Math.floor(top / step) * step;
  for (let y = firstY, count = 0; y <= bottom && count < MAX_GRID_LINES; y += step, count += 1) {
    push([left, y, right, y], y);
  }

  return { minor: minorLines, major: majorLines };
}

/** The rubber band of the wall run: what is placed plus the live segment. */
function buildWallPreview(draft: { points: Point[]; cursor: Point | null } | null) {
  if (draft === null || draft.points.length === 0) return null;

  const points = [...draft.points, ...(draft.cursor ? [draft.cursor] : [])];
  const last = points.at(-1);
  const previous = points.at(-2);

  return {
    points: points.flatMap((point) => [point.x, point.y]),
    length: last && previous ? distance(previous, last) : null,
    midpoint:
      last && previous
        ? { x: (last.x + previous.x) / 2, y: (last.y + previous.y) / 2 }
        : (last ?? { x: 0, y: 0 }),
  };
}
