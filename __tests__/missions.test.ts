import { getCurrentMission, getUnlockedProgression, INITIAL_UNLOCKS, MISSIONS } from '../src/data/missions';
import { useFactoryStore } from '../src/store/useFactoryStore';
import { TickResult } from '../src/types';

describe('mission progression', () => {
  it('starts with only bootstrap machines and void ore unlocked', () => {
    const unlocked = getUnlockedProgression([]);

    expect(unlocked.nodeTypes).toEqual(INITIAL_UNLOCKS.nodeTypes);
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
