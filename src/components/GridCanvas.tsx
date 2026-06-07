import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Canvas,
  Circle,
  Fill,
  Group,
  Line,
  RoundedRect,
  useClock,
} from '@shopify/react-native-skia';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from 'react-native-reanimated';

import { useFactoryStore } from '../store/useFactoryStore';
import { useUIStore } from '../store/useUIStore';
import { placementDragShared } from '../store/placementDragShared';
import { ConnectionPortId, FactoryNode, NodeType, ResourceEdge } from '../types';
import {
  STANDARD_NODE_SIZE,
  getFactoryNodeFootprintSize,
  getNodeFootprintSize,
} from '../data/nodes';

interface GridCanvasProps {
  onPlaceNode: (nodeType: NodeType, worldX: number, worldY: number) => void;
  onTapNode: (nodeId: string) => void;
  onTapEmpty: () => void;
  onDrawConnection: (
    sourceNodeId: string,
    targetNodeId: string,
    sourcePortId?: ConnectionPortId,
    targetPortId?: ConnectionPortId
  ) => void;
}

const GRID_CELL_SIZE = 80;
const LEGACY_NODE_OFFSET = (GRID_CELL_SIZE - STANDARD_NODE_SIZE) / 2;
const DOT_SPACING = 40;
const DOT_RADIUS = 1.5;
const DOT_COLOR = 'rgba(0, 188, 212, 0.25)';

const CANVAS_WIDTH = 2000;
const CANVAS_HEIGHT = 2000;
const NODE_DRAW_HIT_PADDING = 10;
const PORT_RADIUS = 5;
const PORT_HIT_RADIUS = 16;
const PLACEMENT_DROP_TOLERANCE = 24;
const ITEM_MARKER_SIZE = 6;
const MIN_ITEM_TRAVEL_DURATION_MS = 650;
const MAX_ITEM_TRAVEL_DURATION_MS = 4200;

const MIN_SCALE = 0.3;
const MAX_SCALE = 3.0;
const FLUID_MATERIAL_IDS = new Set(['chronal_fluid']);
const RAW_MATERIAL_IDS = new Set([
  'hydrocarbon',
  'catalyst',
  'plasma',
  'raw_exotic',
  'probability_ore',
]);
const VOID_MATERIAL_COLORS: Record<string, string> = {
  void_ore: '#B388FF',
  umbralite_ore: '#7C4DFF',
  nullglass_ore: '#E040FB',
  vesper_charge: '#40C4FF',
  ecliptic_brine: '#00B8D4',
  paradoxite_ore: '#FF4081',
  horizon_shard: '#69F0AE',
  aurora_null: '#64FFDA',
  chronosilt: '#536DFE',
  apex_echo: '#FFD740',
  genesis_cinder: '#FF6E40',
};
const DOT_POSITIONS = (() => {
  const positions: Array<{ x: number; y: number }> = [];
  for (let x = 0; x <= CANVAS_WIDTH; x += DOT_SPACING) {
    for (let y = 0; y <= CANVAS_HEIGHT; y += DOT_SPACING) {
      positions.push({ x, y });
    }
  }
  return positions;
})();

type OperationalStatus = FactoryNode['operationalStatus'];
type NodeBounds = {
  id: string;
  x: number;
  y: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
  cx: number;
  cy: number;
  size: number;
  ports: ConnectionPort[];
};
type ConnectionPort = {
  id: ConnectionPortId;
  nodeId: string;
  x: number;
  y: number;
};

const GridDots = React.memo(function GridDots() {
  return (
    <>
      {DOT_POSITIONS.map((dot, index) => (
        <Circle
          key={`dot_${index}`}
          cx={dot.x}
          cy={dot.y}
          r={DOT_RADIUS}
          color={DOT_COLOR}
        />
      ))}
    </>
  );
});

function getNodeBorderColor(status: OperationalStatus): string {
  switch (status) {
    case 'OPERATIONAL':
      return '#00BCD4';
    case 'STARVED':
      return '#FF9800';
    case 'WARNING':
      return '#FF5722';
    case 'STALLED':
      return '#F44336';
    default:
      return '#607D8B';
  }
}

function getMaterialTransportColor(materialId: string): string {
  const voidColor = VOID_MATERIAL_COLORS[materialId];
  if (voidColor) {
    return voidColor;
  }
  if (FLUID_MATERIAL_IDS.has(materialId)) {
    return '#2196F3';
  }
  if (RAW_MATERIAL_IDS.has(materialId)) {
    return '#FF9800';
  }
  return '#FFFFFF';
}

