import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { FactoryNode } from '../types';

const labelFont = matchFont({
  fontFamily: Platform.select({ ios: 'Helvetica Neue', default: 'sans-serif' }),
  fontSize: 13,
  fontWeight: '700',
});

interface GridCanvasProps {
  onTapCell: (gridX: number, gridY: number) => void;
  onTapNode: (nodeId: string) => void;
  onDrawConnection: (sourceNodeId: string, targetNodeId: string) => void;
}

const GRID_CELL_SIZE = 80;
const NODE_SIZE = 64;
const NODE_OFFSET = (GRID_CELL_SIZE - NODE_SIZE) / 2;
const DOT_SPACING = 40;
const DOT_RADIUS = 1.5;
const DOT_COLOR = 'rgba(0, 188, 212, 0.25)';

const CANVAS_WIDTH = 2000;
const CANVAS_HEIGHT = 2000;
const NODE_DRAW_HIT_PADDING = 10;

const MIN_SCALE = 0.3;
const MAX_SCALE = 3.0;

type OperationalStatus = FactoryNode['operationalStatus'];

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

export default function GridCanvas({ onTapCell, onTapNode, onDrawConnection }: GridCanvasProps) {
  const { getNodesMap, getEdgesMap } = useFactoryStore();
  const nodes = getNodesMap();
  const edges = getEdgesMap();
  const selectedNodeId = useUIStore((s) => s.selectedNodeId);
  const connectingFromId = useUIStore((s) => s.connectingFromId);

  // Pan and zoom shared values
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1.0);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const isDrawingConnection = useSharedValue(false);
  const connectionSourceId = useSharedValue('');
  const connectionStartX = useSharedValue(0);
  const connectionStartY = useSharedValue(0);

  // Keep Skia props on the JS side only; driving Skia props with Reanimated
  // shared values can cause Reanimated to try to execute non-worklet Skia helpers
  // on the UI thread in this Expo/Reanimated/Skia version combination.
  const [stalledPulse, setStalledPulse] = useState(1.0);
  const [draftConnection, setDraftConnection] = useState<{
    sourceNodeId: string;
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

  const drawableNodeBounds = useMemo(() => nodeList.map((node) => ({
    id: node.id,
    left: node.gridX * GRID_CELL_SIZE + NODE_OFFSET - NODE_DRAW_HIT_PADDING,
    top: node.gridY * GRID_CELL_SIZE + NODE_OFFSET - NODE_DRAW_HIT_PADDING,
    right: node.gridX * GRID_CELL_SIZE + NODE_OFFSET + NODE_SIZE + NODE_DRAW_HIT_PADDING,
    bottom: node.gridY * GRID_CELL_SIZE + NODE_OFFSET + NODE_SIZE + NODE_DRAW_HIT_PADDING,
    cx: node.gridX * GRID_CELL_SIZE + NODE_OFFSET + NODE_SIZE / 2,
    cy: node.gridY * GRID_CELL_SIZE + NODE_OFFSET + NODE_SIZE / 2,
  })), [nodeList]);


  const updateDraftConnection = useCallback((draft: typeof draftConnection) => {
    setDraftConnection(draft);
  }, []);

  const finishDraftConnection = useCallback(
    (sourceNodeId: string, worldX: number, worldY: number) => {
      setDraftConnection(null);
      const targetNode = drawableNodeBounds.find(
        (node) =>
          node.id !== sourceNodeId &&
          worldX >= node.left &&
          worldX <= node.right &&
          worldY >= node.top &&
          worldY <= node.bottom
      );

      if (targetNode) {
        onDrawConnection(sourceNodeId, targetNode.id);
      }
    },
    [drawableNodeBounds, onDrawConnection]
  );

  // Pan gesture
  const panGesture = Gesture.Pan()
    .onBegin((e) => {
      const worldX = (e.x - translateX.value) / scale.value;
      const worldY = (e.y - translateY.value) / scale.value;
      const sourceNode = drawableNodeBounds.find(
        (node) =>
          worldX >= node.left &&
          worldX <= node.right &&
          worldY >= node.top &&
          worldY <= node.bottom
      );

      if (sourceNode) {
        isDrawingConnection.value = true;
        connectionSourceId.value = sourceNode.id;
        connectionStartX.value = sourceNode.cx;
        connectionStartY.value = sourceNode.cy;
        runOnJS(updateDraftConnection)({
          sourceNodeId: sourceNode.id,
          startX: sourceNode.cx,
          startY: sourceNode.cy,
          endX: worldX,
          endY: worldY,
        });
        return;
      }

      isDrawingConnection.value = false;
      connectionSourceId.value = '';
      panStartX.value = translateX.value;
      panStartY.value = translateY.value;
    })
    .onUpdate((e) => {
      if (isDrawingConnection.value) {
        const worldX = (e.x - translateX.value) / scale.value;
        const worldY = (e.y - translateY.value) / scale.value;
        runOnJS(updateDraftConnection)({
          sourceNodeId: connectionSourceId.value,
          startX: connectionStartX.value,
          startY: connectionStartY.value,
          endX: worldX,
          endY: worldY,
        });
        return;
      }

      translateX.value = panStartX.value + e.translationX;
      translateY.value = panStartY.value + e.translationY;
    })
    .onFinalize((e) => {
      if (!isDrawingConnection.value) {
        return;
      }

      const worldX = (e.x - translateX.value) / scale.value;
      const worldY = (e.y - translateY.value) / scale.value;
      runOnJS(finishDraftConnection)(connectionSourceId.value, worldX, worldY);
      isDrawingConnection.value = false;
      connectionSourceId.value = '';
    });

  // Pinch gesture
  const lastScale = useSharedValue(1.0);
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      lastScale.value = scale.value;
    })
    .onUpdate((e) => {
      const newScale = lastScale.value * e.scale;
      scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
    });

  const handleGridTap = useCallback(
    (gridX: number, gridY: number) => {
      const tappedNode = nodeList.find(
        (n) => n.gridX === gridX && n.gridY === gridY
      );

      if (tappedNode) {
        onTapNode(tappedNode.id);
      } else {
        onTapCell(gridX, gridY);
      }
    },
    [nodeList, onTapCell, onTapNode]
  );

  const tapGesture = Gesture.Tap()
    .onEnd((e) => {
      const worldX = (e.x - translateX.value) / scale.value;
      const worldY = (e.y - translateY.value) / scale.value;
      const gridX = Math.floor(worldX / GRID_CELL_SIZE);
      const gridY = Math.floor(worldY / GRID_CELL_SIZE);

      runOnJS(handleGridTap)(gridX, gridY);
    });

  const composed = Gesture.Simultaneous(panGesture, pinchGesture, tapGesture);

  const canvasAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // Precompute node center positions
  const nodeCenters = new Map<string, { cx: number; cy: number }>();
  for (const node of nodeList) {
    const x = node.gridX * GRID_CELL_SIZE + NODE_OFFSET;
    const y = node.gridY * GRID_CELL_SIZE + NODE_OFFSET;
    nodeCenters.set(node.id, {
      cx: x + NODE_SIZE / 2,
      cy: y + NODE_SIZE / 2,
    });
  }

  // Dot matrix: compute dot positions
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
      <View style={styles.container}>
        <Animated.View style={[styles.canvasTransform, canvasAnimatedStyle]}>
          <Canvas style={styles.canvas}>
            {/* Dot matrix background */}
            {dotPositions.map((dot, i) => (
              <Circle
                key={`dot_${i}`}
                cx={dot.x}
                cy={dot.y}
                r={DOT_RADIUS}
                color={DOT_COLOR}
              />
            ))}

            {/* Edges (drawn before nodes so nodes render on top) */}
            {edgeList.map((edge) => {
              const src = nodeCenters.get(edge.sourceNodeId);
              const tgt = nodeCenters.get(edge.targetNodeId);
              if (!src || !tgt) return null;
              return (
                <Line
                  key={edge.id}
                  p1={{ x: src.cx, y: src.cy }}
                  p2={{ x: tgt.cx, y: tgt.cy }}
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

            {/* Nodes */}
            {nodeList.map((node) => {
              const x = node.gridX * GRID_CELL_SIZE + NODE_OFFSET;
              const y = node.gridY * GRID_CELL_SIZE + NODE_OFFSET;
              const borderColor = getNodeBorderColor(node.operationalStatus);
              const code = getNodeCode(node.type);
              const isStalled = node.operationalStatus === 'STALLED';

              const isSelected = node.id === selectedNodeId;
              const isConnectSource = node.id === connectingFromId;

              return (
                <Group key={node.id} opacity={isStalled ? stalledPulse : 1}>
                  {/* Selection / connect-source glow */}
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
                  {/* Fill */}
                  <RoundedRect
                    x={x}
                    y={y}
                    width={NODE_SIZE}
                    height={NODE_SIZE}
                    r={8}
                    color="rgba(13, 17, 23, 0.9)"
                  />
                  {/* Border */}
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
                  {/* Label */}
                  {labelFont && (
                    <Text
                      x={x + NODE_SIZE / 2 - 14}
                      y={y + NODE_SIZE / 2 + 5}
                      text={code}
                      color="white"
                      font={labelFont}
                    />
                  )}
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
