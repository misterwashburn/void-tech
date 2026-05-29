import { FactoryNode, ResourceEdge } from '../types';

/**
 * Topological sort using Kahn's algorithm.
 * Returns node IDs in processing order (sources first).
 * Throws if a cycle is detected.
 */
export function topologicalSort(
  nodes: Map<string, FactoryNode>,
  edges: Map<string, ResourceEdge>
): string[] {
  // Build in-degree map and adjacency list
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const nodeId of nodes.keys()) {
    inDegree.set(nodeId, 0);
    adjacency.set(nodeId, []);
  }

  for (const edge of edges.values()) {
    const { sourceNodeId, targetNodeId } = edge;
    // Only consider edges between nodes that exist in the map
    if (!nodes.has(sourceNodeId) || !nodes.has(targetNodeId)) continue;

    inDegree.set(targetNodeId, (inDegree.get(targetNodeId) ?? 0) + 1);
    const neighbors = adjacency.get(sourceNodeId) ?? [];
    neighbors.push(targetNodeId);
    adjacency.set(sourceNodeId, neighbors);
  }

  // Initialize queue with all nodes that have in-degree 0
  const queue: string[] = [];
  for (const [nodeId, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  const sorted: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    const neighbors = adjacency.get(current) ?? [];
    for (const neighbor of neighbors) {
      const newDegree = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (sorted.length !== nodes.size) {
    throw new Error('Cycle detected in factory graph');
  }

  return sorted;
}

/**
 * Returns true if adding an edge from newSourceId to newTargetId
 * would create a cycle in the current graph.
 *
 * Uses DFS reachability: can we reach newSourceId from newTargetId
 * via existing edges? If yes, adding the new edge closes a cycle.
 */
export function wouldCreateCycle(
  nodes: Map<string, FactoryNode>,
  edges: Map<string, ResourceEdge>,
  newSourceId: string,
  newTargetId: string
): boolean {
  // If source === target, it's immediately a self-loop (cycle)
  if (newSourceId === newTargetId) return true;

  // Build adjacency from existing edges (without the new edge)
  const adjacency = new Map<string, string[]>();
  for (const nodeId of nodes.keys()) {
    adjacency.set(nodeId, []);
  }

  for (const edge of edges.values()) {
    const { sourceNodeId, targetNodeId } = edge;
    if (!nodes.has(sourceNodeId) || !nodes.has(targetNodeId)) continue;
    const neighbors = adjacency.get(sourceNodeId) ?? [];
    neighbors.push(targetNodeId);
    adjacency.set(sourceNodeId, neighbors);
  }

  // DFS from newTargetId: can we reach newSourceId?
  const visited = new Set<string>();
  const stack: string[] = [newTargetId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === newSourceId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    const neighbors = adjacency.get(current) ?? [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        stack.push(neighbor);
      }
    }
  }

  return false;
}
