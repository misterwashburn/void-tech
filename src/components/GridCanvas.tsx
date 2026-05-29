import React, { useEffect } from 'react';
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
import {
  useSharedValue,
  useDerivedValue as useReanimatedDerivedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const labelFont = matchFont({
  fontFamily: Platform.select({ ios: 'Helvetica Neue', default: 'sans-serif' }),
  fontSize: 13,
  fontWeight: '700',
});
import { useFactoryStore } from '../store/useFactoryStore';
import { useUIStore } from '../store/useUIStore';
import { FactoryNode } from '../types';

interface GridCanvasProps {
  onTapCell: (gridX: number, gridY: number) => void;
  onTapNode: (nodeId: string) => void;
}

const GRID_CELL_SIZE = 80;
const NODE_SIZE = 64;
const NODE_OFFSET = (GRID_CELL_SIZE - NODE_SIZE) / 2;
const DOT_SPACING = 40;
const DOT_RADIUS = 1.5;
const DOT_COLOR = 'rgba(0, 188, 212, 0.25)';

const CANVAS_WIDTH = 2000;
const CANVAS_HEIGHT = 2000;

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

export default function GridCanvas({ onTapCell, onTapNode }: GridCanvasProps) {
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

  // Pulsing opacity for stalled nodes
  const stalledPulse = useSharedValue(1.0);
  useEffect(() => {
    stalledPulse.value = withRepeat(withTiming(0.35, { duration: 700 }), -1, true);
  }, []);

  // Pan gesture
  const panGesture = Gesture.Pan()
    .onBegin(() => {
      panStartX.value = translateX.value;
      panStartY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = panStartX.value + e.translationX;
      translateY.value = panStartY.value + e.translationY;
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

  const tapGesture = Gesture.Tap()
    .runOnJS(true)
    .onEnd((e) => {
      const worldX = (e.x - translateX.value) / scale.value;
      const worldY = (e.y - translateY.value) / scale.value;
      const gridX = Math.floor(worldX / GRID_CELL_SIZE);
      const gridY = Math.floor(worldY / GRID_CELL_SIZE);

      const tappedNode = Array.from(nodes.values()).find(
        (n) => n.gridX === gridX && n.gridY === gridY
      );

      if (tappedNode) {
        onTapNode(tappedNode.id);
      } else {
        onTapCell(gridX, gridY);
      }
    });

  const composed = Gesture.Simultaneous(panGesture, pinchGesture, tapGesture);

  // Derived transform for Skia Group
  const transform = useReanimatedDerivedValue(() => [
    { translateX: translateX.value },
    { translateY: translateY.value },
    { scale: scale.value },
  ]);

  const nodeList = Array.from(nodes.values());
  const edgeList = Array.from(edges.values());

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
  const dotPositions: Array<{ x: number; y: number }> = [];
  for (let x = 0; x <= CANVAS_WIDTH; x += DOT_SPACING) {
    for (let y = 0; y <= CANVAS_HEIGHT; y += DOT_SPACING) {
      dotPositions.push({ x, y });
    }
  }

  return (
    <GestureDetector gesture={composed}>
      <View style={styles.container}>
        <Canvas style={styles.canvas}>
          <Group transform={transform}>
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
                  color="rgba(0, 188, 212, 0.6)"
                  strokeWidth={1.5}
                />
              );
            })}

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
          </Group>
        </Canvas>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  canvas: {
    flex: 1,
  },
});
