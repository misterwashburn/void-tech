import { create } from 'zustand';
import { createJSONStorage, persist, StateStorage } from 'zustand/middleware';
import { ConnectionPortId, FactoryEdge, FactoryNode, HarvesterTier, NodeType, PowerTier, Recipe, ResourceEdge, TickResult } from '../types';
import { wouldCreateCycle } from '../engine/graphUtils';
import { getCurrentMission, getUnlockedProgression, isMissionComplete } from '../data/missions';
import { getDefaultPowerRequirement } from '../data/power';
import {
  getHarvesterOutputRate,
  getHarvesterTierDefinition,
  getUnlockedHarvesterTiers as getUnlockedHarvesterTierDefinitions,
} from '../data/harvesters';
import {
  getStorageAvailableCapacityForMaterial,
  STORAGE_ITEM_CAPACITY,
} from '../data/storage';

export interface FactoryStats {
  playSessions: number;
  totalNodesBuilt: number;
  totalConnectionsMade: number;
  totalResourceMoved: number;
  totalEnergyGenerated: number;
  totalEnergyConsumed: number;
  totalRuntimeSeconds: number;
  peakNetEnergy: number;
}

interface FactoryStoreState {
  id: string;
  isUnlocked: boolean;
  nodes: Record<string, FactoryNode>;
  edges: Record<string, FactoryEdge>;
  availableEnergy: number;
  consumedEnergy: number;
  producedTotals: Record<string, number>;
  completedMissionIds: string[];
  onboardingAcknowledged: boolean;
  stats: FactoryStats;

  addNode: (node: FactoryNode) => void;
  moveNode: (nodeId: string, x: number, y: number) => void;
  setNodeRecipe: (nodeId: string, recipe?: Recipe) => void;
  resetGame: () => void;
  deleteNode: (nodeId: string) => void;
  connectNodes: (
    sourceNodeId: string,
    targetNodeId: string,
    maxCapacityRate: number,
    sourcePortId?: ConnectionPortId,
    targetPortId?: ConnectionPortId
  ) => { success: boolean; error?: string };
  connectPower: (
    sourceNodeId: string,
    targetNodeId: string,
    maxTransferRate: number,
    sourcePortId?: ConnectionPortId,
    targetPortId?: ConnectionPortId
  ) => { success: boolean; error?: string };
  applyTickResult: (result: TickResult, tickSeconds?: number) => void;
  acknowledgeOnboarding: () => void;

  getNodesMap: () => Map<string, FactoryNode>;
  getEdgesMap: () => Map<string, FactoryEdge>;
  getUnlockedNodeTypes: () => NodeType[];
  getUnlockedMaterialIds: () => string[];
  getUnlockedRecipeIds: () => string[];
  getUnlockedPowerTiers: () => PowerTier[];
  getUnlockedHarvesterTiers: () => HarvesterTier[];
}

function recordToMap<V>(record: Record<string, V>): Map<string, V> {
  return new Map(Object.entries(record));
}

function isResourceEdge(edge: FactoryEdge): edge is ResourceEdge {
  return edge.connectionType === 'RESOURCE';
}

const GRID_CELL_SIZE = 80;
const STANDARD_NODE_SIZE = 64;
const LEGACY_NODE_OFFSET = (GRID_CELL_SIZE - STANDARD_NODE_SIZE) / 2;

function normalizeFactoryNode(node: FactoryNode): FactoryNode {
  const normalizedNode = {
    ...node,
    x: node.x ?? node.gridX * GRID_CELL_SIZE + LEGACY_NODE_OFFSET,
    y: node.y ?? node.gridY * GRID_CELL_SIZE + LEGACY_NODE_OFFSET,
  };

  if (node.type !== 'STORAGE') {
    return normalizedNode;
  }

  return {
    ...normalizedNode,
    inputBuffers: normalizedNode.inputBuffers ?? {},
    outputBuffers: {},
    productionRecipe: undefined,
    powerRequirement: getDefaultPowerRequirement('STORAGE'),
  };
}

function normalizeFactoryNodes(nodes: Record<string, FactoryNode>): Record<string, FactoryNode> {
  return Object.fromEntries(
    Object.entries(nodes).map(([nodeId, node]) => [nodeId, normalizeFactoryNode(node)])
  );
}