function getItemTravelDurationMs(edge: ResourceEdge, distance: number): number {
  const utilization = edge.maxCapacityRate > 0
    ? Math.min(1, edge.currentFlowRate / edge.maxCapacityRate)
    : 0;
  const pixelsPerSecond = 45 + Math.sqrt(utilization) * 135;
  return Math.max(
    MIN_ITEM_TRAVEL_DURATION_MS,
    Math.min(MAX_ITEM_TRAVEL_DURATION_MS, (distance / pixelsPerSecond) * 1000)
  );
}

function ResourceConnection({
  edge,
  sourcePoint,
  targetPoint,
}: {
  edge: ResourceEdge;
  sourcePoint: { x: number; y: number };
  targetPoint: { x: number; y: number };
}) {
  const clock = useClock();
  const color = getMaterialTransportColor(edge.materialId);
  const distance = Math.hypot(targetPoint.x - sourcePoint.x, targetPoint.y - sourcePoint.y);
  const durationMs = getItemTravelDurationMs(edge, distance);
  const markerX = useDerivedValue(() => {
    const progress = (clock.value % durationMs) / durationMs;
    return sourcePoint.x + (targetPoint.x - sourcePoint.x) * progress - ITEM_MARKER_SIZE / 2;
  });
  const markerY = useDerivedValue(() => {
    const progress = (clock.value % durationMs) / durationMs;
    return sourcePoint.y + (targetPoint.y - sourcePoint.y) * progress - ITEM_MARKER_SIZE / 2;
  });

  return (
    <Group>
      <Line
        p1={sourcePoint}
        p2={targetPoint}
        color={color}
        opacity={0.72}
        strokeWidth={2}
      />
      {edge.currentFlowRate > 0.001 && (
        <RoundedRect
          x={markerX}
          y={markerY}
          width={ITEM_MARKER_SIZE}
          height={ITEM_MARKER_SIZE}
          r={1}
          color={color}
        />
      )}
    </Group>
  );
}

