import { FactoryEdge, FactoryNode } from '../types';

function isResourceLike(edge: FactoryEdge): boolean {
  return edge.connectionType === 'RESOURCE';
}

/**
 * Topological sort using Kahn's algorithm.
 * Returns node IDs in processing order (sources first).
 * Throws if a cycle is detected.
 */
export function topologicalSort(
  nodes: Map<string, FactoryNode>,
  edges: Map<string, FactoryEdge>
): string[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const nodeId of nodes.keys()) {
    inDegree.set(nodeId, 0);
    adjacency.set(nodeId, []);
  }

  for (const edge of edges.values()) {
    if (!isResourceLike(edge)) continue;

    const { sourceNodeId, targetNodeId } = edge;
    if (!nodes.has(sourceNodeId) || !nodes.has(targetNodeId)) continue;

    inDegree.set(targetNodeId, (inDegree.get(targetNodeId) ?? 0) + 1);
    const neighbors = adjacency.get(sourceNodeId) ?? [];
    neighbors.push(targetNodeId);
    adjacency.set(sourceNodeId, neighbors);
  }

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
 * Returns true if adding a resource edge from newSourceId to newTargetId
 * would create a cycle in the current resource graph. Power lines are ignored
 * because they are a separate distribution network.
 */
export function wouldCreateCycle(
  nodes: Map<string, FactoryNode>,
  edges: Map<string, FactoryEdge>,
  newSourceId: string,
  newTargetId: string
): boolean {
  if (newSourceId === newTargetId) return true;

  const adjacency = new Map<string, string[]>();
  for (const nodeId of nodes.keys()) {
    adjacency.set(nodeId, []);
  }

  for (const edge of edges.values()) {
    if (!isResourceLike(edge)) continue;

    const { sourceNodeId, targetNodeId } = edge;
    if (!nodes.has(sourceNodeId) || !nodes.has(targetNodeId)) continue;
    const neighbors = adjacency.get(sourceNodeId) ?? [];
    neighbors.push(targetNodeId);
    adjacency.set(sourceNodeId, neighbors);
  }

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
