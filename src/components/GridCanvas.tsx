import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  Line,
  matchFont,
  RoundedRect,
  Text,
} from '@shopify/react-native-skia';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { useFactoryStore } from '../store/useFactoryStore';
import { useUIStore } from '../store/useUIStore';
import { ConnectionPortId, FactoryNode, NodeType } from '../types';

const labelFont = matchFont({
  fontFamily: Platform.select({ ios: 'Helvetica Neue', default: 'sans-serif' }),
  fontSize: 13,
  fontWeight: '700',
});

interface GridCanvasProps {
  onPlaceNode: (nodeType: NodeType, worldX: number, worldY: number) => void;
  onTapNode: (nodeId: string) => void;
  onDrawConnection: (
    sourceNodeId: string,
    targetNodeId: string,
    sourcePortId?: ConnectionPortId,
    targetPortId?: ConnectionPortId
  ) => void;
}

const GRID_CELL_SIZE = 80;
const NODE_SIZE = 64;
const LEGACY_NODE_OFFSET = (GRID_CELL_SIZE - NODE_SIZE) / 2;
const DOT_SPACING = 40;
const DOT_RADIUS = 1.5;
const DOT_COLOR = 'rgba(0, 188, 212, 0.25)';

const CANVAS_WIDTH = 2000;
const CANVAS_HEIGHT = 2000;
const NODE_DRAW_HIT_PADDING = 10;
const PORT_RADIUS = 5;
const PORT_HIT_RADIUS = 16;

const MIN_SCALE = 0.3;
const MAX_SCALE = 3.0;

type OperationalStatus = FactoryNode['operationalStatus'];
type NodeBounds = {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
  cx: number;
  cy: number;
  ports: ConnectionPort[];
};
type ConnectionPort = {
  id: ConnectionPortId;
  nodeId: string;
  x: number;
  y: number;
};

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

function getNodeCode(type: FactoryNode['type']): string {
  switch (type) {
    case 'POWER_GENERATOR':
      return 'PWR';
    case 'HARVESTER':
      return 'HAR';
    case 'REFINER':
      return 'REF';
    case 'ASSEMBLER':
      return 'ASM';
    case 'STORAGE':
      return 'STO';
    case 'SINK':
      return 'SNK';
    case 'FEEDBACK_REGULATOR':
      return 'FBK';
    default:
      return '???';
  }
}

function getNodeOrigin(node: FactoryNode): { x: number; y: number } {
  return {
    x: node.x ?? node.gridX * GRID_CELL_SIZE + LEGACY_NODE_OFFSET,
    y: node.y ?? node.gridY * GRID_CELL_SIZE + LEGACY_NODE_OFFSET,
  };
}

