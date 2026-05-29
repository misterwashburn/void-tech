import React from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useFactoryStore } from '../src/store/useFactoryStore';
import { useUIStore } from '../src/store/useUIStore';
import { useGameLoop } from '../src/hooks/useGameLoop';
import GridCanvas from '../src/components/GridCanvas';
import ControlStrip from '../src/components/ControlStrip';
import DockLedger from '../src/components/DockLedger';
import { FactoryNode } from '../src/types';
import { TIER_1_MATERIALS } from '../src/data/materials';

export default function GameScreen() {
  useGameLoop();

  const addNode = useFactoryStore((s) => s.addNode);
  const connectNodes = useFactoryStore((s) => s.connectNodes);
  const nodes = useFactoryStore((s) => s.nodes);

  const placementNodeType = useUIStore((s) => s.placementNodeType);
  const setPlacementNodeType = useUIStore((s) => s.setPlacementNodeType);
  const selectedNodeId = useUIStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useUIStore((s) => s.setSelectedNodeId);
  const connectingFromId = useUIStore((s) => s.connectingFromId);
  const setConnectingFromId = useUIStore((s) => s.setConnectingFromId);

  function handleTapCell(gridX: number, gridY: number) {
    if (!placementNodeType) return;

    const newNode: FactoryNode = {
      id: `node_${Date.now()}`,
      name: placementNodeType,
      type: placementNodeType,
      gridX,
      gridY,
      inputBuffers: {},
      outputBuffers: {},
      efficiencyRating: 1.0,
      isOperational: true,
      cosmeticSkinId: null,
      stallTicksAccumulated: 0,
      operationalStatus: 'OPERATIONAL',
    };

    addNode(newNode);
    setPlacementNodeType(null);
  }

  function handleTapNode(nodeId: string) {
    if (connectingFromId && nodeId !== connectingFromId) {
      // Show material picker for the pipe connection
      const materialButtons = TIER_1_MATERIALS.map((materialId) => ({
        text: materialId.replace(/_/g, ' '),
        onPress: () => {
          connectNodes(connectingFromId, nodeId, materialId, 10);
          setConnectingFromId(null);
          setSelectedNodeId(null);
        },
      }));

      Alert.alert(
        'Select Material',
        'Choose the material for this connection:',
        [
          ...materialButtons,
          {
            text: 'Cancel',
            style: 'cancel' as const,
            onPress: () => {
              setConnectingFromId(null);
            },
          },
        ]
      );
    } else {
      // Toggle selection
      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
      } else {
        setSelectedNodeId(nodeId);
      }
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.controlStrip}>
        <ControlStrip />
      </View>
      <View style={styles.canvas}>
        <GridCanvas onTapCell={handleTapCell} onTapNode={handleTapNode} />
      </View>
      <View style={styles.dock}>
        <DockLedger />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D1117',
  },
  controlStrip: {
    flex: 15,
  },
  canvas: {
    flex: 65,
  },
  dock: {
    flex: 20,
  },
});
