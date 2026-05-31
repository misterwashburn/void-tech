import { create } from 'zustand';
import { FactoryEdge, FactoryNode, NodeType, PowerTier, ResourceEdge, TickResult } from '../types';
import { wouldCreateCycle } from '../engine/graphUtils';
import { getCurrentMission, getUnlockedProgression } from '../data/missions';

interface FactoryStoreState {
  id: string;
  isUnlocked: boolean;
  nodes: Record<string, FactoryNode>;
  edges: Record<string, FactoryEdge>;
  availableEnergy: number;
  consumedEnergy: number;
  producedTotals: Record<string, number>;
  completedMissionIds: string[];

  addNode: (node: FactoryNode) => void;
  deleteNode: (nodeId: string) => void;
  connectNodes: (
    sourceNodeId: string,
    targetNodeId: string,
    materialId: string,
    maxCapacityRate: number
  ) => { success: boolean; error?: string };
  connectPower: (
    sourceNodeId: string,
    targetNodeId: string,
    maxTransferRate: number
  ) => { success: boolean; error?: string };
  applyTickResult: (result: TickResult, tickSeconds?: number) => void;

  getNodesMap: () => Map<string, FactoryNode>;
  getEdgesMap: () => Map<string, FactoryEdge>;
  getUnlockedNodeTypes: () => NodeType[];
  getUnlockedMaterialIds: () => string[];
  getUnlockedRecipeIds: () => string[];
  getUnlockedPowerTiers: () => PowerTier[];
}

function recordToMap<V>(record: Record<string, V>): Map<string, V> {
  return new Map(Object.entries(record));
}

function isResourceEdge(edge: FactoryEdge): edge is ResourceEdge {
  return edge.connectionType === 'RESOURCE';
}

function completeAvailableMissions(
  completedMissionIds: string[],
  producedTotals: Record<string, number>
): string[] {
  let updatedMissionIds = completedMissionIds;

  while (true) {
    const currentMission = getCurrentMission(updatedMissionIds);
    if (!currentMission) {
      break;
    }

    const completedQuantity = producedTotals[currentMission.requirement.materialId] ?? 0;
    if (completedQuantity < currentMission.requirement.quantity) {
      break;
    }

    updatedMissionIds = [...updatedMissionIds, currentMission.id];
  }

  return updatedMissionIds;
}

export const useFactoryStore = create<FactoryStoreState>((set, get) => ({
  id: 'sector_alpha',
  isUnlocked: true,
  nodes: {},
  edges: {},
  availableEnergy: 0,
  consumedEnergy: 0,
  producedTotals: {},
  completedMissionIds: [],

  addNode(node: FactoryNode) {
    const unlockedNodeTypes = get().getUnlockedNodeTypes();
    if (!unlockedNodeTypes.includes(node.type)) {
      return;
    }

    if (node.type === 'POWER_GENERATOR') {
      const unlockedPowerTiers = get().getUnlockedPowerTiers();
      if (!node.powerTier || !unlockedPowerTiers.includes(node.powerTier)) {
        return;
      }
    }

    set((state) => ({
      nodes: { ...state.nodes, [node.id]: node },
    }));
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
    materialId: string,
    maxCapacityRate: number
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
      connectionType: 'RESOURCE',
      materialId,
      maxCapacityRate,
      currentFlowRate: 0,
    };

    set((s) => ({
      edges: { ...s.edges, [edgeId]: newEdge },
    }));

    return { success: true };
  },

  connectPower(
    sourceNodeId: string,
    targetNodeId: string,
    maxTransferRate: number
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
    set((s) => ({
      edges: {
        ...s.edges,
        [edgeId]: {
          id: edgeId,
          sourceNodeId,
          targetNodeId,
          connectionType: 'POWER',
          maxTransferRate,
          currentTransferRate: 0,
        },
      },
    }));

    return { success: true };
  },

  applyTickResult(result: TickResult, tickSeconds = 1) {
    set((state) => {
      const newNodes = { ...state.nodes };
      const newEdges = { ...state.edges };
      const newProducedTotals = { ...state.producedTotals };

      for (const delta of result.nodeDeltas.values()) {
        const existing = newNodes[delta.nodeId];
        if (existing) {
          let stallTicks = existing.stallTicksAccumulated;
          const outputBufferValues = Object.values(existing.outputBuffers);
          const isOutputSaturated =
            outputBufferValues.length > 0 &&
            outputBufferValues.some((buf) => buf.current >= buf.max);

          if (isOutputSaturated) {
            stallTicks = existing.stallTicksAccumulated + 1;
          } else {
            stallTicks = 0;
          }

          newNodes[delta.nodeId] = {
            ...existing,
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
          newEdges[delta.edgeId] = {
            ...existing,
            currentFlowRate: delta.actualFlowRate,
          };

          const producedAmount = Math.max(0, delta.actualFlowRate * tickSeconds);
          if (producedAmount > 0) {
            newProducedTotals[existing.materialId] =
              (newProducedTotals[existing.materialId] ?? 0) + producedAmount;
          }
        } else {
          newEdges[delta.edgeId] = {
            ...existing,
            currentTransferRate: delta.actualFlowRate,
          };
        }
      }

      return {
        nodes: newNodes,
        edges: newEdges,
        availableEnergy: result.globalEnergyBalance.production,
        consumedEnergy: result.globalEnergyBalance.consumption,
        producedTotals: newProducedTotals,
        completedMissionIds: completeAvailableMissions(
          state.completedMissionIds,
          newProducedTotals
        ),
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
}));