function getConnectionPorts(nodeId: string, x: number, y: number): ConnectionPort[] {
  const left = x;
  const top = y;
  const right = x + NODE_SIZE;
  const bottom = y + NODE_SIZE;
  const midX = x + NODE_SIZE / 2;
  const midY = y + NODE_SIZE / 2;

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
  return bounds.find(
    (node) =>
      worldX >= node.left &&
      worldX <= node.right &&
      worldY >= node.top &&
      worldY <= node.bottom
  );
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

export default function GridCanvas({ onPlaceNode, onTapNode, onDrawConnection }: GridCanvasProps) {
  const { getNodesMap, getEdgesMap } = useFactoryStore();
  const nodes = getNodesMap();
  const edges = getEdgesMap();
  const selectedNodeId = useUIStore((s) => s.selectedNodeId);
  const connectingFromId = useUIStore((s) => s.connectingFromId);
  const placementDrop = useUIStore((s) => s.placementDrop);
  const clearPlacementDrop = useUIStore((s) => s.clearPlacementDrop);

  const containerRef = useRef<View>(null);
  const transformSnapshot = useRef({ translateX: 0, translateY: 0, scale: 1 });

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1.0);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const isDrawingConnection = useSharedValue(false);
  const connectionSourceId = useSharedValue('');
  const connectionSourcePortId = useSharedValue<ConnectionPortId | ''>('');
  const connectionStartX = useSharedValue(0);
  const connectionStartY = useSharedValue(0);

  const [stalledPulse, setStalledPulse] = useState(1.0);
  const [draftConnection, setDraftConnection] = useState<{
    sourceNodeId: string;
    sourcePortId: ConnectionPortId;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);

  useEffect(() => {
    let dimmed = false;
    const intervalId = setInterval(() => {
      dimmed = !dimmed;
      setStalledPulse(dimmed ? 0.35 : 1.0);
    }, 700);

    return () => clearInterval(intervalId);
  }, []);

  const nodeList = Array.from(nodes.values());
  const edgeList = Array.from(edges.values());

  const drawableNodeBounds = useMemo(() => nodeList.map((node) => {
    const { x, y } = getNodeOrigin(node);
    return {
      id: node.id,
      left: x - NODE_DRAW_HIT_PADDING,
      top: y - NODE_DRAW_HIT_PADDING,
      right: x + NODE_SIZE + NODE_DRAW_HIT_PADDING,
      bottom: y + NODE_SIZE + NODE_DRAW_HIT_PADDING,
      cx: x + NODE_SIZE / 2,
      cy: y + NODE_SIZE / 2,
      ports: getConnectionPorts(node.id, x, y),
    };
  }), [nodeList]);

  const nodeBoundsById = useMemo(() => {
    const map = new Map<string, NodeBounds>();
    for (const bounds of drawableNodeBounds) {
      map.set(bounds.id, bounds);
    }
    return map;
  }, [drawableNodeBounds]);

  const visiblePortNodeIds = useMemo(() => new Set([selectedNodeId, connectingFromId, draftConnection?.sourceNodeId].filter(Boolean) as string[]), [connectingFromId, draftConnection?.sourceNodeId, selectedNodeId]);

  const mirrorTransform = useCallback((next: { translateX: number; translateY: number; scale: number }) => {
    transformSnapshot.current = next;
  }, []);

  const updateDraftConnection = useCallback((draft: typeof draftConnection) => {
    setDraftConnection(draft);
  }, []);

  const finishDraftConnection = useCallback(
    (sourceNodeId: string, sourcePortId: ConnectionPortId, worldX: number, worldY: number) => {
      setDraftConnection(null);
      const targetPort = findHitPort(drawableNodeBounds, worldX, worldY, sourceNodeId);

      if (targetPort) {
        onDrawConnection(sourceNodeId, targetPort.nodeId, sourcePortId, targetPort.id);
      }
    },
    [drawableNodeBounds, onDrawConnection]
  );

  useEffect(() => {
    if (!placementDrop) {
      return;
    }

    containerRef.current?.measureInWindow((pageX, pageY, width, height) => {
      const isInside =
        placementDrop.absoluteX >= pageX &&
        placementDrop.absoluteX <= pageX + width &&
        placementDrop.absoluteY >= pageY &&
        placementDrop.absoluteY <= pageY + height;

      if (isInside) {
        const transform = transformSnapshot.current;
        const worldX = (placementDrop.absoluteX - pageX - transform.translateX) / transform.scale - NODE_SIZE / 2;
        const worldY = (placementDrop.absoluteY - pageY - transform.translateY) / transform.scale - NODE_SIZE / 2;
        onPlaceNode(
          placementDrop.nodeType,
          Math.max(0, Math.min(CANVAS_WIDTH - NODE_SIZE, worldX)),
          Math.max(0, Math.min(CANVAS_HEIGHT - NODE_SIZE, worldY))
        );
      }

      clearPlacementDrop();
    });
  }, [clearPlacementDrop, onPlaceNode, placementDrop]);

  const panGesture = Gesture.Pan()
    .onBegin((e) => {
      const worldX = (e.x - translateX.value) / scale.value;
      const worldY = (e.y - translateY.value) / scale.value;
      const sourcePort = findHitPort(drawableNodeBounds, worldX, worldY);

      if (sourcePort) {
        isDrawingConnection.value = true;
        connectionSourceId.value = sourcePort.nodeId;
        connectionSourcePortId.value = sourcePort.id;
        connectionStartX.value = sourcePort.x;
        connectionStartY.value = sourcePort.y;
        runOnJS(updateDraftConnection)({
          sourceNodeId: sourcePort.nodeId,
          sourcePortId: sourcePort.id,
          startX: sourcePort.x,
          startY: sourcePort.y,
          endX: worldX,
          endY: worldY,
        });
        return;
      }

      isDrawingConnection.value = false;
      connectionSourceId.value = '';
      connectionSourcePortId.value = '';
      panStartX.value = translateX.value;
      panStartY.value = translateY.value;
    })
    .onUpdate((e) => {
      if (isDrawingConnection.value) {
        const worldX = (e.x - translateX.value) / scale.value;
        const worldY = (e.y - translateY.value) / scale.value;
        runOnJS(updateDraftConnection)({
          sourceNodeId: connectionSourceId.value,
          sourcePortId: connectionSourcePortId.value as ConnectionPortId,
          startX: connectionStartX.value,
          startY: connectionStartY.value,
          endX: worldX,
          endY: worldY,
        });
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
      }
    },
    [drawableNodeBounds, onTapNode]
  );

  const tapGesture = Gesture.Tap()
    .onEnd((e) => {
      const worldX = (e.x - translateX.value) / scale.value;
      const worldY = (e.y - translateY.value) / scale.value;

      runOnJS(handleCanvasTap)(worldX, worldY);
    });

  const composed = Gesture.Simultaneous(panGesture, pinchGesture, tapGesture);

  const canvasAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const dotPositions = useMemo(() => {
    const positions: Array<{ x: number; y: number }> = [];
    for (let x = 0; x <= CANVAS_WIDTH; x += DOT_SPACING) {
      for (let y = 0; y <= CANVAS_HEIGHT; y += DOT_SPACING) {
        positions.push({ x, y });
      }
    }
    return positions;
  }, []);

  return (
    <GestureDetector gesture={composed}>
      <View ref={containerRef} style={styles.container} collapsable={false}>
        <Animated.View style={[styles.canvasTransform, canvasAnimatedStyle]}>
          <Canvas style={styles.canvas}>
            {dotPositions.map((dot, i) => (
              <Circle
                key={`dot_${i}`}
                cx={dot.x}
                cy={dot.y}
                r={DOT_RADIUS}
                color={DOT_COLOR}
              />
            ))}

            {edgeList.map((edge) => {
              const srcBounds = nodeBoundsById.get(edge.sourceNodeId);
              const tgtBounds = nodeBoundsById.get(edge.targetNodeId);
              const src = edge.sourcePortId ? srcBounds?.ports.find((port) => port.id === edge.sourcePortId) : undefined;
              const tgt = edge.targetPortId ? tgtBounds?.ports.find((port) => port.id === edge.targetPortId) : undefined;
              const sourcePoint = src ?? (srcBounds ? { x: srcBounds.cx, y: srcBounds.cy } : undefined);
              const targetPoint = tgt ?? (tgtBounds ? { x: tgtBounds.cx, y: tgtBounds.cy } : undefined);
              if (!sourcePoint || !targetPoint) return null;
              return (
                <Line
                  key={edge.id}
                  p1={{ x: sourcePoint.x, y: sourcePoint.y }}
                  p2={{ x: targetPoint.x, y: targetPoint.y }}
                  color={edge.connectionType === 'POWER' ? 'rgba(255, 215, 0, 0.75)' : 'rgba(0, 188, 212, 0.6)'}
                  strokeWidth={edge.connectionType === 'POWER' ? 2.5 : 1.5}
                />
              );
            })}

            {draftConnection && (
              <Line
                p1={{ x: draftConnection.startX, y: draftConnection.startY }}
                p2={{ x: draftConnection.endX, y: draftConnection.endY }}
                color="rgba(255, 255, 255, 0.8)"
                strokeWidth={3}
              />
            )}

            {nodeList.map((node) => {
              const { x, y } = getNodeOrigin(node);
              const borderColor = getNodeBorderColor(node.operationalStatus);
              const code = getNodeCode(node.type);
              const isStalled = node.operationalStatus === 'STALLED';
              const isSelected = node.id === selectedNodeId;
              const isConnectSource = node.id === connectingFromId;
              const shouldShowPorts = visiblePortNodeIds.has(node.id);
              const ports = nodeBoundsById.get(node.id)?.ports ?? [];

              return (
                <Group key={node.id} opacity={isStalled ? stalledPulse : 1}>
                  {(isSelected || isConnectSource) && (
                    <RoundedRect
                      x={x - 4}
                      y={y - 4}
                      width={NODE_SIZE + 8}
                      height={NODE_SIZE + 8}
                      r={11}
                      color={isConnectSource ? '#FFD700' : 'rgba(255,255,255,0.3)'}
                      style="stroke"
                      strokeWidth={3}
                    />
                  )}
                  <RoundedRect
                    x={x}
                    y={y}
                    width={NODE_SIZE}
                    height={NODE_SIZE}
                    r={8}
                    color="rgba(13, 17, 23, 0.9)"
                  />
                  <RoundedRect
                    x={x}
                    y={y}
                    width={NODE_SIZE}
                    height={NODE_SIZE}
                    r={8}
                    color={borderColor}
                    style="stroke"
                    strokeWidth={2}
                  />
                  {labelFont && (
                    <Text
                      x={x + NODE_SIZE / 2 - 14}
                      y={y + NODE_SIZE / 2 + 5}
                      text={code}
                      color="white"
                      font={labelFont}
                    />
                  )}
                  {shouldShowPorts && ports.map((port) => (
                    <Circle
                      key={port.id}
                      cx={port.x}
                      cy={port.y}
                      r={PORT_RADIUS}
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
    height: CANVAS_HEIGHT,
    width: CANVAS_WIDTH,
  },
});
