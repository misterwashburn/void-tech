import React from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useFactoryStore } from '../src/store/useFactoryStore';
import { useUIStore } from '../src/store/useUIStore';
import { useGameLoop } from '../src/hooks/useGameLoop';
import GridCanvas from '../src/components/GridCanvas';
import ControlStrip from '../src/components/ControlStrip';
import DockLedger from '../src/components/DockLedger';
import { ConnectionPortId, FactoryNode, NodeType, PowerTier, Recipe } from '../src/types';
import { MATERIALS } from '../src/data/materials';
import { RECIPES, RECIPE_IDS_BY_NODE_TYPE } from '../src/data/recipes';
import { getDefaultPowerRequirement, getPowerTierDefinition } from '../src/data/power';

export default function GameScreen() {
  useGameLoop();

  const addNode = useFactoryStore((s) => s.addNode);
  const connectNodes = useFactoryStore((s) => s.connectNodes);
  const connectPower = useFactoryStore((s) => s.connectPower);
  const getUnlockedMaterialIds = useFactoryStore((s) => s.getUnlockedMaterialIds);
  const getUnlockedRecipeIds = useFactoryStore((s) => s.getUnlockedRecipeIds);
  const getUnlockedPowerTiers = useFactoryStore((s) => s.getUnlockedPowerTiers);

  const setPlacementNodeType = useUIStore((s) => s.setPlacementNodeType);
  const selectedNodeId = useUIStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useUIStore((s) => s.setSelectedNodeId);
  const connectingFromId = useUIStore((s) => s.connectingFromId);
  const setConnectingFromId = useUIStore((s) => s.setConnectingFromId);
  const setActiveTab = useUIStore((s) => s.setActiveTab);
  const isDockRaised = useUIStore((s) => s.isDockRaised);

  function buildNode(
    nodeType: NodeType,
    worldX: number,
    worldY: number,
    recipeId?: string,
    powerTier?: PowerTier
  ): FactoryNode {
    const recipe = recipeId ? RECIPES[recipeId] : undefined;
    const selectedPowerTier = nodeType === 'POWER_GENERATOR' ? powerTier ?? 0 : undefined;
    const powerDefinition = selectedPowerTier !== undefined ? getPowerTierDefinition(selectedPowerTier) : undefined;
    const recipeOutput = recipe?.outputs[0]?.materialId;
    const recipeOutputName = recipeOutput ? MATERIALS[recipeOutput]?.name : undefined;

    return {
      id: `node_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      name: powerDefinition?.name ?? (recipeOutputName ? `${nodeType}: ${recipeOutputName}` : nodeType),
      type: nodeType,
      gridX: Math.floor(worldX / 80),
      gridY: Math.floor(worldY / 80),
      x: worldX,
      y: worldY,
      inputBuffers: {},
      outputBuffers: {},
      productionRecipe: recipe,
      powerRequirement: getDefaultPowerRequirement(nodeType, recipe),
      powerOutput: powerDefinition?.powerOutput ?? 0,
      powerTier: selectedPowerTier,
      efficiencyRating: 1.0,
      isOperational: true,
      cosmeticSkinId: null,
      stallTicksAccumulated: 0,
      operationalStatus: 'OPERATIONAL',
    };
  }

  function placeNode(nodeType: NodeType, worldX: number, worldY: number, recipeId?: string, powerTier?: PowerTier) {
    addNode(buildNode(nodeType, worldX, worldY, recipeId, powerTier));
    setPlacementNodeType(null);
  }

  function getUnlockedRecipeOptions(nodeType: NodeType): Array<{ id: string; recipe: Recipe }> {
    const recipeIdsForNode = RECIPE_IDS_BY_NODE_TYPE[nodeType as NonNullable<Recipe['nodeType']>] ?? [];
    const unlockedRecipeIds = getUnlockedRecipeIds();

    return recipeIdsForNode
      .filter((recipeId) => unlockedRecipeIds.includes(recipeId))
      .map((recipeId) => ({ id: recipeId, recipe: RECIPES[recipeId] }));
  }

  function handlePlaceNode(nodeType: NodeType, worldX: number, worldY: number) {
    if (nodeType === 'POWER_GENERATOR') {
      const powerTierOptions = getUnlockedPowerTiers();
      if (powerTierOptions.length === 1) {
        placeNode(nodeType, worldX, worldY, undefined, powerTierOptions[0]);
        return;
      }

      Alert.alert(
        'Select Generator Tier',
        'Choose the generator to place:',
        [
          ...powerTierOptions.map((tier) => {
            const definition = getPowerTierDefinition(tier);
            return {
              text: `T${tier} ${definition.name}`,
              onPress: () => placeNode(nodeType, worldX, worldY, undefined, tier),
            };
          }),
          { text: 'Cancel', style: 'cancel' as const },
        ]
      );
      return;
    }

    const recipeOptions = getUnlockedRecipeOptions(nodeType);
    if (recipeOptions.length === 0) {
      placeNode(nodeType, worldX, worldY);
      return;
    }

    if (recipeOptions.length === 1) {
      placeNode(nodeType, worldX, worldY, recipeOptions[0].id);
      return;
    }

    Alert.alert(
      'Select Recipe',
      `Choose what this ${nodeType.toLowerCase()} will produce:`,
      [
        ...recipeOptions.map(({ id, recipe }) => {
          const outputMaterialId = recipe.outputs[0]?.materialId;
          const outputName = outputMaterialId ? MATERIALS[outputMaterialId]?.name : id;
          return {
            text: outputName ?? id,
            onPress: () => placeNode(nodeType, worldX, worldY, id),
          };
        }),
        { text: 'Cancel', style: 'cancel' as const },
      ]
    );
  }

  function promptConnection(
    sourceNodeId: string,
    targetNodeId: string,
    sourcePortId?: ConnectionPortId,
    targetPortId?: ConnectionPortId
  ) {
    const sourceNode = useFactoryStore.getState().nodes[sourceNodeId];
    const targetNode = useFactoryStore.getState().nodes[targetNodeId];

    if (!sourceNode || !targetNode || sourceNodeId === targetNodeId) {
      return;
    }

    const buttons = [];

    if (sourceNode.type === 'POWER_GENERATOR' && targetNode.type !== 'POWER_GENERATOR') {
      const tierDefinition = sourceNode.powerTier ? getPowerTierDefinition(sourceNode.powerTier) : undefined;
      buttons.push({
        text: 'Power',
        onPress: () => {
          const result = connectPower(sourceNodeId, targetNodeId, tierDefinition?.maxTransferRate ?? sourceNode.powerOutput, sourcePortId, targetPortId);
          if (!result.success) {
            Alert.alert('Connection Failed', result.error ?? 'Unable to connect nodes.');
          }
          setConnectingFromId(null);
          setSelectedNodeId(null);
        },
      });
    }

    buttons.push({
      text: 'Transport',
      onPress: () => {
        const materialButtons = getUnlockedMaterialIds().map((materialId) => ({
          text: MATERIALS[materialId]?.name ?? materialId.replace(/_/g, ' '),
          onPress: () => {
            const result = connectNodes(sourceNodeId, targetNodeId, materialId, 10, sourcePortId, targetPortId);
            if (!result.success) {
              Alert.alert('Connection Failed', result.error ?? 'Unable to connect nodes.');
            }
            setConnectingFromId(null);
            setSelectedNodeId(null);
          },
        }));

        Alert.alert(
          'Select Transport Material',
          'Choose what this conveyance line should carry:',
          [
            ...materialButtons,
            { text: 'Cancel', style: 'cancel' as const, onPress: () => setConnectingFromId(null) },
          ]
        );
      },
    });

    Alert.alert(
      'Select Connection Type',
      'Choose what type of connection to draw. Fluid unlocks later and is hidden until available.',
      [
        ...buttons,
        {
          text: 'Cancel',
          style: 'cancel' as const,
          onPress: () => setConnectingFromId(null),
        },
      ]
    );
  }

  function handleTapNode(nodeId: string) {
    if (connectingFromId && nodeId !== connectingFromId) {
      promptConnection(connectingFromId, nodeId);
      return;
    }

    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    } else {
      setSelectedNodeId(nodeId);
      setActiveTab('LEDGER');
    }
  }

  function handleDrawConnection(
    sourceNodeId: string,
    targetNodeId: string,
    sourcePortId?: ConnectionPortId,
    targetPortId?: ConnectionPortId
  ) {
    promptConnection(sourceNodeId, targetNodeId, sourcePortId, targetPortId);
  }

  return (
    <View style={styles.container}>
      <View style={styles.controlStrip}>
        <ControlStrip />
      </View>
      <View style={[styles.canvas, isDockRaised && styles.canvasDockRaised]}>
        <GridCanvas onPlaceNode={handlePlaceNode} onTapNode={handleTapNode} onDrawConnection={handleDrawConnection} />
      </View>
      <View style={[styles.dock, isDockRaised && styles.dockRaised]}>
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
  canvasDockRaised: {
    flex: 52,
  },
  dock: {
    flex: 20,
  },
  dockRaised: {
    flex: 33,
  },
});
