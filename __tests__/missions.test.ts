import { getCurrentMission, getUnlockedProgression, INITIAL_UNLOCKS, MISSIONS } from '../src/data/missions';
import { useFactoryStore } from '../src/store/useFactoryStore';
import { NARRATIVE_BASELINE, RELAY_COMMUNICATIONS, VOID_TYPES } from '../src/data/progression';
import { POWER_TIERS } from '../src/data/power';
import { TickResult } from '../src/types';

describe('mission progression', () => {
  it('starts with only bootstrap machines and void ore unlocked', () => {
    const unlocked = getUnlockedProgression([]);

    expect(unlocked.nodeTypes).toEqual(INITIAL_UNLOCKS.nodeTypes);
    expect(unlocked.nodeTypes).toContain('RELAY');
    expect(unlocked.materialIds).toEqual(['void_ore']);
    expect(unlocked.recipeIds).toEqual([]);
    expect(getCurrentMission([])?.id).toBe('mission_void_ore');
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
    expect(getCurrentMission(['mission_void_ore', 'mission_plasteel'])?.id).toBe('mission_polymer');
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
    expect(MISSIONS.map((mission) => mission.tier)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(MISSIONS.slice(0, 9).every((mission) => mission.relayCommunication)).toBe(true);
    expect(MISSIONS[9].relayCommunication).toBeUndefined();
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
      completedMissionIds: [],
    });
  });

  it('accumulates produced materials from edge flow and completes matching missions', () => {
    const tickResult: TickResult = {
      timestamp: Date.now(),
      nodeDeltas: new Map(),
      edgeDeltas: new Map([
        ['e1', { edgeId: 'e1', actualFlowRate: 10 }],
      ]),
      globalEnergyBalance: { production: 0, consumption: 0 },
    };

    useFactoryStore.getState().applyTickResult(tickResult, 5);

    const state = useFactoryStore.getState();
    expect(state.producedTotals.void_ore).toBe(50);
    expect(state.completedMissionIds).toContain('mission_void_ore');
    expect(state.getUnlockedNodeTypes()).toContain('REFINER');
    expect(state.getUnlockedRecipeIds()).toContain('smelt_plasteel');
  });
});
