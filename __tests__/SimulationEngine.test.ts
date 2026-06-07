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
    powerRequirement: overrides.powerRequirement ?? 0,
    powerOutput: overrides.powerOutput ?? 0,
    powerTier: overrides.powerTier,
    harvesterTier: overrides.harvesterTier,
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
    connectionType: 'RESOURCE',
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

  it('HARVESTER with no recipe only outputs default Void Ore', () => {
    const harvester = makeNode({
      id: 'h1',
      type: 'HARVESTER',
      productionRecipe: undefined,
    });
    const sink = makeNode({ id: 's1', type: 'SINK' });
    const nodes = new Map([
      ['h1', harvester],
      ['s1', sink],
    ]);
    const voidEdge = makeEdge({
      id: 'void_edge',
      sourceNodeId: 'h1',
      targetNodeId: 's1',
      materialId: 'void_ore',
    });
    const hydrocarbonEdge = makeEdge({
      id: 'hydrocarbon_edge',
      sourceNodeId: 'h1',
      targetNodeId: 's1',
      materialId: 'hydrocarbon',
    });
    const edges = new Map([
      ['void_edge', voidEdge],
      ['hydrocarbon_edge', hydrocarbonEdge],
    ]);

    const result = evaluateTick(nodes, edges);

    expect(result.edgeDeltas.get('void_edge')?.actualFlowRate).toBe(10);
    expect(result.edgeDeltas.get('hydrocarbon_edge')?.actualFlowRate).toBe(0);
  });

  it('HARVESTER extraction recipe outputs the selected material', () => {
    const harvester = makeNode({
      id: 'h1',
      type: 'HARVESTER',
      productionRecipe: {
        nodeType: 'HARVESTER',
        inputs: [],
        outputs: [{ materialId: 'hydrocarbon', ratePerSecond: 10 }],
        energyCost: 8,
      },
    });
    const sink = makeNode({ id: 's1', type: 'SINK' });
    const nodes = new Map([
      ['h1', harvester],
      ['s1', sink],
    ]);
    const edge = makeEdge({
      id: 'e1',
      sourceNodeId: 'h1',
      targetNodeId: 's1',
      materialId: 'hydrocarbon',
    });
    const edges = new Map([['e1', edge]]);

    const result = evaluateTick(nodes, edges);

    expect(result.edgeDeltas.get('e1')?.actualFlowRate).toBe(10);
  });

  it('STORAGE ignores production recipes and only sends stored items', () => {
    const storage = makeNode({
      id: 'storage1',
      type: 'STORAGE',
      inputBuffers: { mat_a: { current: 7, max: 1000 } },
      productionRecipe: {
        inputs: [],
        outputs: [{ materialId: 'mat_a', ratePerSecond: 100 }],
        energyCost: 0,
      },
    });
    const sink = makeNode({ id: 's1', type: 'SINK' });
    const edge = makeEdge({
      id: 'e1',
      sourceNodeId: 'storage1',
      targetNodeId: 's1',
      materialId: 'mat_a',
    });

    const result = evaluateTick(
      new Map([['storage1', storage], ['s1', sink]]),
      new Map([['e1', edge]])
    );

    expect(result.edgeDeltas.get('e1')?.actualFlowRate).toBe(7);
    expect(result.productionRatesByNode.get('storage1')).toBeUndefined();
  });

  it('STORAGE passes incoming items through an outgoing line', () => {
    const harvester = makeNode({ id: 'h1', type: 'HARVESTER' });
    const storage = makeNode({ id: 'storage1', type: 'STORAGE' });
    const sink = makeNode({ id: 's1', type: 'SINK' });
    const input = makeEdge({
      id: 'input',
      sourceNodeId: 'h1',
      targetNodeId: 'storage1',
      materialId: 'void_ore',
      maxCapacityRate: 6,
      currentFlowRate: 0,
    });
    const output = makeEdge({
      id: 'output',
      sourceNodeId: 'storage1',
      targetNodeId: 's1',
      materialId: 'void_ore',
    });

    const result = evaluateTick(
      new Map([['h1', harvester], ['storage1', storage], ['s1', sink]]),
      new Map([['input', input], ['output', output]])
    );

    expect(result.edgeDeltas.get('output')?.actualFlowRate).toBe(6);
  });

  it('drains a stalled harvester buffer after storage is connected', () => {
    const harvester = makeNode({
      id: 'h1',
      type: 'HARVESTER',
      outputBuffers: { void_ore: { current: 10, max: 10 } },
      stallTicksAccumulated: 10,
      operationalStatus: 'STALLED',
    });
    const storage = makeNode({ id: 's1', type: 'STORAGE' });
    const edge = makeEdge({
      id: 'e1',
      sourceNodeId: 'h1',
      targetNodeId: 's1',
      materialId: 'void_ore',
      maxCapacityRate: 10,
    });

    const result = evaluateTick(
      new Map([['h1', harvester], ['s1', storage]]),
      new Map([['e1', edge]])
    );

    expect(result.nodeDeltas.get('h1')?.operationalStatus).toBe('STALLED');
    expect(result.productionRatesByNode.get('h1')?.void_ore).toBe(0);
    expect(result.edgeDeltas.get('e1')?.actualFlowRate).toBe(10);
  });

  it('higher tier harvesters extract high tier void materials faster', () => {
    const basicHarvester = makeNode({
      id: 'h1',
      type: 'HARVESTER',
      harvesterTier: 0,
      productionRecipe: {
        nodeType: 'HARVESTER',
        inputs: [],
        outputs: [{ materialId: 'probability_ore', ratePerSecond: 10 }],
        energyCost: 8,
      },
    });
    const genesisHarvester = makeNode({
      id: 'h2',
      type: 'HARVESTER',
      harvesterTier: 10,
      productionRecipe: {
        nodeType: 'HARVESTER',
        inputs: [],
        outputs: [{ materialId: 'probability_ore', ratePerSecond: 10 }],
        energyCost: 8,
      },
    });
    const sink = makeNode({ id: 's1', type: 'SINK' });
    const nodes = new Map([
      ['h1', basicHarvester],
      ['h2', genesisHarvester],
      ['s1', sink],
    ]);
    const basicEdge = makeEdge({
      id: 'basic_edge',
      sourceNodeId: 'h1',
      targetNodeId: 's1',
      materialId: 'probability_ore',
    });
    const genesisEdge = makeEdge({
      id: 'genesis_edge',
      sourceNodeId: 'h2',
      targetNodeId: 's1',
      materialId: 'probability_ore',
    });
    const edges = new Map([
      ['basic_edge', basicEdge],
      ['genesis_edge', genesisEdge],
    ]);

    const result = evaluateTick(nodes, edges);

    expect(result.edgeDeltas.get('basic_edge')?.actualFlowRate).toBeLessThan(
      result.edgeDeltas.get('genesis_edge')?.actualFlowRate ?? 0
    );
    expect(result.edgeDeltas.get('genesis_edge')?.actualFlowRate).toBe(24);
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
      materialId: 'void_ore',
      maxCapacityRate: 5,
      currentFlowRate: 0,
    });
    const edges = new Map([['e1', edge]]);

    const result = evaluateTick(nodes, edges);
    const edgeDelta = result.edgeDeltas.get('e1')!;

    // 10 * 1.0 = 10, but capped at 5
    expect(edgeDelta.actualFlowRate).toBe(5);
  });

  it('merge units forward combined incoming material to one outgoing line', () => {
    const sourceA = makeNode({ id: 'hA', type: 'HARVESTER' });
    const sourceB = makeNode({ id: 'hB', type: 'HARVESTER' });
    const merge = makeNode({ id: 'merge1', type: 'MERGE_UNIT' });
    const sink = makeNode({ id: 's1', type: 'SINK' });
    const nodes = new Map([
      ['hA', sourceA],
      ['hB', sourceB],
      ['merge1', merge],
      ['s1', sink],
    ]);

    const inA = makeEdge({ id: 'inA', sourceNodeId: 'hA', targetNodeId: 'merge1', currentFlowRate: 4 });
    const inB = makeEdge({ id: 'inB', sourceNodeId: 'hB', targetNodeId: 'merge1', currentFlowRate: 6 });
    const out = makeEdge({ id: 'out', sourceNodeId: 'merge1', targetNodeId: 's1', currentFlowRate: 0 });
    const edges = new Map([
      ['inA', inA],
      ['inB', inB],
      ['out', out],
    ]);

    const result = evaluateTick(nodes, edges);

    expect(result.edgeDeltas.get('out')?.actualFlowRate).toBe(10);
  });

  it('split units divide incoming material across matching outgoing lines', () => {
    const source = makeNode({ id: 'h1', type: 'HARVESTER' });
    const split = makeNode({ id: 'split1', type: 'SPLIT_UNIT' });
    const sinkA = makeNode({ id: 'sA', type: 'SINK' });
    const sinkB = makeNode({ id: 'sB', type: 'SINK' });
    const nodes = new Map([
      ['h1', source],
      ['split1', split],
      ['sA', sinkA],
      ['sB', sinkB],
    ]);

    const input = makeEdge({ id: 'input', sourceNodeId: 'h1', targetNodeId: 'split1', currentFlowRate: 12 });
    const outA = makeEdge({ id: 'outA', sourceNodeId: 'split1', targetNodeId: 'sA', currentFlowRate: 0 });
    const outB = makeEdge({ id: 'outB', sourceNodeId: 'split1', targetNodeId: 'sB', currentFlowRate: 0 });
    const edges = new Map([
      ['input', input],
      ['outA', outA],
      ['outB', outB],
    ]);

    const result = evaluateTick(nodes, edges);

    expect(result.edgeDeltas.get('outA')?.actualFlowRate).toBe(6);
    expect(result.edgeDeltas.get('outB')?.actualFlowRate).toBe(6);
  });

  it('divides ordinary machine output across outgoing lines without duplication', () => {
    const harvester = makeNode({ id: 'h1', type: 'HARVESTER' });
    const sinkA = makeNode({ id: 'sA', type: 'SINK' });
    const sinkB = makeNode({ id: 'sB', type: 'SINK' });
    const nodes = new Map([['h1', harvester], ['sA', sinkA], ['sB', sinkB]]);
    const edges = new Map([
      ['outA', makeEdge({ id: 'outA', sourceNodeId: 'h1', targetNodeId: 'sA', materialId: 'void_ore' })],
      ['outB', makeEdge({ id: 'outB', sourceNodeId: 'h1', targetNodeId: 'sB', materialId: 'void_ore' })],
    ]);

    const result = evaluateTick(nodes, edges);

    expect(result.edgeDeltas.get('outA')?.actualFlowRate).toBe(5);
    expect(result.edgeDeltas.get('outB')?.actualFlowRate).toBe(5);
    expect(result.productionRatesByNode.get('h1')?.void_ore).toBe(10);
  });

  it('records production even when a source has no outgoing line', () => {
    const harvester = makeNode({ id: 'h1', type: 'HARVESTER' });

    const result = evaluateTick(new Map([['h1', harvester]]), new Map());

    expect(result.productionRatesByNode.get('h1')?.void_ore).toBe(10);
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

  it('requires a power line before machines can operate', () => {
    const generator = makeNode({
      id: 'p1',
      type: 'POWER_GENERATOR',
      powerOutput: 35,
      powerTier: 0,
    });
    const harvester = makeNode({
      id: 'h1',
      type: 'HARVESTER',
      powerRequirement: 8,
    });
    const nodes = new Map([['p1', generator], ['h1', harvester]]);
    const edges = new Map();

    const result = evaluateTick(nodes, edges);

    expect(result.globalEnergyBalance.production).toBe(35);
    expect(result.nodeDeltas.get('h1')?.calculatedEfficiency).toBe(0);
    expect(result.nodeDeltas.get('h1')?.operationalStatus).toBe('STARVED');
  });

  it('powers machines through POWER edges without adding resource graph cycles', () => {
    const generator = makeNode({
      id: 'p1',
      type: 'POWER_GENERATOR',
      powerOutput: 35,
      powerTier: 0,
    });
    const harvester = makeNode({
      id: 'h1',
      type: 'HARVESTER',
      powerRequirement: 8,
    });
    const nodes = new Map([['p1', generator], ['h1', harvester]]);
    const powerEdge = {
      id: 'pow1',
      sourceNodeId: 'p1',
      targetNodeId: 'h1',
      connectionType: 'POWER' as const,
      maxTransferRate: 35,
      currentTransferRate: 0,
    };
    const edges = new Map([['pow1', powerEdge]]);

    const result = evaluateTick(nodes, edges);

    expect(result.nodeDeltas.get('h1')?.calculatedEfficiency).toBe(1);
    expect(result.edgeDeltas.get('pow1')?.actualFlowRate).toBe(8);
    expect(topologicalSort(nodes, edges)).toEqual(['p1', 'h1']);
  });

  it('allocates and consumes power for storage', () => {
    const generator = makeNode({
      id: 'p1',
      type: 'POWER_GENERATOR',
      powerOutput: 35,
      powerTier: 0,
    });
    const storage = makeNode({
      id: 's1',
      type: 'STORAGE',
      powerRequirement: 2,
    });
    const powerEdge = {
      id: 'pow1',
      sourceNodeId: 'p1',
      targetNodeId: 's1',
      connectionType: 'POWER' as const,
      maxTransferRate: 35,
      currentTransferRate: 0,
    };

    const result = evaluateTick(
      new Map([['p1', generator], ['s1', storage]]),
      new Map([['pow1', powerEdge]])
    );

    expect(result.edgeDeltas.get('pow1')?.actualFlowRate).toBe(2);
    expect(result.nodeDeltas.get('s1')?.energyDraw).toBe(2);
    expect(result.globalEnergyBalance.consumption).toBe(2);
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