function PlacedStructureIcon({
  type,
  x,
  y,
  size,
}: {
  type: NodeType;
  x: number;
  y: number;
  size: number;
}) {
  const accent = '#00BCD4';
  const unit = size / STANDARD_NODE_SIZE;
  const sx = (value: number) => x + value * unit;
  const sy = (value: number) => y + value * unit;
  const strokeWidth = Math.max(1.25, 2 * unit);

  switch (type) {
    case 'POWER_GENERATOR':
      return (
        <>
          <RoundedRect x={sx(22)} y={sy(13)} width={20 * unit} height={38 * unit} r={4 * unit} color={accent} style="stroke" strokeWidth={strokeWidth} />
          <Circle cx={sx(32)} cy={sy(32)} r={7 * unit} color={accent} style="stroke" strokeWidth={strokeWidth} />
          <Line p1={{ x: sx(13), y: sy(24) }} p2={{ x: sx(21), y: sy(29) }} color={accent} strokeWidth={strokeWidth} />
          <Line p1={{ x: sx(43), y: sy(29) }} p2={{ x: sx(51), y: sy(24) }} color={accent} strokeWidth={strokeWidth} />
          <Line p1={{ x: sx(13), y: sy(40) }} p2={{ x: sx(21), y: sy(35) }} color={accent} strokeWidth={strokeWidth} />
          <Line p1={{ x: sx(43), y: sy(35) }} p2={{ x: sx(51), y: sy(40) }} color={accent} strokeWidth={strokeWidth} />
        </>
      );
    case 'HARVESTER':
      return (
        <>
          <RoundedRect x={sx(17)} y={sy(14)} width={30 * unit} height={22 * unit} r={4 * unit} color={accent} style="stroke" strokeWidth={strokeWidth} />
          <Line p1={{ x: sx(22), y: sy(38) }} p2={{ x: sx(18), y: sy(49) }} color={accent} strokeWidth={strokeWidth} />
          <Line p1={{ x: sx(42), y: sy(38) }} p2={{ x: sx(46), y: sy(49) }} color={accent} strokeWidth={strokeWidth} />
          <Line p1={{ x: sx(32), y: sy(36) }} p2={{ x: sx(32), y: sy(53) }} color={accent} strokeWidth={strokeWidth + unit} />
          <Line p1={{ x: sx(27), y: sy(48) }} p2={{ x: sx(32), y: sy(55) }} color={accent} strokeWidth={strokeWidth} />
          <Line p1={{ x: sx(37), y: sy(48) }} p2={{ x: sx(32), y: sy(55) }} color={accent} strokeWidth={strokeWidth} />
        </>
      );
    case 'REFINER':
      return (
        <>
          <RoundedRect x={sx(14)} y={sy(18)} width={15 * unit} height={31 * unit} r={6 * unit} color={accent} style="stroke" strokeWidth={strokeWidth} />
          <RoundedRect x={sx(35)} y={sy(18)} width={15 * unit} height={31 * unit} r={6 * unit} color={accent} style="stroke" strokeWidth={strokeWidth} />
          <Line p1={{ x: sx(29), y: sy(27) }} p2={{ x: sx(35), y: sy(27) }} color={accent} strokeWidth={strokeWidth} />
          <Circle cx={sx(32)} cy={sy(38)} r={4 * unit} color={accent} />
        </>
      );
    case 'ASSEMBLER':
      return (
        <>
          <RoundedRect x={sx(17)} y={sy(20)} width={30 * unit} height={28 * unit} r={4 * unit} color={accent} style="stroke" strokeWidth={strokeWidth} />
          <Line p1={{ x: sx(17), y: sy(26) }} p2={{ x: sx(10), y: sy(18) }} color={accent} strokeWidth={strokeWidth + unit} />
          <Line p1={{ x: sx(47), y: sy(26) }} p2={{ x: sx(54), y: sy(18) }} color={accent} strokeWidth={strokeWidth + unit} />
          <Circle cx={sx(32)} cy={sy(34)} r={7 * unit} color={accent} style="stroke" strokeWidth={strokeWidth} />
        </>
      );
    case 'STORAGE':
      return (
        <>
          <RoundedRect x={sx(15)} y={sy(14)} width={34 * unit} height={11 * unit} r={3 * unit} color={accent} style="stroke" strokeWidth={strokeWidth} />
          <RoundedRect x={sx(15)} y={sy(27)} width={34 * unit} height={11 * unit} r={3 * unit} color={accent} style="stroke" strokeWidth={strokeWidth} />
          <RoundedRect x={sx(15)} y={sy(40)} width={34 * unit} height={11 * unit} r={3 * unit} color={accent} style="stroke" strokeWidth={strokeWidth} />
        </>
      );
    case 'SINK':
      return (
        <>
          <Line p1={{ x: sx(15), y: sy(17) }} p2={{ x: sx(27), y: sy(34) }} color={accent} strokeWidth={strokeWidth} />
          <Line p1={{ x: sx(49), y: sy(17) }} p2={{ x: sx(37), y: sy(34) }} color={accent} strokeWidth={strokeWidth} />
          <Line p1={{ x: sx(27), y: sy(34) }} p2={{ x: sx(37), y: sy(34) }} color={accent} strokeWidth={strokeWidth} />
          <Line p1={{ x: sx(32), y: sy(34) }} p2={{ x: sx(32), y: sy(45) }} color={accent} strokeWidth={strokeWidth + unit} />
          <RoundedRect x={sx(20)} y={sy(45)} width={24 * unit} height={7 * unit} r={3 * unit} color={accent} style="stroke" strokeWidth={strokeWidth} />
        </>
      );
    case 'RELAY':
      return (
        <>
          <Line p1={{ x: sx(32), y: sy(24) }} p2={{ x: sx(32), y: sy(49) }} color={accent} strokeWidth={strokeWidth + unit} />
          <Line p1={{ x: sx(20), y: sy(52) }} p2={{ x: sx(44), y: sy(52) }} color={accent} strokeWidth={strokeWidth} />
          <Circle cx={sx(32)} cy={sy(22)} r={4 * unit} color={accent} />
          <Circle cx={sx(32)} cy={sy(22)} r={11 * unit} color={accent} style="stroke" strokeWidth={strokeWidth} />
          <Circle cx={sx(32)} cy={sy(22)} r={18 * unit} color={accent} style="stroke" strokeWidth={strokeWidth} />
        </>
      );
    case 'FEEDBACK_REGULATOR':
      return (
        <>
          <Circle cx={sx(32)} cy={sy(32)} r={17 * unit} color={accent} style="stroke" strokeWidth={strokeWidth} />
          <Circle cx={sx(32)} cy={sy(32)} r={6 * unit} color={accent} />
          <Line p1={{ x: sx(8), y: sy(32) }} p2={{ x: sx(15), y: sy(32) }} color={accent} strokeWidth={strokeWidth} />
          <Line p1={{ x: sx(49), y: sy(32) }} p2={{ x: sx(56), y: sy(32) }} color={accent} strokeWidth={strokeWidth} />
        </>
      );
    case 'MERGE_UNIT':
      return (
        <>
          <Line p1={{ x: sx(5), y: sy(15) }} p2={{ x: sx(32), y: sy(32) }} color={accent} strokeWidth={strokeWidth} />
          <Line p1={{ x: sx(5), y: sy(49) }} p2={{ x: sx(32), y: sy(32) }} color={accent} strokeWidth={strokeWidth} />
          <Line p1={{ x: sx(32), y: sy(32) }} p2={{ x: sx(59), y: sy(32) }} color={accent} strokeWidth={strokeWidth} />
          <Circle cx={sx(32)} cy={sy(32)} r={6 * unit} color={accent} style="stroke" strokeWidth={strokeWidth} />
        </>
      );
    case 'SPLIT_UNIT':
      return (
        <>
          <Line p1={{ x: sx(5), y: sy(32) }} p2={{ x: sx(32), y: sy(32) }} color={accent} strokeWidth={strokeWidth} />
          <Line p1={{ x: sx(32), y: sy(32) }} p2={{ x: sx(59), y: sy(15) }} color={accent} strokeWidth={strokeWidth} />
          <Line p1={{ x: sx(32), y: sy(32) }} p2={{ x: sx(59), y: sy(49) }} color={accent} strokeWidth={strokeWidth} />
          <Circle cx={sx(32)} cy={sy(32)} r={6 * unit} color={accent} style="stroke" strokeWidth={strokeWidth} />
        </>
      );
  }
}

