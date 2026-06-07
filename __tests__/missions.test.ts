import { getCurrentMission, getMissionStepStatuses, getUnlockedProgression, INITIAL_UNLOCKS, MISSIONS } from '../src/data/missions';
import { useFactoryStore } from '../src/store/useFactoryStore';
import { NARRATIVE_BASELINE, RELAY_COMMUNICATIONS, VOID_TYPES } from '../src/data/progression';
import { POWER_TIERS } from '../src/data/power';
import { FactoryNode, TickResult } from '../src/types';
import { getUnlockedHarvesterTiers } from '../src/data/harvesters';

describe('mission progression', () => {
  it('starts with only bootstrap machines and void ore unlocked', () => {
    const unlocked = getUnlockedProgression([]);

    expect(unlocked.nodeTypes).toEqual(INITIAL_UNLOCKS.nodeTypes);
    expect(unlocked.nodeTypes).toContain('RELAY');
    expect(unlocked.materialIds).toEqual(['void_ore']);
    expect(unlocked.recipeIds).toEqual([]);
    expect(getCurrentMission([])?.id).toBe('mission_into_the_void');
  });

  it('unlocks more complex machines and recipes as missions complete', () => {
    const unlocked = getUnlockedProgression([
      'mission_void_ore',
      'mission_plasteel',
      'mission_polymer',
    ]);

    expect(unlocked.nodeTypes).toContain('REFINER');
    expect(unlocked.nodeTypes).toContain('ASSEMBLER');
    expect(unlocked.recipeIds).toContain('smelt_plasteel');
    expect(unlocked.recipeIds).toContain('refine_polymer');
    expect(unlocked.recipeIds).toContain('assemble_logic_substrate');
    expect(unlocked.materialIds).toContain('logic_substrate');
    expect(getCurrentMission(['mission_into_the_void', 'mission_void_ore', 'mission_plasteel'])?.id).toBe('mission_polymer');
  });

  it('defines the 2350 void-tech narrative and ten tiered void types', () => {
    expect(NARRATIVE_BASELINE).toContain('twenty three fifty');
    expect(VOID_TYPES).toHaveLength(10);
    expect(VOID_TYPES.map((voidType) => voidType.tier)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(VOID_TYPES.map((voidType) => voidType.baseType)).toEqual([
      'ORE',
      'ORE',
      'ENERGY',
      'FLUID',
      'ORE',
      'ORE',
      'ENERGY',
      'FLUID',
      'ENERGY',
      'ORE',
    ]);
  });

  it('scales relay communication windows from seconds to days', () => {
    expect(RELAY_COMMUNICATIONS).toHaveLength(9);
    expect(RELAY_COMMUNICATIONS[0]).toMatchObject({ fromTier: 1, toTier: 2, durationSeconds: 45 });
    expect(RELAY_COMMUNICATIONS[RELAY_COMMUNICATIONS.length - 1]).toMatchObject({ fromTier: 9, toTier: 10, durationSeconds: 259200 });
    expect(RELAY_COMMUNICATIONS.map((communication) => communication.durationSeconds)).toEqual(
      [...RELAY_COMMUNICATIONS]
        .map((communication) => communication.durationSeconds)
        .sort((a, b) => a - b)
    );
  });

  it('attaches relay discovery metadata to each culminating tier mission before tier 10', () => {
    expect(MISSIONS.map((mission) => mission.tier)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(MISSIONS.slice(1, 10).every((mission) => mission.relayCommunication)).toBe(true);
    expect(MISSIONS[10].relayCommunication).toBeUndefined();
  });

  it('ties power generators to their unlock tiers and void discoveries', () => {
    expect(POWER_TIERS.map((powerTier) => powerTier.tier)).toEqual([0, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(POWER_TIERS.map((powerTier) => powerTier.unlockedInTier)).toEqual([0, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(getUnlockedProgression([]).powerTiers).toEqual([0]);
    expect(getUnlockedProgression(['mission_void_ore']).powerTiers).toEqual([0, 2]);
    expect(POWER_TIERS.find((powerTier) => powerTier.tier === 2)?.name).toContain('Field Dynamo');
    expect(POWER_TIERS.find((powerTier) => powerTier.tier === 3)).toMatchObject({
      name: 'Vesper Charge Tap',
      voidTypeId: 'vesper_charge',
    });
    expect(POWER_TIERS.find((powerTier) => powerTier.tier === 4)).toMatchObject({
      name: 'Brine-Cooled Vesper Tap',
      voidTypeId: 'ecliptic_brine',
    });
  });

  it('unlocks harvester variants at onboarding, tier 5, and tier 10', () => {
    expect(getUnlockedHarvesterTiers([])).toEqual([0]);
    expect(getUnlockedHarvesterTiers(['mission_logic'])).toEqual([0, 5]);
    expect(getUnlockedHarvesterTiers(['mission_logic', 'mission_flux'])).toEqual([0, 5, 10]);
  });

  it('returns null current mission after the full mission chain is completed', () => {
    expect(getCurrentMission(MISSIONS.map((mission) => mission.id))).toBeNull();
  });
});


describe('mission store integration', () => {
  beforeEach(() => {
    useFactoryStore.setState({
      nodes: {},
      edges: {
        e1: {
          id: 'e1',
          sourceNodeId: 'h1',
          targetNodeId: 's1',
          connectionType: 'RESOURCE',
          materialId: 'void_ore',
          maxCapacityRate: 10,
          currentFlowRate: 0,
        },
      },
      producedTotals: {},
      completedMissionIds: ['mission_into_the_void'],
      onboardingAcknowledged: true,
    });
  });

  it('accumulates actual production and completes matching missions', () => {
    const tickResult: TickResult = {
      timestamp: Date.now(),
      nodeDeltas: new Map(),
      edgeDeltas: new Map([
        ['e1', { edgeId: 'e1', actualFlowRate: 10 }],
      ]),
      productionRatesByNode: new Map([['producer', { void_ore: 10 }]]),
      globalEnergyBalance: { production: 0, consumption: 0 },
    };

    useFactoryStore.getState().applyTickResult(tickResult, 25);

    const state = useFactoryStore.getState();
    expect(state.producedTotals.void_ore).toBe(250);
    expect(state.completedMissionIds).toContain('mission_void_ore');
    expect(state.getUnlockedNodeTypes()).toContain('REFINER');
    expect(state.getUnlockedRecipeIds()).toContain('smelt_plasteel');
  });

  it('stores harvester output internally up to 10 units before transport drains it', () => {
    const harvester: FactoryNode = {
      id: 'h1',
      name: 'Void Harvester',
      type: 'HARVESTER',
      gridX: 0,
      gridY: 0,
      x: 0,
      y: 0,
      inputBuffers: {},
      outputBuffers: { void_ore: { current: 0, max: 10 } },
      powerRequirement: 0,
      powerOutput: 0,
      harvesterTier: 0,
      efficiencyRating: 1,
      isOperational: true,
      cosmeticSkinId: null,
      stallTicksAccumulated: 0,
      operationalStatus: 'OPERATIONAL',
    };
    const storage: FactoryNode = {
      ...harvester,
      id: 's1',
      name: 'Storage',
      type: 'STORAGE',
      inputBuffers: {},
      outputBuffers: {},
      powerRequirement: 2,
      harvesterTier: undefined,
    };

    useFactoryStore.setState({
      nodes: { h1: harvester, s1: storage },
      edges: {},
      producedTotals: {},
      completedMissionIds: ['mission_into_the_void'],
    });

    const fillResult: TickResult = {
      timestamp: Date.now(),
      nodeDeltas: new Map([
        ['h1', { nodeId: 'h1', calculatedEfficiency: 1, operationalStatus: 'OPERATIONAL', energyDraw: 0 }],
      ]),
      edgeDeltas: new Map(),
      productionRatesByNode: new Map([['h1', { void_ore: 10 }]]),
      globalEnergyBalance: { production: 0, consumption: 0 },
    };

    useFactoryStore.getState().applyTickResult(fillResult, 2);
    expect(useFactoryStore.getState().nodes.h1.outputBuffers.void_ore).toEqual({ current: 10, max: 10 });

    useFactoryStore.setState({
      edges: {
        e1: {
          id: 'e1',
          sourceNodeId: 'h1',
          targetNodeId: 's1',
          connectionType: 'RESOURCE',
          materialId: 'void_ore',
          maxCapacityRate: 10,
          currentFlowRate: 0,
        },
      },
    });

    const drainResult: TickResult = {
      timestamp: Date.now(),
      nodeDeltas: new Map(),
      edgeDeltas: new Map([
        ['e1', { edgeId: 'e1', actualFlowRate: 4 }],
      ]),
      productionRatesByNode: new Map(),
      globalEnergyBalance: { production: 0, consumption: 0 },
    };

    useFactoryStore.getState().applyTickResult(drainResult, 1);
    expect(useFactoryStore.getState().nodes.h1.outputBuffers.void_ore).toEqual({ current: 6, max: 10 });
    expect(useFactoryStore.getState().nodes.s1.inputBuffers.void_ore).toEqual({ current: 4, max: 1000 });
    expect(useFactoryStore.getState().producedTotals.void_ore).toBe(10);
  });

  it('normalizes storage power requirements when storage is added', () => {
    const storage: FactoryNode = {
      id: 's1',
      name: 'Storage',
      type: 'STORAGE',
      gridX: 0,
      gridY: 0,
      inputBuffers: {},
      outputBuffers: { void_ore: { current: 50, max: 100 } },
      productionRecipe: {
        inputs: [],
        outputs: [{ materialId: 'void_ore', ratePerSecond: 10 }],
        energyCost: 0,
      },
      powerRequirement: 0,
      powerOutput: 0,
      efficiencyRating: 1,
      isOperational: true,
      cosmeticSkinId: null,
      stallTicksAccumulated: 0,
      operationalStatus: 'OPERATIONAL',
    };

    useFactoryStore.getState().addNode(storage);

    expect(useFactoryStore.getState().nodes.s1).toMatchObject({
      inputBuffers: {},
      outputBuffers: {},
      powerRequirement: 2,
      productionRecipe: undefined,
    });
  });

  it('moves an existing structure without creating another node', () => {
    const harvester: FactoryNode = {
      id: 'h1',
      name: 'Void Harvester',
      type: 'HARVESTER',
      gridX: 0,
      gridY: 0,
      x: 0,
      y: 0,
      inputBuffers: {},
      outputBuffers: { void_ore: { current: 0, max: 10 } },
      powerRequirement: 0,
      powerOutput: 0,
      harvesterTier: 0,
      efficiencyRating: 1,
      isOperational: true,
      cosmeticSkinId: null,
      stallTicksAccumulated: 0,
      operationalStatus: 'OPERATIONAL',
    };

    useFactoryStore.setState({
      nodes: { h1: harvester },
      stats: {
        playSessions: 1,
        totalNodesBuilt: 1,
        totalConnectionsMade: 0,
        totalResourceMoved: 0,
        totalEnergyGenerated: 0,
        totalEnergyConsumed: 0,
        totalRuntimeSeconds: 0,
        peakNetEnergy: 0,
      },
    });

    useFactoryStore.getState().moveNode('h1', 240, 160);

    const state = useFactoryStore.getState();
    expect(Object.keys(state.nodes)).toEqual(['h1']);
    expect(state.nodes.h1).toMatchObject({
      gridX: 3,
      gridY: 2,
      x: 240,
      y: 160,
    });
    expect(state.stats.totalNodesBuilt).toBe(1);
  });

  it('normalizes legacy grid-only structures to explicit world coordinates', () => {
    const harvester: FactoryNode = {
      id: 'h1',
      name: 'Void Harvester',
      type: 'HARVESTER',
      gridX: 2,
      gridY: 3,
      inputBuffers: {},
      outputBuffers: { void_ore: { current: 0, max: 10 } },
      powerRequirement: 0,
      powerOutput: 0,
      harvesterTier: 0,
      efficiencyRating: 1,
      isOperational: true,
      cosmeticSkinId: null,
      stallTicksAccumulated: 0,
      operationalStatus: 'OPERATIONAL',
    };

    useFactoryStore.getState().addNode(harvester);

    expect(useFactoryStore.getState().nodes.h1).toMatchObject({
      x: 168,
      y: 248,
    });
  });

  it('stores items in 100-unit stacks and stops accepting items after 10 stacks', () => {
    const storage: FactoryNode = {
      id: 's1',
      name: 'Storage',
      type: 'STORAGE',
      gridX: 0,
      gridY: 0,
      inputBuffers: {
        void_ore: { current: 950, max: 1000 },
      },
      outputBuffers: {},
      powerRequirement: 0,
      powerOutput: 0,
      efficiencyRating: 1,
      isOperational: true,
      cosmeticSkinId: null,
      stallTicksAccumulated: 0,
      operationalStatus: 'OPERATIONAL',
    };
    const source: FactoryNode = {
      ...storage,
      id: 'h1',
      type: 'HARVESTER',
      inputBuffers: {},
      outputBuffers: { hydrocarbon: { current: 100, max: 100 } },
    };

    useFactoryStore.setState({
      nodes: { h1: source, s1: storage },
      edges: {
        e1: {
          id: 'e1',
          sourceNodeId: 'h1',
          targetNodeId: 's1',
          connectionType: 'RESOURCE',
          materialId: 'hydrocarbon',
          maxCapacityRate: 100,
          currentFlowRate: 0,
        },
      },
    });

    useFactoryStore.getState().applyTickResult({
      timestamp: Date.now(),
      nodeDeltas: new Map(),
      edgeDeltas: new Map([['e1', { edgeId: 'e1', actualFlowRate: 100 }]]),
      productionRatesByNode: new Map(),
      globalEnergyBalance: { production: 0, consumption: 0 },
    }, 1);

    expect(useFactoryStore.getState().nodes.s1.inputBuffers).toEqual({
      void_ore: { current: 950, max: 1000 },
    });
    expect(useFactoryStore.getState().nodes.h1.outputBuffers.hydrocarbon.current).toBe(100);
    expect(useFactoryStore.getState().edges.e1).toMatchObject({ currentFlowRate: 0 });
  });

  it('fills the remaining space in an existing storage stack', () => {
    const storage: FactoryNode = {
      id: 's1',
      name: 'Storage',
      type: 'STORAGE',
      gridX: 0,
      gridY: 0,
      inputBuffers: { void_ore: { current: 950, max: 1000 } },
      outputBuffers: {},
      powerRequirement: 0,
      powerOutput: 0,
      efficiencyRating: 1,
      isOperational: true,
      cosmeticSkinId: null,
      stallTicksAccumulated: 0,
      operationalStatus: 'OPERATIONAL',
    };
    const source: FactoryNode = {
      ...storage,
      id: 'h1',
      type: 'HARVESTER',
      inputBuffers: {},
      outputBuffers: { void_ore: { current: 100, max: 100 } },
    };

    useFactoryStore.setState({
      nodes: { h1: source, s1: storage },
      edges: {
        e1: {
          id: 'e1',
          sourceNodeId: 'h1',
          targetNodeId: 's1',
          connectionType: 'RESOURCE',
          materialId: 'void_ore',
          maxCapacityRate: 100,
          currentFlowRate: 0,
        },
      },
    });

    useFactoryStore.getState().applyTickResult({
      timestamp: Date.now(),
      nodeDeltas: new Map(),
      edgeDeltas: new Map([['e1', { edgeId: 'e1', actualFlowRate: 100 }]]),
      productionRatesByNode: new Map(),
      globalEnergyBalance: { production: 0, consumption: 0 },
    }, 1);

    expect(useFactoryStore.getState().nodes.s1.inputBuffers.void_ore.current).toBe(1000);
    expect(useFactoryStore.getState().nodes.h1.outputBuffers.void_ore.current).toBe(50);
    expect(useFactoryStore.getState().edges.e1).toMatchObject({ currentFlowRate: 50 });
  });

  it('allows bootstrap tier 0 power generators to be built', () => {
    const generator: FactoryNode = {
      id: 'pwr_0',
      name: 'Bootstrap Generator',
      type: 'POWER_GENERATOR',
      gridX: 0,
      gridY: 0,
      x: 0,
      y: 0,
      inputBuffers: {},
      outputBuffers: {},
      powerRequirement: 0,
      powerOutput: 25,
      powerTier: 0,
      efficiencyRating: 1,
      isOperational: true,
      cosmeticSkinId: null,
      stallTicksAccumulated: 0,
      operationalStatus: 'OPERATIONAL',
    };

    useFactoryStore.getState().addNode(generator);

    expect(useFactoryStore.getState().nodes.pwr_0).toEqual(generator);
  });

  it('rejects resource transport lines that originate from power generators', () => {
    const generator: FactoryNode = {
      id: 'pwr_0',
      name: 'Bootstrap Generator',
      type: 'POWER_GENERATOR',
      gridX: 0,
      gridY: 0,
      x: 0,
      y: 0,
      inputBuffers: {},
      outputBuffers: {},
      powerRequirement: 0,
      powerOutput: 25,
      powerTier: 0,
      efficiencyRating: 1,
      isOperational: true,
      cosmeticSkinId: null,
      stallTicksAccumulated: 0,
      operationalStatus: 'OPERATIONAL',
    };
    const storage: FactoryNode = {
      ...generator,
      id: 's1',
      name: 'Storage',
      type: 'STORAGE',
      powerOutput: 0,
      powerTier: undefined,
      powerRequirement: 0,
    };

    useFactoryStore.setState({
      nodes: { pwr_0: generator, s1: storage },
      edges: {},
      completedMissionIds: ['mission_into_the_void'],
    });

    const result = useFactoryStore.getState().connectNodes('pwr_0', 's1', 10);

    expect(result).toEqual({ success: false, error: 'Power generators can only supply power lines' });
    expect(useFactoryStore.getState().edges).toEqual({});
  });

  it('derives transport material from the sending structure recipe', () => {
    const producer: FactoryNode = {
      id: 'r1',
      name: 'Plasteel Refinery',
      type: 'REFINER',
      gridX: 0,
      gridY: 0,
      inputBuffers: {},
      outputBuffers: {},
      productionRecipe: {
        inputs: [{ materialId: 'void_ore', ratePerSecond: 5 }],
        outputs: [{ materialId: 'plasteel', ratePerSecond: 3 }],
        energyCost: 8,
      },
      powerRequirement: 8,
      powerOutput: 0,
      efficiencyRating: 1,
      isOperational: true,
      cosmeticSkinId: null,
      stallTicksAccumulated: 0,
      operationalStatus: 'OPERATIONAL',
    };
    const storage: FactoryNode = {
      ...producer,
      id: 's1',
      name: 'Storage',
      type: 'STORAGE',
      productionRecipe: undefined,
      powerRequirement: 0,
    };

    useFactoryStore.setState({
      nodes: { r1: producer, s1: storage },
      edges: {},
      completedMissionIds: ['mission_into_the_void', 'mission_void_ore'],
    });

    const result = useFactoryStore.getState().connectNodes('r1', 's1', 10);
    const edge = Object.values(useFactoryStore.getState().edges)[0];

    expect(result).toEqual({ success: true });
    expect(edge).toMatchObject({
      sourceNodeId: 'r1',
      targetNodeId: 's1',
      connectionType: 'RESOURCE',
      materialId: 'plasteel',
    });
  });

  it('uses line origin to make storage send its received material', () => {
    const storage: FactoryNode = {
      id: 's1',
      name: 'Storage',
      type: 'STORAGE',
      gridX: 0,
      gridY: 0,
      inputBuffers: {},
      outputBuffers: {},
      powerRequirement: 0,
      powerOutput: 0,
      efficiencyRating: 1,
      isOperational: true,
      cosmeticSkinId: null,
      stallTicksAccumulated: 0,
      operationalStatus: 'OPERATIONAL',
    };
    const sink: FactoryNode = {
      ...storage,
      id: 'sink1',
      name: 'Sink',
      type: 'SINK',
    };

    useFactoryStore.setState({
      nodes: { s1: storage, sink1: sink },
      edges: {
        input: {
          id: 'input',
          sourceNodeId: 'h1',
          targetNodeId: 's1',
          connectionType: 'RESOURCE',
          materialId: 'void_ore',
          maxCapacityRate: 10,
          currentFlowRate: 0,
        },
      },
      completedMissionIds: ['mission_into_the_void'],
    });

    const result = useFactoryStore.getState().connectNodes('s1', 'sink1', 10);
    const output = Object.values(useFactoryStore.getState().edges)
      .find((edge) => edge.sourceNodeId === 's1');

    expect(result).toEqual({ success: true });
    expect(output).toMatchObject({
      sourceNodeId: 's1',
      targetNodeId: 'sink1',
      materialId: 'void_ore',
    });
  });

  it('removes items sent from storage inventory', () => {
    const storage: FactoryNode = {
      id: 's1',
      name: 'Storage',
      type: 'STORAGE',
      gridX: 0,
      gridY: 0,
      inputBuffers: { void_ore: { current: 25, max: 1000 } },
      outputBuffers: {},
      powerRequirement: 0,
      powerOutput: 0,
      efficiencyRating: 1,
      isOperational: true,
      cosmeticSkinId: null,
      stallTicksAccumulated: 0,
      operationalStatus: 'OPERATIONAL',
    };

    useFactoryStore.setState({
      nodes: { s1: storage },
      edges: {
        output: {
          id: 'output',
          sourceNodeId: 's1',
          targetNodeId: 'sink1',
          connectionType: 'RESOURCE',
          materialId: 'void_ore',
          maxCapacityRate: 10,
          currentFlowRate: 0,
        },
      },
    });

    useFactoryStore.getState().applyTickResult({
      timestamp: Date.now(),
      nodeDeltas: new Map(),
      edgeDeltas: new Map([['output', { edgeId: 'output', actualFlowRate: 10 }]]),
      productionRatesByNode: new Map(),
      globalEnergyBalance: { production: 0, consumption: 0 },
    }, 1);

    expect(useFactoryStore.getState().nodes.s1.inputBuffers.void_ore.current).toBe(15);
  });

  it('does not send more items than storage currently holds', () => {
    const storage: FactoryNode = {
      id: 's1',
      name: 'Storage',
      type: 'STORAGE',
      gridX: 0,
      gridY: 0,
      inputBuffers: { void_ore: { current: 4, max: 1000 } },
      outputBuffers: {},
      powerRequirement: 0,
      powerOutput: 0,
      efficiencyRating: 1,
      isOperational: true,
      cosmeticSkinId: null,
      stallTicksAccumulated: 0,
      operationalStatus: 'OPERATIONAL',
    };

    useFactoryStore.setState({
      nodes: { s1: storage },
      edges: {
        output: {
          id: 'output',
          sourceNodeId: 's1',
          targetNodeId: 'sink1',
          connectionType: 'RESOURCE',
          materialId: 'void_ore',
          maxCapacityRate: 10,
          currentFlowRate: 0,
        },
      },
    });

    useFactoryStore.getState().applyTickResult({
      timestamp: Date.now(),
      nodeDeltas: new Map(),
      edgeDeltas: new Map([['output', { edgeId: 'output', actualFlowRate: 10 }]]),
      productionRatesByNode: new Map(),
      globalEnergyBalance: { production: 0, consumption: 0 },
    }, 1);

    expect(useFactoryStore.getState().nodes.s1.inputBuffers.void_ore.current).toBe(0);
    expect(useFactoryStore.getState().edges.output).toMatchObject({ currentFlowRate: 4 });
  });

  it('updates outgoing transport material when the sending recipe changes', () => {
    const producer: FactoryNode = {
      id: 'r1',
      name: 'Refinery',
      type: 'REFINER',
      gridX: 0,
      gridY: 0,
      inputBuffers: {},
      outputBuffers: {},
      productionRecipe: {
        inputs: [{ materialId: 'void_ore', ratePerSecond: 5 }],
        outputs: [{ materialId: 'plasteel', ratePerSecond: 3 }],
        energyCost: 8,
      },
      powerRequirement: 8,
      powerOutput: 0,
      efficiencyRating: 1,
      isOperational: true,
      cosmeticSkinId: null,
      stallTicksAccumulated: 0,
      operationalStatus: 'OPERATIONAL',
    };

    useFactoryStore.setState({
      nodes: { r1: producer },
      edges: {
        e1: {
          id: 'e1',
          sourceNodeId: 'r1',
          targetNodeId: 's1',
          connectionType: 'RESOURCE',
          materialId: 'plasteel',
          maxCapacityRate: 10,
          currentFlowRate: 0,
        },
      },
    });

    useFactoryStore.getState().setNodeRecipe('r1', {
      inputs: [{ materialId: 'hydrocarbon', ratePerSecond: 4 }],
      outputs: [{ materialId: 'polymer_sheet', ratePerSecond: 4 }],
      energyCost: 6,
    });

    expect(useFactoryStore.getState().edges.e1).toMatchObject({ materialId: 'polymer_sheet' });
  });

  it('gates Into the Void through power, harvesting, connection, and stored material', () => {
    const mission = MISSIONS.find((item) => item.id === 'mission_into_the_void');
    expect(mission).toBeDefined();
    if (!mission) return;

    const powerNode: FactoryNode = {
      id: 'pwr_intro',
      name: 'Bootstrap Generator',
      type: 'POWER_GENERATOR',
      gridX: 0,
      gridY: 0,
      x: 0,
      y: 0,
      inputBuffers: {},
      outputBuffers: {},
      powerRequirement: 0,
      powerOutput: 25,
      powerTier: 0,
      efficiencyRating: 1,
      isOperational: true,
      cosmeticSkinId: null,
      stallTicksAccumulated: 0,
      operationalStatus: 'OPERATIONAL',
    };
    const harvesterNode: FactoryNode = {
      ...powerNode,
      id: 'har_intro',
      name: 'Void Harvester',
      type: 'HARVESTER',
      powerOutput: 0,
      powerTier: undefined,
      powerRequirement: 5,
      outputBuffers: { void_ore: { current: 10, max: 10 } },
    };
    const storageNode: FactoryNode = {
      ...powerNode,
      id: 'sto_intro',
      name: 'Storage',
      type: 'STORAGE',
      powerOutput: 0,
      powerTier: undefined,
      powerRequirement: 2,
      inputBuffers: { void_ore: { current: 100, max: 1000 } },
    };
    const powerEdge = {
      id: 'power_intro',
      sourceNodeId: powerNode.id,
      targetNodeId: harvesterNode.id,
      connectionType: 'POWER' as const,
      maxTransferRate: 25,
      currentTransferRate: 5,
    };

    let statuses = getMissionStepStatuses(mission, { nodes: {}, producedTotals: {} });
    expect(statuses.map((status) => status.isComplete)).toEqual([false, false, false, false]);

    statuses = getMissionStepStatuses(mission, { nodes: { pwr_intro: powerNode }, producedTotals: {} });
    expect(statuses.map((status) => status.isComplete)).toEqual([true, false, false, false]);

    statuses = getMissionStepStatuses(mission, {
      nodes: { pwr_intro: powerNode, har_intro: harvesterNode },
      producedTotals: {},
    });
    expect(statuses.map((status) => status.isComplete)).toEqual([true, true, false, false]);

    statuses = getMissionStepStatuses(mission, {
      nodes: { pwr_intro: powerNode, har_intro: harvesterNode },
      edges: { power_intro: powerEdge },
      producedTotals: {},
    });
    expect(statuses.map((status) => status.isComplete)).toEqual([true, true, true, false]);

    statuses = getMissionStepStatuses(mission, {
      nodes: { pwr_intro: powerNode, har_intro: harvesterNode, sto_intro: storageNode },
      edges: { power_intro: powerEdge },
      producedTotals: { void_ore: 100 },
    });
    expect(statuses.map((status) => status.isComplete)).toEqual([true, true, true, true]);
    expect(statuses[3].current).toBe(100);
  });

  it('holds onboarding completion until the final transmission is acknowledged', () => {
    const mission = MISSIONS.find((item) => item.id === 'mission_into_the_void');
    expect(mission).toBeDefined();
    if (!mission) return;

    const generator: FactoryNode = {
      id: 'p1',
      name: 'Bootstrap Generator',
      type: 'POWER_GENERATOR',
      gridX: 0,
      gridY: 0,
      inputBuffers: {},
      outputBuffers: {},
      powerRequirement: 0,
      powerOutput: 25,
      powerTier: 0,
      efficiencyRating: 1,
      isOperational: true,
      cosmeticSkinId: null,
      stallTicksAccumulated: 0,
      operationalStatus: 'OPERATIONAL',
    };
    const harvester = {
      ...generator,
      id: 'h1',
      type: 'HARVESTER' as const,
      powerOutput: 0,
      powerTier: undefined,
      powerRequirement: 5,
    };
    const storage = {
      ...generator,
      id: 's1',
      type: 'STORAGE' as const,
      powerOutput: 0,
      powerTier: undefined,
      inputBuffers: { void_ore: { current: 100, max: 1000 } },
    };

    useFactoryStore.setState({
      nodes: { p1: generator, h1: harvester, s1: storage },
      edges: {
        power_1: {
          id: 'power_1',
          sourceNodeId: 'p1',
          targetNodeId: 'h1',
          connectionType: 'POWER',
          maxTransferRate: 25,
          currentTransferRate: 5,
        },
      },
      producedTotals: { void_ore: 100 },
      completedMissionIds: [],
      onboardingAcknowledged: false,
    });

    expect(getCurrentMission(useFactoryStore.getState().completedMissionIds)?.id).toBe(mission.id);
    useFactoryStore.getState().acknowledgeOnboarding();
    expect(useFactoryStore.getState().completedMissionIds).toEqual(['mission_into_the_void']);
    expect(getCurrentMission(useFactoryStore.getState().completedMissionIds)?.id).toBe('mission_void_ore');
  });
});