function getTransportMaterialId(sourceNode: FactoryNode, edges: Map<string, FactoryEdge>): string | undefined {
  const recipeOutputIds = [...new Set(sourceNode.productionRecipe?.outputs.map((output) => output.materialId) ?? [])];
  if (recipeOutputIds.length === 1) {
    return recipeOutputIds[0];
  }

  if (sourceNode.type === 'HARVESTER' && recipeOutputIds.length === 0) {
    return 'void_ore';
  }

  if (sourceNode.type === 'STORAGE' || sourceNode.type === 'MERGE_UNIT' || sourceNode.type === 'SPLIT_UNIT') {
    const transportableMaterialIds = new Set(
      Array.from(edges.values())
        .filter((edge): edge is ResourceEdge => isResourceEdge(edge) && edge.targetNodeId === sourceNode.id)
        .map((edge) => edge.materialId)
    );

    if (sourceNode.type === 'STORAGE') {
      for (const [materialId, buffer] of Object.entries(sourceNode.inputBuffers)) {
        if (buffer.current > 0) {
          transportableMaterialIds.add(materialId);
        }
      }
    }

    if (transportableMaterialIds.size === 1) {
      return Array.from(transportableMaterialIds)[0];
    }
  }

  return undefined;
}

const initialStats: FactoryStats = {
  playSessions: 1,
  totalNodesBuilt: 0,
  totalConnectionsMade: 0,
  totalResourceMoved: 0,
  totalEnergyGenerated: 0,
  totalEnergyConsumed: 0,
  totalRuntimeSeconds: 0,
  peakNetEnergy: 0,
};

const initialFactoryState = {
  id: 'sector_alpha',
  isUnlocked: true,
  nodes: {},
  edges: {},
  availableEnergy: 0,
  consumedEnergy: 0,
  producedTotals: {},
  completedMissionIds: [],
  onboardingAcknowledged: false,
  stats: initialStats,
};

const testStorage = (() => {
  const values = new Map<string, string>();

  return {
    getItem: (name: string) => values.get(name) ?? null,
    setItem: (name: string, value: string) => {
      values.set(name, value);
    },
    removeItem: (name: string) => {
      values.delete(name);
    },
  };
})();

function getFactoryStorage(): StateStorage {
  if (process.env.NODE_ENV === 'test') {
    return testStorage;
  }

  return require('@react-native-async-storage/async-storage').default;
}

function completeAvailableMissions(
  completedMissionIds: string[],
  producedTotals: Record<string, number>,
  nodes: Record<string, FactoryNode>,
  edges: Record<string, FactoryEdge>,
  onboardingAcknowledged: boolean
): string[] {
  let updatedMissionIds = completedMissionIds;

  while (true) {
    const currentMission = getCurrentMission(updatedMissionIds);
    if (!currentMission) {
      break;
    }

    if (!isMissionComplete(currentMission, { nodes, edges, producedTotals })) {
      break;
    }

    if (currentMission.id === 'mission_into_the_void' && !onboardingAcknowledged) {
      break;
    }

    updatedMissionIds = [...updatedMissionIds, currentMission.id];
  }

  return updatedMissionIds;
}