function getNodeOrigin(node: FactoryNode): { x: number; y: number } {
  return {
    x: node.x ?? node.gridX * GRID_CELL_SIZE + LEGACY_NODE_OFFSET,
    y: node.y ?? node.gridY * GRID_CELL_SIZE + LEGACY_NODE_OFFSET,
  };
}

function getConnectionPorts(nodeId: string, x: number, y: number, size: number): ConnectionPort[] {
  const left = x;
  const top = y;
  const right = x + size;
  const bottom = y + size;
  const midX = x + size / 2;
  const midY = y + size / 2;

  return [
    { id: 'port_0', nodeId, x: midX, y: top },
    { id: 'port_1', nodeId, x: right, y: top },
    { id: 'port_2', nodeId, x: right, y: midY },
    { id: 'port_3', nodeId, x: right, y: bottom },
    { id: 'port_4', nodeId, x: midX, y: bottom },
    { id: 'port_5', nodeId, x: left, y: bottom },
    { id: 'port_6', nodeId, x: left, y: midY },
    { id: 'port_7', nodeId, x: left, y: top },
  ];
}

function findHitNode(bounds: NodeBounds[], worldX: number, worldY: number): NodeBounds | undefined {
  'worklet';

  for (const node of bounds) {
    if (
      worldX >= node.left &&
      worldX <= node.right &&
      worldY >= node.top &&
      worldY <= node.bottom
    ) {
      return node;
    }
  }

  return undefined;
}

function findHitPort(bounds: NodeBounds[], worldX: number, worldY: number, ignoredNodeId?: string): ConnectionPort | undefined {
  'worklet';

  for (const node of bounds) {
    for (const port of node.ports) {
      if (port.nodeId === ignoredNodeId) {
        continue;
      }

      const dx = worldX - port.x;
      const dy = worldY - port.y;

      if (Math.sqrt(dx * dx + dy * dy) <= PORT_HIT_RADIUS) {
        return port;
      }
    }
  }

  return undefined;
}

