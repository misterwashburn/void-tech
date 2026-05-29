import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Canvas,
  Circle,
  Group,
  Line,
  RoundedRect,
  Text,
  useFont,
  useDerivedValue,
  useValue,
} from '@shopify/react-native-skia';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import {
  useSharedValue,
  useDerivedValue as useReanimatedDerivedValue,
} from 'react-native-reanimated';
import { useFactoryStore } from '../store/useFactoryStore';
import { FactoryNode } from '../types';

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

export default function GridCanvas() {
  const { getNodesMap, getEdgesMap } = useFactoryStore();
  const nodes = getNodesMap();
  const edges = getEdgesMap();

  // Pan and zoom shared values
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1.0);

  // For pulsing stalled nodes
  const time = useValue(0);

  // Pan gesture
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value += e.changeX;
      translateY.value += e.changeY;
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

  const composed = Gesture.Simultaneous(panGesture, pinchGesture);

  // Derived transform for Skia Group
  const transform = useReanimatedDerivedValue(() => [
    { translateX: translateX.value },
    { translateY: translateY.value },
    { scale: scale.value },
  ]);

  // Pulsing opacity for stalled nodes (0.4 to 1.0)
  const stalledOpacity = useDerivedValue(() => {
    return 0.7 + 0.3 * Math.sin(time.current * 4);
  }, [time]);

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

              return (
                <Group key={node.id} opacity={isStalled ? stalledOpacity : 1}>
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
                  <Text
                    x={x + NODE_SIZE / 2 - 14}
                    y={y + NODE_SIZE / 2 + 5}
                    text={code}
                    color="white"
                    font={null}
                  />
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
