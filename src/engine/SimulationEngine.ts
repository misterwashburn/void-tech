import {
  FactoryNode,
  ResourceEdge,
  TickResult,
  NodeTickDelta,
  EdgeTickDelta,
} from '../types';
import { topologicalSort } from './graphUtils';

const HARVESTER_DEFAULT_OUTPUT_RATE = 10.0;
const STALL_THRESHOLD = 10;

/**
 * Box-Muller transform: generates one sample from a normal distribution.
 * Result is clamped to >= 0.
 */
export function boxMullerTransform(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const sample = mean + stdDev * z;
  return Math.max(0, sample);
}

/**
 * Pure function: evaluates one simulation tick.
 * Returns a TickResult with all deltas — does NOT mutate inputs.
 */
export function evaluateTick(
  nodes: Map<string, FactoryNode>,
  edges: Map<string, ResourceEdge>
): TickResult {
  // Step 1: Topological sort (sources first)
  const sortedIds = topologicalSort(nodes, edges);

  // Build lookup: targetNodeId -> edges feeding into it
  const incomingEdges = new Map<string, ResourceEdge[]>();
  // Build lookup: sourceNodeId -> edges going out of it
  const outgoingEdges = new Map<string, ResourceEdge[]>();

  for (const nodeId of nodes.keys()) {
    incomingEdges.set(nodeId, []);
    outgoingEdges.set(nodeId, []);
  }

  for (const edge of edges.values()) {
    if (nodes.has(edge.targetNodeId)) {
      incomingEdges.get(edge.targetNodeId)!.push(edge);
    }
    if (nodes.has(edge.sourceNodeId)) {
      outgoingEdges.get(edge.sourceNodeId)!.push(edge);
    }
  }

  const nodeDeltas = new Map<string, NodeTickDelta>();
  const edgeDeltas = new Map<string, EdgeTickDelta>();

  // Working copy of efficiency ratings (needed for edge computation later)
  const computedEfficiency = new Map<string, number>();
  // Working copy of stall ticks (for updated status)
  const computedStallTicks = new Map<string, number>();

  // Step 2: Process nodes in topological order
  for (const nodeId of sortedIds) {
    const node = nodes.get(nodeId)!;
    const recipe = node.productionRecipe;

    let rawEfficiency = 1.0;
    let stallTicks = node.stallTicksAccumulated;
    let status: NodeTickDelta['operationalStatus'] = 'OPERATIONAL';
    let energyDraw = 0;

    if (node.type === 'HARVESTER' && !recipe) {
      // Rule 3: HARVESTERs with no recipe always have efficiency 1.0
      rawEfficiency = 1.0;
    } else if (node.type === 'FEEDBACK_REGULATOR') {
      // Rule 3: FEEDBACK_REGULATOR — consume input, no output, efficiency 1.0
      rawEfficiency = 1.0;
    } else if (recipe) {
      // Rule 3: Limiting-reagent logic for nodes with recipes
      if (recipe.inputs.length === 0) {
        rawEfficiency = 1.0;
      } else {
        let minRatio = Infinity;
        const nodeIncomingEdges = incomingEdges.get(nodeId) ?? [];

        for (const inputSpec of recipe.inputs) {
          // Sum all incoming flow rates for this material
          const totalFlow = nodeIncomingEdges
            .filter((e) => e.materialId === inputSpec.materialId)
            .reduce((sum, e) => sum + e.currentFlowRate, 0);

          const ratio = inputSpec.ratePerSecond > 0
            ? totalFlow / inputSpec.ratePerSecond
            : 1.0;

          if (ratio < minRatio) {
            minRatio = ratio;
          }
        }

        rawEfficiency = Math.min(1.0, minRatio === Infinity ? 1.0 : minRatio);
      }

      energyDraw = recipe.energyCost * rawEfficiency;
    }

    // Rule 4: Backpressure / hysteresis
    const outputBufferValues = Object.values(node.outputBuffers);
    const isOutputSaturated =
      outputBufferValues.length > 0 &&
      outputBufferValues.some((buf) => buf.current >= buf.max);

    if (isOutputSaturated) {
      stallTicks += 1;
      if (stallTicks >= STALL_THRESHOLD) {
        // Rule 4 + 5: STALLED
        rawEfficiency = 0;
        status = 'STALLED';
      } else {
        // Rule 4 + 5: WARNING (efficiency unaffected)
        status = 'WARNING';
      }
    } else {
      stallTicks = 0;
    }

    // Rule 5: Status assignment (if not already set by stall logic)
    if (status !== 'STALLED' && status !== 'WARNING') {
      if (rawEfficiency < 1.0) {
        status = 'STARVED';
      } else {
        status = 'OPERATIONAL';
      }
    }

    computedEfficiency.set(nodeId, rawEfficiency);
    computedStallTicks.set(nodeId, stallTicks);

    nodeDeltas.set(nodeId, {
      nodeId,
      calculatedEfficiency: rawEfficiency,
      operationalStatus: status,
      energyDraw,
    });
  }

  // Step 3: Compute edge flow rates
  for (const edge of edges.values()) {
    const sourceNode = nodes.get(edge.sourceNodeId);
    if (!sourceNode) continue;

    const sourceEfficiency = computedEfficiency.get(edge.sourceNodeId) ?? 0;
    const recipe = sourceNode.productionRecipe;

    let baseOutputRate: number;

    if (sourceNode.type === 'HARVESTER' && !recipe) {
      // Rule 6: HARVESTER with no recipe uses default 10.0/s
      baseOutputRate = HARVESTER_DEFAULT_OUTPUT_RATE;
    } else if (recipe) {
      // Find the matching output for this edge's material
      const outputSpec = recipe.outputs.find(
        (o) => o.materialId === edge.materialId
      );

      if (outputSpec) {
        if (outputSpec.stochastic) {
          // Apply Box-Muller transform for stochastic outputs
          baseOutputRate = boxMullerTransform(
            outputSpec.stochastic.baseMean,
            outputSpec.stochastic.standardDeviation
          );
        } else {
          baseOutputRate = outputSpec.ratePerSecond;
        }
      } else {
        baseOutputRate = 0;
      }
    } else {
      baseOutputRate = 0;
    }

    // Rule 6: actualFlowRate = min(maxCapacityRate, efficiency * baseOutputRate)
    const actualFlowRate = Math.min(
      edge.maxCapacityRate,
      sourceEfficiency * baseOutputRate
    );

    edgeDeltas.set(edge.id, {
      edgeId: edge.id,
      actualFlowRate,
    });
  }

  // Step 4: Energy balance
  let totalConsumption = 0;
  for (const delta of nodeDeltas.values()) {
    totalConsumption += delta.energyDraw;
  }

  return {
    timestamp: Date.now(),
    nodeDeltas,
    edgeDeltas,
    globalEnergyBalance: {
      production: 0,
      consumption: totalConsumption,
    },
  };
}
