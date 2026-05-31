import React from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useFactoryStore } from '../src/store/useFactoryStore';
import { useUIStore } from '../src/store/useUIStore';
import { useGameLoop } from '../src/hooks/useGameLoop';
import GridCanvas from '../src/components/GridCanvas';
import ControlStrip from '../src/components/ControlStrip';
import DockLedger from '../src/components/DockLedger';
import { FactoryNode, NodeType, Recipe } from '../src/types';
import { MATERIALS } from '../src/data/materials';
import { RECIPES, RECIPE_IDS_BY_NODE_TYPE } from '../src/data/recipes';

export default function GameScreen() {
  useGameLoop();

  const addNode = useFactoryStore((s) => s.addNode);
  const connectNodes = useFactoryStore((s) => s.connectNodes);
  const getUnlockedMaterialIds = useFactoryStore((s) => s.getUnlockedMaterialIds);
  const getUnlockedRecipeIds = useFactoryStore((s) => s.getUnlockedRecipeIds);

  const placementNodeType = useUIStore((s) => s.placementNodeType);
  const setPlacementNodeType = useUIStore((s) => s.setPlacementNodeType);
  const selectedNodeId = useUIStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useUIStore((s) => s.setSelectedNodeId);
  const connectingFromId = useUIStore((s) => s.connectingFromId);
  const setConnectingFromId = useUIStore((s) => s.setConnectingFromId);

  function buildNode(
    nodeType: NodeType,
    gridX: number,
    gridY: number,
    recipeId?: string
  ): FactoryNode {
    const recipe = recipeId ? RECIPES[recipeId] : undefined;
    const recipeOutput = recipe?.outputs[0]?.materialId;
    const recipeOutputName = recipeOutput ? MATERIALS[recipeOutput]?.name : undefined;

    return {
      id: `node_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      name: recipeOutputName ? `${nodeType}: ${recipeOutputName}` : nodeType,
      type: nodeType,
      gridX,
      gridY,
      inputBuffers: {},
      outputBuffers: {},
      productionRecipe: recipe,
      efficiencyRating: 1.0,
      isOperational: true,
      cosmeticSkinId: null,
      stallTicksAccumulated: 0,
      operationalStatus: 'OPERATIONAL',
    };
  }

  function placeNode(nodeType: NodeType, gridX: number, gridY: number, recipeId?: string) {
    addNode(buildNode(nodeType, gridX, gridY, recipeId));
    setPlacementNodeType(null);
  }

  function getUnlockedRecipeOptions(nodeType: NodeType): Array<{ id: string; recipe: Recipe }> {
    const recipeIdsForNode = RECIPE_IDS_BY_NODE_TYPE[nodeType as NonNullable<Recipe['nodeType']>] ?? [];
    const unlockedRecipeIds = getUnlockedRecipeIds();

    return recipeIdsForNode
      .filter((recipeId) => unlockedRecipeIds.includes(recipeId))
      .map((recipeId) => ({ id: recipeId, recipe: RECIPES[recipeId] }));
  }

  function handleTapCell(gridX: number, gridY: number) {
    if (!placementNodeType) return;

    const recipeOptions = getUnlockedRecipeOptions(placementNodeType);
    if (recipeOptions.length === 0) {
      placeNode(placementNodeType, gridX, gridY);
      return;
    }

    if (recipeOptions.length === 1) {
      placeNode(placementNodeType, gridX, gridY, recipeOptions[0].id);
      return;
    }

    Alert.alert(
      'Select Recipe',
      `Choose what this ${placementNodeType.toLowerCase()} will produce:`,
      [
        ...recipeOptions.map(({ id, recipe }) => {
          const outputMaterialId = recipe.outputs[0]?.materialId;
          const outputName = outputMaterialId ? MATERIALS[outputMaterialId]?.name : id;
          return {
            text: outputName ?? id,
            onPress: () => placeNode(placementNodeType, gridX, gridY, id),
          };
        }),
        { text: 'Cancel', style: 'cancel' as const },
      ]
    );
  }

  function handleTapNode(nodeId: string) {
    if (connectingFromId && nodeId !== connectingFromId) {
      const materialButtons = getUnlockedMaterialIds().map((materialId) => ({
        text: MATERIALS[materialId]?.name ?? materialId.replace(/_/g, ' '),
        onPress: () => {
          const result = connectNodes(connectingFromId, nodeId, materialId, 10);
          if (!result.success) {
            Alert.alert('Connection Failed', result.error ?? 'Unable to connect nodes.');
          }
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