export const useFactoryStore = create<FactoryStoreState>()(persist((set, get) => ({
  ...initialFactoryState,

  addNode(node: FactoryNode) {
    const unlockedNodeTypes = get().getUnlockedNodeTypes();
    if (!unlockedNodeTypes.includes(node.type)) {
      return;
    }

    if (node.type === 'POWER_GENERATOR') {
      const unlockedPowerTiers = get().getUnlockedPowerTiers();
      if (node.powerTier === undefined || !unlockedPowerTiers.includes(node.powerTier)) {
        return;
      }
    }

    if (node.type === 'HARVESTER') {
      const unlockedHarvesterTiers = get().getUnlockedHarvesterTiers();
      const harvesterTier = node.harvesterTier ?? 0;
      if (!unlockedHarvesterTiers.includes(harvesterTier)) {
        return;
      }
    }

    set((state) => {
      const addedNode = normalizeFactoryNode(node);
      const nodes = { ...state.nodes, [node.id]: addedNode };

      return {
        nodes,
        completedMissionIds: completeAvailableMissions(
          state.completedMissionIds,
          state.producedTotals,
          nodes,
          state.edges,
          state.onboardingAcknowledged
        ),
        stats: {
          ...state.stats,
          totalNodesBuilt: state.stats.totalNodesBuilt + 1,
        },
      };
    });
  },

  moveNode(nodeId: string, x: number, y: number) {
    set((state) => {
      const existing = state.nodes[nodeId];
      if (!existing) {
        return state;
      }
      const nodeCountBeforeMove = Object.keys(state.nodes).length;
      const nextNodes = {
        ...state.nodes,
        [nodeId]: {
          ...existing,
          gridX: Math.floor(x / 80),
          gridY: Math.floor(y / 80),
          x,
          y,
        },
      };

      if (process.env.NODE_ENV !== 'production' && Object.keys(nextNodes).length !== nodeCountBeforeMove) {
        console.warn('[factory] moveNode changed node count', {
          nodeId,
          before: nodeCountBeforeMove,
          after: Object.keys(nextNodes).length,
        });
      }

      return {
        nodes: nextNodes,
      };
    });
  },

  setNodeRecipe(nodeId: string, recipe?: Recipe) {
    set((state) => {
      const existing = state.nodes[nodeId];
      if (!existing || existing.type === 'STORAGE') {
        return state;
      }

      const harvesterDefinition = existing.type === 'HARVESTER'
        ? getHarvesterTierDefinition(existing.harvesterTier)
        : undefined;
      const outputMaterialId = recipe?.outputs[0]?.materialId ?? (existing.type === 'HARVESTER' ? 'void_ore' : undefined);
      const edges = outputMaterialId
        ? Object.fromEntries(Object.entries(state.edges).map(([edgeId, edge]) => [
          edgeId,
          isResourceEdge(edge) && edge.sourceNodeId === nodeId
            ? { ...edge, materialId: outputMaterialId }
            : edge,
        ]))
        : state.edges;

      return {
        edges,
        nodes: {
          ...state.nodes,
          [nodeId]: {
            ...existing,
            productionRecipe: recipe,
            powerRequirement: getDefaultPowerRequirement(existing.type, recipe),
            outputBuffers: harvesterDefinition && outputMaterialId
              ? { [outputMaterialId]: { current: 0, max: harvesterDefinition.internalInventoryCapacity } }
              : existing.outputBuffers,
          },
        },
      };
    });
  },

  resetGame() {
    set({
      ...initialFactoryState,
      stats: { ...initialStats },
    });
  },

  acknowledgeOnboarding() {
    set((state) => {
      const currentMission = getCurrentMission(state.completedMissionIds);
      const canCompleteOnboarding = currentMission?.id === 'mission_into_the_void'
        && isMissionComplete(currentMission, {
          nodes: state.nodes,
          edges: state.edges,
          producedTotals: state.producedTotals,
        });

      return {
        onboardingAcknowledged: canCompleteOnboarding || state.onboardingAcknowledged,
        completedMissionIds: canCompleteOnboarding
          ? [...state.completedMissionIds, currentMission.id]
          : state.completedMissionIds,
      };
    });
  },

  deleteNode(nodeId: string) {
    set((state) => {
      const newNodes = { ...state.nodes };
      delete newNodes[nodeId];

      const newEdges: Record<string, FactoryEdge> = {};
      for (const [edgeId, edge] of Object.entries(state.edges)) {
        if (edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId) {
          newEdges[edgeId] = edge;
        }
      }

      return { nodes: newNodes, edges: newEdges };
    });
  },

  connectNodes(
    sourceNodeId: string,
    targetNodeId: string,
    maxCapacityRate: number,
    sourcePortId?: ConnectionPortId,
    targetPortId?: ConnectionPortId
  ): { success: boolean; error?: string } {
    const state = get();
    const nodesMap = recordToMap(state.nodes);
    const edgesMap = recordToMap(state.edges);

    if (!nodesMap.has(sourceNodeId)) {
      return { success: false, error: `Source node '${sourceNodeId}' does not exist` };
    }
    if (!nodesMap.has(targetNodeId)) {
      return { success: false, error: `Target node '${targetNodeId}' does not exist` };
    }
    if (nodesMap.get(sourceNodeId)?.type === 'POWER_GENERATOR') {
      return { success: false, error: 'Power generators can only supply power lines' };
    }
    const sourceNode = nodesMap.get(sourceNodeId)!;
    const materialId = getTransportMaterialId(sourceNode, edgesMap);
    if (!materialId) {
      return { success: false, error: 'Source structure does not have a single transportable output' };
    }
    if (!state.getUnlockedMaterialIds().includes(materialId)) {
      return { success: false, error: `Material '${materialId}' is locked` };
    }

    if (wouldCreateCycle(nodesMap, edgesMap, sourceNodeId, targetNodeId)) {
      return { success: false, error: 'Cannot connect nodes: would create a cycle' };
    }

    const edgeId = `edge_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const newEdge: ResourceEdge = {
      id: edgeId,
      sourceNodeId,
      targetNodeId,
      sourcePortId,
      targetPortId,
      connectionType: 'RESOURCE',
      materialId,
      maxCapacityRate,
      currentFlowRate: 0,
    };

    set((state) => ({
      edges: { ...state.edges, [edgeId]: newEdge },
      stats: {
        ...state.stats,
        totalConnectionsMade: state.stats.totalConnectionsMade + 1,
      },
    }));

    return { success: true };
  },

  connectPower(
    sourceNodeId: string,
    targetNodeId: string,
    maxTransferRate: number,
    sourcePortId?: ConnectionPortId,
    targetPortId?: ConnectionPortId
  ): { success: boolean; error?: string } {
    const state = get();
    const sourceNode = state.nodes[sourceNodeId];
    const targetNode = state.nodes[targetNodeId];

    if (!sourceNode) {
      return { success: false, error: `Source node '${sourceNodeId}' does not exist` };
    }
    if (!targetNode) {
      return { success: false, error: `Target node '${targetNodeId}' does not exist` };
    }
    if (sourceNode.type !== 'POWER_GENERATOR') {
      return { success: false, error: 'Power lines must start from a generator' };
    }
    if (targetNode.type === 'POWER_GENERATOR') {
      return { success: false, error: 'Power generators do not consume power lines' };
    }

    const edgeId = `power_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    set((state) => ({
      edges: {
        ...state.edges,
        [edgeId]: {
          id: edgeId,
          sourceNodeId,
          targetNodeId,
          sourcePortId,
          targetPortId,
          connectionType: 'POWER',
          maxTransferRate,
          currentTransferRate: 0,
        },
      },
      stats: {
        ...state.stats,
        totalConnectionsMade: state.stats.totalConnectionsMade + 1,
      },
    }));

    return { success: true };
  },

  applyTickResult(result: TickResult, tickSeconds = 1) {
    set((state) => {
      const newNodes = { ...state.nodes };
      const newEdges = { ...state.edges };
      const newProducedTotals = { ...state.producedTotals };
      const movedFromNode = new Map<string, Record<string, number>>();
      const acceptedFlowRates = new Map<string, number>();
      for (const delta of result.edgeDeltas.values()) {
        const edge = newEdges[delta.edgeId];
        if (!edge || !isResourceEdge(edge)) {
          continue;
        }
        const targetNode = newNodes[edge.targetNodeId];
        const sourceNode = newNodes[edge.sourceNodeId];
        const requestedFlowRate = Math.max(0, delta.actualFlowRate);
        const requestedAmount = requestedFlowRate * tickSeconds;
        const targetAcceptedAmount = targetNode?.type === 'STORAGE'
          ? Math.min(
            requestedAmount,
            getStorageAvailableCapacityForMaterial(targetNode, edge.materialId)
          )
          : requestedAmount;
        const acceptedAmount = sourceNode?.type === 'STORAGE'
          ? Math.min(
            targetAcceptedAmount,
            Math.max(0, sourceNode.inputBuffers[edge.materialId]?.current ?? 0)
          )
          : targetAcceptedAmount;
        const acceptedFlowRate = tickSeconds > 0 ? acceptedAmount / tickSeconds : 0;
        acceptedFlowRates.set(edge.id, acceptedFlowRate);

        if (sourceNode?.type === 'STORAGE' && acceptedAmount > 0) {
          const inputBuffer = sourceNode.inputBuffers[edge.materialId]!;
          newNodes[sourceNode.id] = {
            ...sourceNode,
            inputBuffers: {
              ...sourceNode.inputBuffers,
              [edge.materialId]: {
                ...inputBuffer,
                current: inputBuffer.current - acceptedAmount,
              },
            },
          };
        }

        if (targetNode?.type === 'STORAGE' && acceptedAmount > 0) {
          const inputBuffer = targetNode.inputBuffers[edge.materialId] ?? {
            current: 0,
            max: STORAGE_ITEM_CAPACITY,
          };
          newNodes[targetNode.id] = {
            ...targetNode,
            inputBuffers: {
              ...targetNode.inputBuffers,
              [edge.materialId]: {
                ...inputBuffer,
                current: inputBuffer.current + acceptedAmount,
                max: STORAGE_ITEM_CAPACITY,
              },
            },
          };
        }

        const movedByMaterial = movedFromNode.get(edge.sourceNodeId) ?? {};
        movedByMaterial[edge.materialId] =
          (movedByMaterial[edge.materialId] ?? 0) + acceptedAmount;
        movedFromNode.set(edge.sourceNodeId, movedByMaterial);
      }
      for (const [nodeId, productionRates] of result.productionRatesByNode) {
        if (newNodes[nodeId]?.type === 'HARVESTER') {
          continue;
        }
        for (const [materialId, productionRate] of Object.entries(productionRates)) {
          const producedAmount = Math.max(0, productionRate * tickSeconds);
          newProducedTotals[materialId] = (newProducedTotals[materialId] ?? 0) + producedAmount;
        }
      }

      for (const delta of result.nodeDeltas.values()) {
        const existing = newNodes[delta.nodeId];
        if (existing) {
          let stallTicks = existing.stallTicksAccumulated;
          let outputBuffers = existing.outputBuffers;
          const outputBufferValues = Object.values(existing.outputBuffers);
          const isOutputSaturated =
            outputBufferValues.length > 0 &&
            outputBufferValues.some((buf) => buf.current >= buf.max);

          if (isOutputSaturated) {
            stallTicks = existing.stallTicksAccumulated + 1;
          } else {
            stallTicks = 0;
          }

          if (existing.type === 'HARVESTER') {
            const outputMaterialId = existing.productionRecipe?.outputs[0]?.materialId ?? 'void_ore';
            const definition = getHarvesterTierDefinition(existing.harvesterTier);
            const currentBuffer = existing.outputBuffers[outputMaterialId] ?? {
              current: 0,
              max: definition.internalInventoryCapacity,
            };
            const requestedProduction = Math.max(
              0,
              (result.productionRatesByNode.get(existing.id)?.[outputMaterialId] ?? 0) * tickSeconds
            );
            const spaceAvailable = Math.max(0, currentBuffer.max - currentBuffer.current);
            const outgoingAmount = movedFromNode.get(existing.id)?.[outputMaterialId] ?? 0;
            const producedAmount = Math.min(requestedProduction, spaceAvailable + outgoingAmount);

            outputBuffers = {
              ...existing.outputBuffers,
              [outputMaterialId]: {
                current: Math.min(currentBuffer.max, currentBuffer.current + producedAmount),
                max: currentBuffer.max,
              },
            };

            if (producedAmount > 0) {
              newProducedTotals[outputMaterialId] =
                (newProducedTotals[outputMaterialId] ?? 0) + producedAmount;
            }
          }

          newNodes[delta.nodeId] = {
            ...existing,
            outputBuffers,
            efficiencyRating: delta.calculatedEfficiency,
            operationalStatus: delta.operationalStatus,
            stallTicksAccumulated: stallTicks,
          };
        }
      }

      for (const delta of result.edgeDeltas.values()) {
        const existing = newEdges[delta.edgeId];
        if (!existing) {
          continue;
        }

        if (isResourceEdge(existing)) {
          const sourceNode = newNodes[existing.sourceNodeId];
          const actualFlowRate = acceptedFlowRates.get(existing.id) ?? 0;
          const movedAmount = actualFlowRate * tickSeconds;

          newEdges[delta.edgeId] = {
            ...existing,
            currentFlowRate: actualFlowRate,
          };

          if (sourceNode?.type === 'HARVESTER') {
            const buffer = sourceNode.outputBuffers[existing.materialId];
            if (buffer) {
              newNodes[sourceNode.id] = {
                ...sourceNode,
                outputBuffers: {
                  ...sourceNode.outputBuffers,
                  [existing.materialId]: {
                    ...buffer,
                    current: Math.max(0, buffer.current - movedAmount),
                  },
                },
              };
            }
          }

        } else {
          newEdges[delta.edgeId] = {
            ...existing,
            currentTransferRate: delta.actualFlowRate,
          };
        }
      }

      const resourceMovedThisTick = Array.from(result.edgeDeltas.values()).reduce((total, delta) => {
        const edge = newEdges[delta.edgeId];
        return edge && isResourceEdge(edge)
          ? total + Math.max(0, (acceptedFlowRates.get(edge.id) ?? 0) * tickSeconds)
          : total;
      }, 0);
      const energyProducedThisTick = Math.max(0, result.globalEnergyBalance.production * tickSeconds);
      const energyConsumedThisTick = Math.max(0, result.globalEnergyBalance.consumption * tickSeconds);
      const netEnergy = result.globalEnergyBalance.production - result.globalEnergyBalance.consumption;

      return {
        nodes: newNodes,
        edges: newEdges,
        availableEnergy: result.globalEnergyBalance.production,
        consumedEnergy: result.globalEnergyBalance.consumption,
        producedTotals: newProducedTotals,
        completedMissionIds: completeAvailableMissions(
          state.completedMissionIds,
          newProducedTotals,
          newNodes,
          newEdges,
          state.onboardingAcknowledged
        ),
        stats: {
          ...state.stats,
          totalResourceMoved: state.stats.totalResourceMoved + resourceMovedThisTick,
          totalEnergyGenerated: state.stats.totalEnergyGenerated + energyProducedThisTick,
          totalEnergyConsumed: state.stats.totalEnergyConsumed + energyConsumedThisTick,
          totalRuntimeSeconds: state.stats.totalRuntimeSeconds + tickSeconds,
          peakNetEnergy: Math.max(state.stats.peakNetEnergy, netEnergy),
        },
      };
    });
  },

  getNodesMap(): Map<string, FactoryNode> {
    return recordToMap(get().nodes);
  },

  getEdgesMap(): Map<string, FactoryEdge> {
    return recordToMap(get().edges);
  },

  getUnlockedNodeTypes(): NodeType[] {
    return getUnlockedProgression(get().completedMissionIds).nodeTypes;
  },

  getUnlockedMaterialIds(): string[] {
    return getUnlockedProgression(get().completedMissionIds).materialIds;
  },

  getUnlockedRecipeIds(): string[] {
    return getUnlockedProgression(get().completedMissionIds).recipeIds;
  },

  getUnlockedPowerTiers(): PowerTier[] {
    return getUnlockedProgression(get().completedMissionIds).powerTiers;
  },

  getUnlockedHarvesterTiers(): HarvesterTier[] {
    return getUnlockedHarvesterTierDefinitions(get().completedMissionIds);
  },
}), {
  name: 'void-tech.factory-state',
  storage: createJSONStorage(getFactoryStorage),
  partialize: (state) => ({
    id: state.id,
    isUnlocked: state.isUnlocked,
    nodes: state.nodes,
    edges: state.edges,
    availableEnergy: state.availableEnergy,
    consumedEnergy: state.consumedEnergy,
    producedTotals: state.producedTotals,
    completedMissionIds: state.completedMissionIds,
    onboardingAcknowledged: state.onboardingAcknowledged,
    stats: state.stats,
  }),
  merge: (persistedState, currentState) => {
    const persisted = persistedState as Partial<FactoryStoreState>;
    return {
      ...currentState,
      ...persisted,
      nodes: normalizeFactoryNodes(persisted.nodes ?? {}),
    };
  },
}));