export default function GridCanvas({ onPlaceNode, onTapNode, onTapEmpty, onDrawConnection }: GridCanvasProps) {
  const nodesRecord = useFactoryStore((s) => s.nodes);
  const edgesRecord = useFactoryStore((s) => s.edges);
  const moveNode = useFactoryStore((s) => s.moveNode);
  const nodes = useMemo(() => new Map(Object.entries(nodesRecord)), [nodesRecord]);
  const edges = useMemo(() => new Map(Object.entries(edgesRecord)), [edgesRecord]);
  const selectedNodeId = useUIStore((s) => s.selectedNodeId);
  const connectingFromId = useUIStore((s) => s.connectingFromId);
  const placementDrop = useUIStore((s) => s.placementDrop);
  const clearPlacementDrop = useUIStore((s) => s.clearPlacementDrop);

  const containerRef = useRef<View>(null);
  const transformSnapshot = useRef({ translateX: 0, translateY: 0, scale: 1 });
  const containerPageX = useSharedValue(0);
  const containerPageY = useSharedValue(0);
  const containerWidth = useSharedValue(0);
  const containerHeight = useSharedValue(0);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1.0);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const isDrawingConnection = useSharedValue(false);
  const movingNodeId = useSharedValue('');
  const movingNodeGrabOffsetX = useSharedValue(0);
  const movingNodeGrabOffsetY = useSharedValue(0);
  const movingNodeSize = useSharedValue(STANDARD_NODE_SIZE);
  const movingNodeX = useSharedValue(0);
  const movingNodeY = useSharedValue(0);
  const connectionSourceId = useSharedValue('');
  const connectionSourcePortId = useSharedValue<ConnectionPortId | ''>('');
  const connectionTargetId = useSharedValue('');
  const connectionStartX = useSharedValue(0);
  const connectionStartY = useSharedValue(0);
  const connectionEndX = useSharedValue(0);
  const connectionEndY = useSharedValue(0);
  const draftConnectionStart = useDerivedValue(() => ({
    x: connectionStartX.value,
    y: connectionStartY.value,
  }));
  const draftConnectionEnd = useDerivedValue(() => ({
    x: connectionEndX.value,
    y: connectionEndY.value,
  }));

  const [stalledPulse, setStalledPulse] = useState(1.0);
  const [draftConnectionSourceId, setDraftConnectionSourceId] = useState<string | null>(null);
  const [draftConnectionTargetId, setDraftConnectionTargetId] = useState<string | null>(null);
  const [movingNodeVisualId, setMovingNodeVisualId] = useState<string | null>(null);

  useEffect(() => {
    let dimmed = false;
    const intervalId = setInterval(() => {
      dimmed = !dimmed;
      setStalledPulse(dimmed ? 0.35 : 1.0);
    }, 700);

    return () => clearInterval(intervalId);
  }, []);

  const nodeList = useMemo(() => Array.from(nodes.values()), [nodes]);
  const edgeList = useMemo(() => Array.from(edges.values()), [edges]);
  const nodeLayoutKey = useMemo(
    () => nodeList
      .map((node) => {
        const { x, y } = getNodeOrigin(node);
        return `${node.id}:${x}:${y}:${node.type}:${getFactoryNodeFootprintSize(node)}`;
      })
      .sort()
      .join('|'),
    [nodeList]
  );
  const drawableNodeBounds = useMemo(() => nodeList.map((node) => {
    const { x, y } = getNodeOrigin(node);
    const size = getFactoryNodeFootprintSize(node);
    return {
      id: node.id,
      x,
      y,
      left: x - NODE_DRAW_HIT_PADDING,
      top: y - NODE_DRAW_HIT_PADDING,
      right: x + size + NODE_DRAW_HIT_PADDING,
      bottom: y + size + NODE_DRAW_HIT_PADDING,
      cx: x + size / 2,
      cy: y + size / 2,
      size,
      ports: getConnectionPorts(node.id, x, y, size),
    };
  }), [nodeList]);

  const nodeBoundsById = useMemo(() => {
    const map = new Map<string, NodeBounds>();
    for (const bounds of drawableNodeBounds) {
      map.set(bounds.id, bounds);
    }
    return map;
  }, [drawableNodeBounds]);

  const visiblePortNodeIds = useMemo(
    () => new Set([selectedNodeId, connectingFromId, draftConnectionSourceId, draftConnectionTargetId].filter(Boolean) as string[]),
    [connectingFromId, draftConnectionSourceId, draftConnectionTargetId, selectedNodeId]
  );

  const mirrorTransform = useCallback((next: { translateX: number; translateY: number; scale: number }) => {
    transformSnapshot.current = next;
  }, []);

  const beginDraftConnection = useCallback((sourceNodeId: string) => {
    setDraftConnectionSourceId(sourceNodeId);
    setDraftConnectionTargetId(null);
  }, []);

  const clearDraftConnection = useCallback(() => {
    setDraftConnectionSourceId(null);
    setDraftConnectionTargetId(null);
  }, []);

  const updateDraftConnectionTarget = useCallback((targetNodeId: string | null) => {
    setDraftConnectionTargetId(targetNodeId);
  }, []);

  const finishDraftConnection = useCallback(
    (sourceNodeId: string, sourcePortId: ConnectionPortId, worldX: number, worldY: number) => {
      clearDraftConnection();
      const targetPort = findHitPort(drawableNodeBounds, worldX, worldY, sourceNodeId);

      if (targetPort) {
        onDrawConnection(sourceNodeId, targetPort.nodeId, sourcePortId, targetPort.id);
      }
    },
    [clearDraftConnection, drawableNodeBounds, onDrawConnection]
  );

  const beginMovingNode = useCallback((nodeId: string) => {
    clearPlacementDrop();
    setMovingNodeVisualId(nodeId);
  }, [clearPlacementDrop]);

  const finishMovingNode = useCallback(
    (nodeId: string, worldX: number, worldY: number) => {
      moveNode(nodeId, worldX, worldY);
      setMovingNodeVisualId(null);
    },
    [moveNode]
  );

  const cancelMovingNode = useCallback(() => {
    setMovingNodeVisualId(null);
  }, []);

  useEffect(() => {
    if (!placementDrop) {
      return;
    }

    containerRef.current?.measureInWindow((pageX, pageY, width, height) => {
      const isInside =
        placementDrop.absoluteX >= pageX - PLACEMENT_DROP_TOLERANCE &&
        placementDrop.absoluteX <= pageX + width + PLACEMENT_DROP_TOLERANCE &&
        placementDrop.absoluteY >= pageY - PLACEMENT_DROP_TOLERANCE &&
        placementDrop.absoluteY <= pageY + height + PLACEMENT_DROP_TOLERANCE;

      if (isInside) {
        const transform = transformSnapshot.current;
        const nodeSize = getNodeFootprintSize(placementDrop.nodeType);
        const worldX = (placementDrop.absoluteX - pageX - transform.translateX) / transform.scale - nodeSize / 2;
        const worldY = (placementDrop.absoluteY - pageY - transform.translateY) / transform.scale - nodeSize / 2;
        onPlaceNode(
          placementDrop.nodeType,
          Math.max(0, Math.min(CANVAS_WIDTH - nodeSize, worldX)),
          Math.max(0, Math.min(CANVAS_HEIGHT - nodeSize, worldY))
        );
      }

      clearPlacementDrop();
    });
  }, [clearPlacementDrop, onPlaceNode, placementDrop]);

  const nodeMoveGesture = Gesture.Pan()
    .minDistance(2)
    .onTouchesDown((e, stateManager) => {
      const touch = e.allTouches[0];
      if (!touch) {
        stateManager.fail();
        return;
      }

      const worldX = (touch.x - translateX.value) / scale.value;
      const worldY = (touch.y - translateY.value) / scale.value;
      const startsOnConnectionPort = Boolean(findHitPort(drawableNodeBounds, worldX, worldY));

      if (startsOnConnectionPort || !findHitNode(drawableNodeBounds, worldX, worldY)) {
        stateManager.fail();
      }
    })
    .onStart((e) => {
      const worldX = (e.x - translateX.value) / scale.value;
      const worldY = (e.y - translateY.value) / scale.value;
      const hitNode = findHitNode(drawableNodeBounds, worldX, worldY);
      if (!hitNode) {
        return;
      }

      movingNodeId.value = hitNode.id;
      movingNodeGrabOffsetX.value = worldX - hitNode.x;
      movingNodeGrabOffsetY.value = worldY - hitNode.y;
      movingNodeSize.value = hitNode.size;
      movingNodeX.value = hitNode.x;
      movingNodeY.value = hitNode.y;
      runOnJS(beginMovingNode)(hitNode.id);
    })
    .onUpdate((e) => {
      if (!movingNodeId.value) {
        return;
      }

      const worldX = (e.x - translateX.value) / scale.value;
      const worldY = (e.y - translateY.value) / scale.value;
      const nextX = Math.max(
        0,
        Math.min(CANVAS_WIDTH - movingNodeSize.value, worldX - movingNodeGrabOffsetX.value)
      );
      const nextY = Math.max(
        0,
        Math.min(CANVAS_HEIGHT - movingNodeSize.value, worldY - movingNodeGrabOffsetY.value)
      );

      movingNodeX.value = nextX;
      movingNodeY.value = nextY;
    })
    .onEnd(() => {
      if (!movingNodeId.value) {
        return;
      }

      runOnJS(finishMovingNode)(movingNodeId.value, movingNodeX.value, movingNodeY.value);
    })
    .onFinalize((_event, success) => {
      if (!success && movingNodeId.value) {
        runOnJS(cancelMovingNode)();
      }
      movingNodeId.value = '';
    });

  const panGesture = Gesture.Pan()
    .requireExternalGestureToFail(nodeMoveGesture)
    .onStart((e) => {
      const worldX = (e.x - translateX.value) / scale.value;
      const worldY = (e.y - translateY.value) / scale.value;
      const sourcePort = findHitPort(drawableNodeBounds, worldX, worldY);

      if (sourcePort) {
        isDrawingConnection.value = true;
        connectionSourceId.value = sourcePort.nodeId;
        connectionSourcePortId.value = sourcePort.id;
        connectionTargetId.value = '';
        connectionStartX.value = sourcePort.x;
        connectionStartY.value = sourcePort.y;
        connectionEndX.value = worldX;
        connectionEndY.value = worldY;
        runOnJS(beginDraftConnection)(sourcePort.nodeId);
        return;
      }

      isDrawingConnection.value = false;
      connectionSourceId.value = '';
      connectionSourcePortId.value = '';
      connectionTargetId.value = '';
      panStartX.value = translateX.value - e.translationX;
      panStartY.value = translateY.value - e.translationY;
    })
    .onUpdate((e) => {
      if (isDrawingConnection.value) {
        const worldX = (e.x - translateX.value) / scale.value;
        const worldY = (e.y - translateY.value) / scale.value;
        connectionEndX.value = worldX;
        connectionEndY.value = worldY;
        const hoveredNode = findHitNode(drawableNodeBounds, worldX, worldY);
        const nextTargetId = hoveredNode && hoveredNode.id !== connectionSourceId.value ? hoveredNode.id : '';

        if (nextTargetId !== connectionTargetId.value) {
          connectionTargetId.value = nextTargetId;
          runOnJS(updateDraftConnectionTarget)(nextTargetId || null);
        }
        return;
      }

      translateX.value = panStartX.value + e.translationX;
      translateY.value = panStartY.value + e.translationY;
      runOnJS(mirrorTransform)({ translateX: translateX.value, translateY: translateY.value, scale: scale.value });
    })
    .onFinalize((e) => {
      if (!isDrawingConnection.value) {
        return;
      }

      const worldX = (e.x - translateX.value) / scale.value;
      const worldY = (e.y - translateY.value) / scale.value;
      runOnJS(finishDraftConnection)(connectionSourceId.value, connectionSourcePortId.value as ConnectionPortId, worldX, worldY);
      isDrawingConnection.value = false;
      connectionSourceId.value = '';
      connectionSourcePortId.value = '';
      connectionTargetId.value = '';
    });

  const lastScale = useSharedValue(1.0);
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      lastScale.value = scale.value;
    })
    .onUpdate((e) => {
      const newScale = lastScale.value * e.scale;
      scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
      runOnJS(mirrorTransform)({ translateX: translateX.value, translateY: translateY.value, scale: scale.value });
    });

  const handleCanvasTap = useCallback(
    (worldX: number, worldY: number) => {
      const tappedNode = findHitNode(drawableNodeBounds, worldX, worldY);

      if (tappedNode) {
        onTapNode(tappedNode.id);
        return;
      }

      onTapEmpty();
    },
    [drawableNodeBounds, onTapEmpty, onTapNode]
  );

  const tapGesture = Gesture.Tap()
    .onEnd((e) => {
      const worldX = (e.x - translateX.value) / scale.value;
      const worldY = (e.y - translateY.value) / scale.value;

      runOnJS(handleCanvasTap)(worldX, worldY);
    });

  const pressGesture = Gesture.Exclusive(nodeMoveGesture, tapGesture);
  const composed = Gesture.Simultaneous(panGesture, pinchGesture, pressGesture);

  const canvasAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const placementPreviewStyle = useAnimatedStyle(() => {
    const localX = placementDragShared.absoluteX.value - containerPageX.value;
    const localY = placementDragShared.absoluteY.value - containerPageY.value;
    const previewSize = placementDragShared.size.value || STANDARD_NODE_SIZE;
    const isInside =
      localX >= 0 &&
      localX <= containerWidth.value &&
      localY >= 0 &&
      localY <= containerHeight.value;

    return {
      opacity: placementDragShared.isActive.value && isInside ? 1 : 0,
      transform: [
        { translateX: localX - previewSize / 2 },
        { translateY: localY - previewSize / 2 },
        { scale: scale.value * (previewSize / STANDARD_NODE_SIZE) },
      ],
    };
  });

  const movingNodePreviewStyle = useAnimatedStyle(() => {
    const previewSize = movingNodeSize.value * scale.value;

    return {
      height: previewSize,
      opacity: movingNodeId.value ? 1 : 0,
      transform: [
        { translateX: translateX.value + movingNodeX.value * scale.value },
        { translateY: translateY.value + movingNodeY.value * scale.value },
      ],
      width: previewSize,
    };
  });

  const updateContainerMetrics = useCallback(() => {
    containerRef.current?.measureInWindow((pageX, pageY, width, height) => {
      containerPageX.value = pageX;
      containerPageY.value = pageY;
      containerWidth.value = width;
      containerHeight.value = height;
    });
  }, [containerHeight, containerPageX, containerPageY, containerWidth]);

  return (
    <GestureDetector gesture={composed}>
      <View ref={containerRef} style={styles.container} collapsable={false} onLayout={updateContainerMetrics}>
        <Animated.View style={[styles.canvasTransform, canvasAnimatedStyle]}>
          <Canvas key={nodeLayoutKey} style={styles.canvas}>
            <Fill color="#0D1117" />
            <GridDots />

            {edgeList.map((edge) => {
              const srcBounds = nodeBoundsById.get(edge.sourceNodeId);
              const tgtBounds = nodeBoundsById.get(edge.targetNodeId);
              const src = edge.sourcePortId ? srcBounds?.ports.find((port) => port.id === edge.sourcePortId) : undefined;
              const tgt = edge.targetPortId ? tgtBounds?.ports.find((port) => port.id === edge.targetPortId) : undefined;
              const sourcePoint = src ?? (srcBounds ? { x: srcBounds.cx, y: srcBounds.cy } : undefined);
              const targetPoint = tgt ?? (tgtBounds ? { x: tgtBounds.cx, y: tgtBounds.cy } : undefined);
              if (!sourcePoint || !targetPoint) return null;
              if (edge.connectionType === 'RESOURCE') {
                return (
                  <ResourceConnection
                    key={edge.id}
                    edge={edge}
                    sourcePoint={sourcePoint}
                    targetPoint={targetPoint}
                  />
                );
              }
              return (
                <Line
                  key={edge.id}
                  p1={sourcePoint}
                  p2={targetPoint}
                  color="rgba(255, 215, 0, 0.75)"
                  strokeWidth={2.5}
                />
              );
            })}

            {draftConnectionSourceId && (
              <Line
                p1={draftConnectionStart}
                p2={draftConnectionEnd}
                color="rgba(255, 255, 255, 0.8)"
                strokeWidth={3}
              />
            )}

            {nodeList.map((node) => {
              const { x, y } = getNodeOrigin(node);
              const size = getFactoryNodeFootprintSize(node);
              const borderColor = getNodeBorderColor(node.operationalStatus);
              const isStalled = node.operationalStatus === 'STALLED';
              const isMoving = node.id === movingNodeVisualId;
              const isSelected = node.id === selectedNodeId;
              const isConnectSource = node.id === connectingFromId;
              const shouldShowPorts = visiblePortNodeIds.has(node.id);
              const ports = nodeBoundsById.get(node.id)?.ports ?? [];
              const isCompact = size < 32;

              return (
                <Group key={`${node.id}:${x}:${y}`} opacity={isMoving ? 0 : isStalled ? stalledPulse : 1}>
                  {(isSelected || isConnectSource) && (
                    <RoundedRect
                      x={x - 4}
                      y={y - 4}
                      width={size + 8}
                      height={size + 8}
                      r={isCompact ? 5 : 11}
                      color={isConnectSource ? '#FFD700' : 'rgba(255,255,255,0.3)'}
                      style="stroke"
                      strokeWidth={3}
                    />
                  )}
                  <RoundedRect
                    x={x}
                    y={y}
                    width={size}
                    height={size}
                    r={isCompact ? 4 : 8}
                    color="rgba(13, 17, 23, 0.9)"
                  />
                  <RoundedRect
                    x={x}
                    y={y}
                    width={size}
                    height={size}
                    r={isCompact ? 4 : 8}
                    color={borderColor}
                    style="stroke"
                    strokeWidth={isCompact ? 1.5 : 2}
                  />
                  <PlacedStructureIcon type={node.type} x={x} y={y} size={size} />
                  {shouldShowPorts && ports.map((port) => (
                    <Circle
                      key={port.id}
                      cx={port.x}
                      cy={port.y}
                      r={isCompact ? 3 : PORT_RADIUS}
                      color="#FFFFFF"
                      style="stroke"
                      strokeWidth={2}
                    />
                  ))}
                </Group>
              );
            })}
          </Canvas>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.movingNodePreview, movingNodePreviewStyle]}>
          <View style={styles.movingNodePreviewInner} />
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.placementPreview, placementPreviewStyle]}>
          <View style={styles.placementPreviewInner} />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  canvasTransform: {
    height: CANVAS_HEIGHT,
    position: 'absolute',
    transformOrigin: '0px 0px',
    width: CANVAS_WIDTH,
  },
  canvas: {
    backgroundColor: '#0D1117',
    height: CANVAS_HEIGHT,
    width: CANVAS_WIDTH,
  },
  placementPreview: {
    height: STANDARD_NODE_SIZE,
    left: 0,
    position: 'absolute',
    top: 0,
    width: STANDARD_NODE_SIZE,
  },
  movingNodePreview: {
    height: STANDARD_NODE_SIZE,
    left: 0,
    position: 'absolute',
    top: 0,
    width: STANDARD_NODE_SIZE,
  },
  movingNodePreviewInner: {
    backgroundColor: 'rgba(13, 17, 23, 0.9)',
    borderColor: '#00BCD4',
    borderRadius: 8,
    borderWidth: 2,
    height: '100%',
    width: '100%',
  },
  placementPreviewInner: {
    backgroundColor: 'rgba(0, 188, 212, 0.18)',
    borderColor: '#00BCD4',
    borderRadius: 8,
    borderWidth: 2,
    height: STANDARD_NODE_SIZE,
    width: STANDARD_NODE_SIZE,
  },
});
