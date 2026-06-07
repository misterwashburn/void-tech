import {
  FactoryEdge,
  FactoryNode,
  PowerEdge,
  ResourceEdge,
  TickResult,
  NodeTickDelta,
  EdgeTickDelta,
} from '../types';
import { topologicalSort } from './graphUtils';
import { getHarvesterOutputRate } from '../data/harvesters';
const STALL_THRESHOLD = 10;

function isResourceEdge(edge: FactoryEdge): edge is ResourceEdge {
  return edge.connectionType === 'RESOURCE';
}

function isPowerEdge(edge: FactoryEdge): edge is PowerEdge {
  return edge.connectionType === 'POWER';
}

function isTransportJunction(node: FactoryNode): boolean {
  return node.type === 'MERGE_UNIT' || node.type === 'SPLIT_UNIT';
}

function getProductionRecipe(node: FactoryNode) {
  return node.type === 'HARVESTER' || node.type === 'REFINER' || node.type === 'ASSEMBLER'
    ? node.productionRecipe
    : undefined;
}

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
  edges: Map<string, FactoryEdge>
): TickResult {
  const resourceEdges = new Map(
    Array.from(edges.entries()).filter(([, edge]) => isResourceEdge(edge))
  ) as Map<string, ResourceEdge>;
  const powerEdges = Array.from(edges.values()).filter(isPowerEdge);

  // Step 1: Topological sort (resource graph only; power lines are a separate network)
  const sortedIds = topologicalSort(nodes, resourceEdges);

  // Build lookup: targetNodeId -> resource edges feeding into it
  const incomingEdges = new Map<string, ResourceEdge[]>();
  // Build lookup: sourceNodeId -> resource edges going out of it
  const outgoingEdges = new Map<string, ResourceEdge[]>();
  for (const nodeId of nodes.keys()) {
    incomingEdges.set(nodeId, []);
    outgoingEdges.set(nodeId, []);
  }

  for (const edge of resourceEdges.values()) {
    if (nodes.has(edge.targetNodeId)) {
      incomingEdges.get(edge.targetNodeId)!.push(edge);
    }
    if (nodes.has(edge.sourceNodeId)) {
      outgoingEdges.get(edge.sourceNodeId)!.push(edge);
    }
  }


  const nodeDeltas = new Map<string, NodeTickDelta>();
  const edgeDeltas = new Map<string, EdgeTickDelta>();

  const computedEfficiency = new Map<string, number>();
  const productionRatesByNode = new Map<string, Record<string, number>>();
  const allocatedPowerByEdge = new Map<string, number>();
  const allocatedPowerByTarget = new Map<string, number>();
  const remainingPowerBySource = new Map<string, number>();
  const remainingPowerRequirementByTarget = new Map<string, number>();

  let totalPowerProduction = 0;
  let totalPowerConsumption = 0;

  for (const node of nodes.values()) {
    if (node.type === 'POWER_GENERATOR') {
      remainingPowerBySource.set(node.id, node.powerOutput);
    } else {
      remainingPowerRequirementByTarget.set(node.id, node.powerRequirement);
    }
  }

  for (const edge of powerEdges) {
    const sourceNode = nodes.get(edge.sourceNodeId);
    const targetNode = nodes.get(edge.targetNodeId);
    if (sourceNode?.type !== 'POWER_GENERATOR' || !targetNode || targetNode.type === 'POWER_GENERATOR') {
      allocatedPowerByEdge.set(edge.id, 0);
      continue;
    }

    const sourceRemaining = remainingPowerBySource.get(sourceNode.id) ?? 0;
    const targetRemaining = remainingPowerRequirementByTarget.get(targetNode.id) ?? 0;
    const allocatedPower = Math.min(edge.maxTransferRate, sourceRemaining, targetRemaining);

    remainingPowerBySource.set(sourceNode.id, sourceRemaining - allocatedPower);
    remainingPowerRequirementByTarget.set(targetNode.id, targetRemaining - allocatedPower);
    allocatedPowerByEdge.set(edge.id, allocatedPower);
    allocatedPowerByTarget.set(targetNode.id, (allocatedPowerByTarget.get(targetNode.id) ?? 0) + allocatedPower);
  }

  for (const nodeId of sortedIds) {
    const node = nodes.get(nodeId)!;
    const recipe = getProductionRecipe(node);

    let rawEfficiency = 1.0;
    let stallTicks = node.stallTicksAccumulated;
    let status: NodeTickDelta['operationalStatus'] = 'OPERATIONAL';
    let energyDraw = 0;

    if (node.type === 'POWER_GENERATOR') {
      rawEfficiency = 1.0;
      totalPowerProduction += node.powerOutput;
    } else if (node.type === 'HARVESTER' && !recipe) {
      rawEfficiency = 1.0;
    } else if (node.type === 'FEEDBACK_REGULATOR') {
      rawEfficiency = 1.0;
    } else if (recipe) {
      if (recipe.inputs.length === 0) {
        rawEfficiency = 1.0;
      } else {
        let minRatio = Infinity;
        const nodeIncomingEdges = incomingEdges.get(nodeId) ?? [];

        for (const inputSpec of recipe.inputs) {
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
    }

    if (node.type !== 'POWER_GENERATOR') {
      const requiredPower = node.powerRequirement;
      const suppliedPower = allocatedPowerByTarget.get(nodeId) ?? 0;
      const powerRatio = requiredPower > 0 ? Math.min(1, suppliedPower / requiredPower) : 1;

      rawEfficiency *= powerRatio;
      energyDraw = requiredPower * rawEfficiency;
      totalPowerConsumption += energyDraw;
    }

    const outputBufferValues = Object.values(node.outputBuffers);
    const isOutputSaturated =
      outputBufferValues.length > 0 &&
      outputBufferValues.some((buf) => buf.current >= buf.max);

    if (isOutputSaturated) {
      stallTicks += 1;
      if (stallTicks >= STALL_THRESHOLD) {
        rawEfficiency = 0;
        status = 'STALLED';
      } else {
        status = 'WARNING';
      }
    } else {
      stallTicks = 0;
    }

    if (status !== 'STALLED' && status !== 'WARNING') {
      if (rawEfficiency < 1.0) {
        status = 'STARVED';
      } else {
        status = 'OPERATIONAL';
      }
    }

    computedEfficiency.set(nodeId, rawEfficiency);

    nodeDeltas.set(nodeId, {
      nodeId,
      calculatedEfficiency: rawEfficiency,
      operationalStatus: status,
      energyDraw,
    });
  }

  for (const sourceNodeId of sortedIds) {
    const sourceNode = nodes.get(sourceNodeId)!;
    const sourceEdges = outgoingEdges.get(sourceNode.id) ?? [];
    const recipe = getProductionRecipe(sourceNode);
    const materialIds = new Set(sourceEdges.map((edge) => edge.materialId));
    for (const output of recipe?.outputs ?? []) {
      materialIds.add(output.materialId);
    }
    if (sourceNode.type === 'HARVESTER' && !recipe) {
      materialIds.add('void_ore');
    }
    const sourceEfficiency = computedEfficiency.get(sourceNode.id) ?? 0;

    for (const materialId of materialIds) {
      let availableRate = 0;

      if (isTransportJunction(sourceNode)) {
        availableRate = (incomingEdges.get(sourceNode.id) ?? [])
          .filter((edge) => edge.materialId === materialId)
          .reduce((sum, edge) => sum + edge.currentFlowRate, 0);
      } else if (sourceNode.type === 'STORAGE') {
        const storedAmount = Math.max(0, sourceNode.inputBuffers[materialId]?.current ?? 0);
        const incomingRate = (incomingEdges.get(sourceNode.id) ?? [])
          .filter((edge) => edge.materialId === materialId)
          .reduce((sum, edge) => sum + (edgeDeltas.get(edge.id)?.actualFlowRate ?? edge.currentFlowRate), 0);
        availableRate = storedAmount + incomingRate;
      } else if (sourceNode.type === 'HARVESTER' && !recipe) {
        availableRate = materialId === 'void_ore' ? getHarvesterOutputRate(sourceNode, materialId) : 0;
      } else if (recipe) {
        const outputSpec = recipe.outputs.find((output) => output.materialId === materialId);
        if (outputSpec?.stochastic) {
          availableRate = boxMullerTransform(
            outputSpec.stochastic.baseMean,
            outputSpec.stochastic.standardDeviation
          );
        } else if (outputSpec) {
          availableRate = sourceNode.type === 'HARVESTER'
            ? getHarvesterOutputRate(sourceNode, materialId)
            : outputSpec.ratePerSecond;
        }
      }

      availableRate *= sourceEfficiency;
      const productionRate = availableRate;
      if (sourceNode.type === 'HARVESTER') {
        availableRate = Math.max(
          availableRate,
          Math.max(0, sourceNode.outputBuffers[materialId]?.current ?? 0)
        );
      }
      if ((recipe || sourceNode.type === 'HARVESTER') && availableRate > 0) {
        const nodeProductionRates = productionRatesByNode.get(sourceNode.id) ?? {};
        nodeProductionRates[materialId] = (nodeProductionRates[materialId] ?? 0) + productionRate;
        productionRatesByNode.set(sourceNode.id, nodeProductionRates);
      }

      const matchingEdges = sourceEdges.filter((candidate) => candidate.materialId === materialId);
      const ratePerEdge = matchingEdges.length > 0 ? availableRate / matchingEdges.length : 0;
      for (const edge of matchingEdges) {
        const actualFlowRate = Math.min(edge.maxCapacityRate, ratePerEdge);
        edgeDeltas.set(edge.id, { edgeId: edge.id, actualFlowRate });
      }
    }

    for (const edge of sourceEdges) {
      if (!edgeDeltas.has(edge.id)) {
        edgeDeltas.set(edge.id, { edgeId: edge.id, actualFlowRate: 0 });
      }
    }
  }

  for (const edge of powerEdges) {
    edgeDeltas.set(edge.id, {
      edgeId: edge.id,
      actualFlowRate: allocatedPowerByEdge.get(edge.id) ?? 0,
    });
  }

  return {
    timestamp: Date.now(),
    nodeDeltas,
    edgeDeltas,
    productionRatesByNode,
    globalEnergyBalance: {
      production: totalPowerProduction,
      consumption: totalPowerConsumption,
    },
  };
}
