import { create } from 'zustand';
import { FactoryNode, ResourceEdge, TickResult } from '../types';
import { wouldCreateCycle } from '../engine/graphUtils';

interface FactoryStoreState {
  id: string;
  isUnlocked: boolean;
  nodes: Record<string, FactoryNode>;
  edges: Record<string, ResourceEdge>;
  availableEnergy: number;
  consumedEnergy: number;

  // Actions
  addNode: (node: FactoryNode) => void;
  deleteNode: (nodeId: string) => void;
  connectNodes: (
    sourceNodeId: string,
    targetNodeId: string,
    materialId: string,
    maxCapacityRate: number
  ) => { success: boolean; error?: string };
  applyTickResult: (result: TickResult) => void;

  // Helpers
  getNodesMap: () => Map<string, FactoryNode>;
  getEdgesMap: () => Map<string, ResourceEdge>;
}

function recordToMap<V>(record: Record<string, V>): Map<string, V> {
  return new Map(Object.entries(record));
}

export const useFactoryStore = create<FactoryStoreState>((set, get) => ({
  id: 'sector_alpha',
  isUnlocked: true,
  nodes: {},
  edges: {},
  availableEnergy: 1000,
  consumedEnergy: 0,

  addNode(node: FactoryNode) {
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

  applyTickResult(result: TickResult) {
    set((state) => {
      const newNodes = { ...state.nodes };
      const newEdges = { ...state.edges };

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
        }
      }

      return { nodes: newNodes, edges: newEdges };
    });
  },

  getNodesMap(): Map<string, FactoryNode> {
    return recordToMap(get().nodes);
  },

  getEdgesMap(): Map<string, ResourceEdge> {
    return recordToMap(get().edges);
  },
}));
