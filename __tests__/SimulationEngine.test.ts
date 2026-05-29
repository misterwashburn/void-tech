import { evaluateTick, boxMullerTransform } from '../src/engine/SimulationEngine';
import { wouldCreateCycle, topologicalSort } from '../src/engine/graphUtils';
import { FactoryNode, ResourceEdge } from '../src/types';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeNode(overrides: Partial<FactoryNode> & { id: string }): FactoryNode {
  return {
    id: overrides.id,
    name: overrides.name ?? overrides.id,
    type: overrides.type ?? 'REFINER',
    gridX: overrides.gridX ?? 0,
    gridY: overrides.gridY ?? 0,
    inputBuffers: overrides.inputBuffers ?? {},
    outputBuffers: overrides.outputBuffers ?? {},
    productionRecipe: overrides.productionRecipe,
    efficiencyRating: overrides.efficiencyRating ?? 1.0,
    isOperational: overrides.isOperational ?? true,
    cosmeticSkinId: overrides.cosmeticSkinId ?? null,
    stallTicksAccumulated: overrides.stallTicksAccumulated ?? 0,
    operationalStatus: overrides.operationalStatus ?? 'OPERATIONAL',
  };
}

function makeEdge(overrides: Partial<ResourceEdge> & { id: string; sourceNodeId: string; targetNodeId: string }): ResourceEdge {
  return {
    id: overrides.id,
    sourceNodeId: overrides.sourceNodeId,
    targetNodeId: overrides.targetNodeId,
    materialId: overrides.materialId ?? 'mat_a',
    maxCapacityRate: overrides.maxCapacityRate ?? 100,
    currentFlowRate: overrides.currentFlowRate ?? 0,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('SimulationEngine', () => {
  // 1. Basic harvester tick
  it('HARVESTER with no recipe always has efficiency 1.0', () => {
    const harvester = makeNode({
      id: 'h1',
      type: 'HARVESTER',
      productionRecipe: undefined,
    });
    const nodes = new Map([['h1', harvester]]);
    const edges = new Map<string, ResourceEdge>();

    const result = evaluateTick(nodes, edges);

    expect(result.nodeDeltas.has('h1')).toBe(true);
    const delta = result.nodeDeltas.get('h1')!;
    expect(delta.calculatedEfficiency).toBe(1.0);
    expect(delta.operationalStatus).toBe('OPERATIONAL');
  });

  // 2. Limiting reagent — only one input supplied
  it('limiting reagent: efficiency is min ratio across all inputs', () => {
    const harvA = makeNode({ id: 'hA', type: 'HARVESTER' });
    const refiner = makeNode({
      id: 'ref1',
      type: 'REFINER',
      productionRecipe: {
        inputs: [
          { materialId: 'mat_a', ratePerSecond: 5 },
          { materialId: 'mat_b', ratePerSecond: 5 },
        ],
        outputs: [{ materialId: 'mat_c', ratePerSecond: 5 }],
        energyCost: 10,
      },
    });

    const nodes = new Map([
      ['hA', harvA],
      ['ref1', refiner],
    ]);

    // Only mat_a is supplied at 3/s (60% of 5). mat_b has no edge → flow 0.
    const edgeA = makeEdge({
      id: 'e1',
      sourceNodeId: 'hA',
      targetNodeId: 'ref1',
      materialId: 'mat_a',
      currentFlowRate: 3,
      maxCapacityRate: 10,
    });

    const edges = new Map([['e1', edgeA]]);
    const result = evaluateTick(nodes, edges);

    const delta = result.nodeDeltas.get('ref1')!;
    // mat_a ratio = 3/5 = 0.6, mat_b ratio = 0/5 = 0. Min = 0 → STARVED
    expect(delta.calculatedEfficiency).toBe(0);
    expect(delta.operationalStatus).toBe('STARVED');
  });

  // 3. Full efficiency when both inputs supplied at or above required rate
  it('efficiency = 1.0 when all inputs are at or above required rate', () => {
    const harvA = makeNode({ id: 'hA', type: 'HARVESTER' });
    const harvB = makeNode({ id: 'hB', type: 'HARVESTER' });
    const refiner = makeNode({
      id: 'ref1',
      type: 'REFINER',
      productionRecipe: {
        inputs: [
          { materialId: 'mat_a', ratePerSecond: 5 },
          { materialId: 'mat_b', ratePerSecond: 5 },
        ],
        outputs: [{ materialId: 'mat_c', ratePerSecond: 5 }],
        energyCost: 10,
      },
    });

    const nodes = new Map([
      ['hA', harvA],
      ['hB', harvB],
      ['ref1', refiner],
    ]);

    const edgeA = makeEdge({
      id: 'e1',
      sourceNodeId: 'hA',
      targetNodeId: 'ref1',
      materialId: 'mat_a',
      currentFlowRate: 6,
      maxCapacityRate: 10,
    });
    const edgeB = makeEdge({
      id: 'e2',
      sourceNodeId: 'hB',
      targetNodeId: 'ref1',
      materialId: 'mat_b',
      currentFlowRate: 5,
      maxCapacityRate: 10,
    });

    const edges = new Map([['e1', edgeA], ['e2', edgeB]]);
    const result = evaluateTick(nodes, edges);

    const delta = result.nodeDeltas.get('ref1')!;
    expect(delta.calculatedEfficiency).toBe(1.0);
    expect(delta.operationalStatus).toBe('OPERATIONAL');
  });

  // 4. Backpressure warning: output buffer full, stallTicks < 10
  it('backpressure warning: output saturated, stallTicks increments but status = WARNING', () => {
    const node = makeNode({
      id: 'n1',
      type: 'HARVESTER',
      stallTicksAccumulated: 3,
      outputBuffers: { mat_a: { current: 100, max: 100 } }, // saturated
    });

    const nodes = new Map([['n1', node]]);
    const edges = new Map<string, ResourceEdge>();

    const result = evaluateTick(nodes, edges);
    const delta = result.nodeDeltas.get('n1')!;

    expect(delta.operationalStatus).toBe('WARNING');
    // efficiency should NOT be zeroed for WARNING
    expect(delta.calculatedEfficiency).toBeGreaterThan(0);
  });

  // 5. Backpressure stall: stallTicks already at 9, buffer still full → STALLED
  it('backpressure stall: stallTicks >= 10 → STALLED with efficiency 0', () => {
    const node = makeNode({
      id: 'n1',
      type: 'HARVESTER',
      stallTicksAccumulated: 9, // will become 10 after this tick
      outputBuffers: { mat_a: { current: 100, max: 100 } }, // saturated
    });

    const nodes = new Map([['n1', node]]);
    const edges = new Map<string, ResourceEdge>();

    const result = evaluateTick(nodes, edges);
    const delta = result.nodeDeltas.get('n1')!;

    expect(delta.operationalStatus).toBe('STALLED');
    expect(delta.calculatedEfficiency).toBe(0);
  });

  // 6. Stall recovery: output buffer clears → stallTicks resets, status OPERATIONAL
  it('stall recovery: output buffer clears → stallTicks = 0, status OPERATIONAL', () => {
    const node = makeNode({
      id: 'n1',
      type: 'HARVESTER',
      stallTicksAccumulated: 5,
      outputBuffers: { mat_a: { current: 50, max: 100 } }, // NOT saturated
    });

    const nodes = new Map([['n1', node]]);
    const edges = new Map<string, ResourceEdge>();

    const result = evaluateTick(nodes, edges);
    const delta = result.nodeDeltas.get('n1')!;

    expect(delta.operationalStatus).toBe('OPERATIONAL');
    expect(delta.calculatedEfficiency).toBe(1.0);
  });

  // 7. Cycle detection: wouldCreateCycle returns true
  it('wouldCreateCycle returns true when adding an edge would close a loop', () => {
    const a = makeNode({ id: 'a' });
    const b = makeNode({ id: 'b' });
    const c = makeNode({ id: 'c' });

    const nodes = new Map([['a', a], ['b', b], ['c', c]]);

    // existing chain: a → b → c
    const e1 = makeEdge({ id: 'e1', sourceNodeId: 'a', targetNodeId: 'b' });
    const e2 = makeEdge({ id: 'e2', sourceNodeId: 'b', targetNodeId: 'c' });
    const edges = new Map([['e1', e1], ['e2', e2]]);

    // Adding c → a would create a cycle (a → b → c → a)
    expect(wouldCreateCycle(nodes, edges, 'c', 'a')).toBe(true);
  });

  // 8. No cycle false positive
  it('wouldCreateCycle returns false for a valid new edge', () => {
    const a = makeNode({ id: 'a' });
    const b = makeNode({ id: 'b' });
    const c = makeNode({ id: 'c' });

    const nodes = new Map([['a', a], ['b', b], ['c', c]]);

    // existing: a → b
    const e1 = makeEdge({ id: 'e1', sourceNodeId: 'a', targetNodeId: 'b' });
    const edges = new Map([['e1', e1]]);

    // Adding a → c is fine, no cycle
    expect(wouldCreateCycle(nodes, edges, 'a', 'c')).toBe(false);
  });

  // 9. Edge flow rate capped at maxCapacityRate
  it('actualFlowRate is capped at edge maxCapacityRate', () => {
    const harvester = makeNode({ id: 'h1', type: 'HARVESTER' });
    const sink = makeNode({ id: 's1', type: 'SINK' });

    const nodes = new Map([['h1', harvester], ['s1', sink]]);

    // HARVESTER default output is 10/s, but edge cap is 5
    const edge = makeEdge({
      id: 'e1',
      sourceNodeId: 'h1',
      targetNodeId: 's1',
      maxCapacityRate: 5,
      currentFlowRate: 0,
    });
    const edges = new Map([['e1', edge]]);

    const result = evaluateTick(nodes, edges);
    const edgeDelta = result.edgeDeltas.get('e1')!;

    // 10 * 1.0 = 10, but capped at 5
    expect(edgeDelta.actualFlowRate).toBe(5);
  });

  // 10. TickResult structure
  it('TickResult has correct structure with entries for all nodes and edges', () => {
    const h1 = makeNode({ id: 'h1', type: 'HARVESTER' });
    const r1 = makeNode({
      id: 'r1',
      type: 'REFINER',
      productionRecipe: {
        inputs: [{ materialId: 'mat_a', ratePerSecond: 5 }],
        outputs: [{ materialId: 'mat_b', ratePerSecond: 4 }],
        energyCost: 8,
      },
    });
    const nodes = new Map([['h1', h1], ['r1', r1]]);

    const edge = makeEdge({
      id: 'e1',
      sourceNodeId: 'h1',
      targetNodeId: 'r1',
      materialId: 'mat_a',
      currentFlowRate: 5,
      maxCapacityRate: 20,
    });
    const edges = new Map([['e1', edge]]);

    const result = evaluateTick(nodes, edges);

    // Required top-level keys
    expect(typeof result.timestamp).toBe('number');
    expect(result.nodeDeltas).toBeInstanceOf(Map);
    expect(result.edgeDeltas).toBeInstanceOf(Map);
    expect(result.globalEnergyBalance).toBeDefined();
    expect(typeof result.globalEnergyBalance.production).toBe('number');
    expect(typeof result.globalEnergyBalance.consumption).toBe('number');

    // Entries for every node
    expect(result.nodeDeltas.has('h1')).toBe(true);
    expect(result.nodeDeltas.has('r1')).toBe(true);

    // Entries for every edge
    expect(result.edgeDeltas.has('e1')).toBe(true);

    // NodeTickDelta shape
    const nd = result.nodeDeltas.get('h1')!;
    expect(typeof nd.nodeId).toBe('string');
    expect(typeof nd.calculatedEfficiency).toBe('number');
    expect(typeof nd.energyDraw).toBe('number');
    expect(['OPERATIONAL', 'STARVED', 'WARNING', 'STALLED']).toContain(nd.operationalStatus);

    // EdgeTickDelta shape
    const ed = result.edgeDeltas.get('e1')!;
    expect(typeof ed.edgeId).toBe('string');
    expect(typeof ed.actualFlowRate).toBe('number');
  });
});

describe('boxMullerTransform', () => {
  it('returns a non-negative number', () => {
    for (let i = 0; i < 100; i++) {
      const sample = boxMullerTransform(5, 2);
      expect(sample).toBeGreaterThanOrEqual(0);
    }
  });

  it('mean of many samples is approximately the given mean', () => {
    const N = 10000;
    let sum = 0;
    for (let i = 0; i < N; i++) {
      sum += boxMullerTransform(10, 1);
    }
    const mean = sum / N;
    // Should be close to 10 (within 0.5 standard errors)
    expect(mean).toBeGreaterThan(9.5);
    expect(mean).toBeLessThan(10.5);
  });
});

describe('topologicalSort', () => {
  it('returns all node IDs in a valid topological order', () => {
    const a = makeNode({ id: 'a' });
    const b = makeNode({ id: 'b' });
    const c = makeNode({ id: 'c' });
    const nodes = new Map([['a', a], ['b', b], ['c', c]]);

    const e1 = makeEdge({ id: 'e1', sourceNodeId: 'a', targetNodeId: 'b' });
    const e2 = makeEdge({ id: 'e2', sourceNodeId: 'b', targetNodeId: 'c' });
    const edges = new Map([['e1', e1], ['e2', e2]]);

    const order = topologicalSort(nodes, edges);
    expect(order).toHaveLength(3);
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'));
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'));
  });

  it('throws on cycle detection', () => {
    const a = makeNode({ id: 'a' });
    const b = makeNode({ id: 'b' });
    const nodes = new Map([['a', a], ['b', b]]);

    // a → b and b → a = cycle
    const e1 = makeEdge({ id: 'e1', sourceNodeId: 'a', targetNodeId: 'b' });
    const e2 = makeEdge({ id: 'e2', sourceNodeId: 'b', targetNodeId: 'a' });
    const edges = new Map([['e1', e1], ['e2', e2]]);

    expect(() => topologicalSort(nodes, edges)).toThrow('Cycle detected in factory graph');
  });
});
