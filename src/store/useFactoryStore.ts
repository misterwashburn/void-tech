import { create } from 'zustand';
import { FactoryNode, NodeType, ResourceEdge, TickResult } from '../types';
import { wouldCreateCycle } from '../engine/graphUtils';
import { getCurrentMission, getUnlockedProgression } from '../data/missions';

interface FactoryStoreState {
  id: string;
  isUnlocked: boolean;
  nodes: Record<string, FactoryNode>;
  edges: Record<string, ResourceEdge>;
  availableEnergy: number;
  consumedEnergy: number;
  producedTotals: Record<string, number>;
  completedMissionIds: string[];

  // Actions
  addNode: (node: FactoryNode) => void;
  deleteNode: (nodeId: string) => void;
  connectNodes: (
    sourceNodeId: string,
    targetNodeId: string,
    materialId: string,
    maxCapacityRate: number
  ) => { success: boolean; error?: string };
  applyTickResult: (result: TickResult, tickSeconds?: number) => void;

  // Helpers
  getNodesMap: () => Map<string, FactoryNode>;
  getEdgesMap: () => Map<string, ResourceEdge>;
  getUnlockedNodeTypes: () => NodeType[];
  getUnlockedMaterialIds: () => string[];
  getUnlockedRecipeIds: () => string[];
}

function recordToMap<V>(record: Record<string, V>): Map<string, V> {
  return new Map(Object.entries(record));
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
  availableEnergy: 1000,
  consumedEnergy: 0,
  producedTotals: {},
  completedMissionIds: [],

  addNode(node: FactoryNode) {
    const unlockedNodeTypes = get().getUnlockedNodeTypes();
    if (!unlockedNodeTypes.includes(node.type)) {
      return;
    }

    set((state) => ({
      nodes: { ...state.nodes, [node.id]: node },
    }));
  },

  deleteNode(nodeId: string) {
    set((state) => {
      const newNodes = { ...state.nodes };
      delete newNodes[nodeId];

      const newEdges: Record<string, ResourceEdge> = {};
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
      materialId,
      maxCapacityRate,
      currentFlowRate: 0,
    };

    set((s) => ({
      edges: { ...s.edges, [edgeId]: newEdge },
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
          // Compute updated stall ticks based on status
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
        if (existing) {
          newEdges[delta.edgeId] = {
            ...existing,
            currentFlowRate: delta.actualFlowRate,
          };

          const producedAmount = Math.max(0, delta.actualFlowRate * tickSeconds);
          if (producedAmount > 0) {
            newProducedTotals[existing.materialId] =
              (newProducedTotals[existing.materialId] ?? 0) + producedAmount;
          }
        }
      }

      return {
        nodes: newNodes,
        edges: newEdges,
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

  getEdgesMap(): Map<string, ResourceEdge> {
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
}));
