import { NodeType, PowerTier } from '../types';
import { ProgressionTier, getRelayCommunicationForTier } from './progression';

export interface MissionRequirement {
  materialId: string;
  quantity: number;
}

export interface MissionUnlocks {
  nodeTypes?: NodeType[];
  materialIds?: string[];
  recipeIds?: string[];
  powerTiers?: PowerTier[];
}

export interface MissionDefinition {
  id: string;
  tier: Exclude<ProgressionTier, 0>;
  title: string;
  objective: string;
  requirement: MissionRequirement;
  unlocks: MissionUnlocks;
  discoversVoidTypeId?: string;
  relayCommunication?: ReturnType<typeof getRelayCommunicationForTier>;
  narrativeBeat: string;
}

export const INITIAL_UNLOCKS: Required<MissionUnlocks> = {
  nodeTypes: ['POWER_GENERATOR', 'HARVESTER', 'SINK', 'STORAGE', 'RELAY'],
  materialIds: ['void_ore'],
  recipeIds: [],
  powerTiers: [1],
};

export const MISSIONS: MissionDefinition[] = [
  {
    id: 'mission_void_ore',
    tier: 1,
    title: 'Bootstrap Extraction',
    objective: 'Route Umbralite-class Void Ore into the grid, then send the extraction proof to Earth through the Relay.',
    requirement: { materialId: 'void_ore', quantity: 50 },
    discoversVoidTypeId: 'nullglass_ore',
    relayCommunication: getRelayCommunicationForTier(1),
    narrativeBeat: 'The first stable seam proves void technology can be harvested outside the solar system. Earth answers with authorization to search for Nullglass Ore.',
    unlocks: {
      nodeTypes: ['REFINER'],
      recipeIds: ['smelt_plasteel'],
      powerTiers: [2],
      materialIds: ['plasteel'],
    },
  },
  {
    id: 'mission_plasteel',
    tier: 2,
    title: 'Nullglass Pressure Hulls',
    objective: 'Smelt enough Plasteel Matrix to reinforce the station for Nullglass survey loads and relay the findings home.',
    requirement: { materialId: 'plasteel', quantity: 40 },
    discoversVoidTypeId: 'vesper_charge',
    relayCommunication: getRelayCommunicationForTier(2),
    narrativeBeat: 'Nullglass refraction exposes an energy-phase signature in the dark around the station: Vesper Charge.',
    unlocks: {
      materialIds: ['hydrocarbon', 'polymer_sheet'],
      recipeIds: ['refine_polymer'],
      powerTiers: [3],
    },
  },
  {
    id: 'mission_polymer',
    tier: 3,
    title: 'Vesper Insulation',
    objective: 'Produce Polymer Sheets for insulated circuitry capable of surviving Vesper Charge tests.',
    requirement: { materialId: 'polymer_sheet', quantity: 60 },
    discoversVoidTypeId: 'ecliptic_brine',
    relayCommunication: getRelayCommunicationForTier(3),
    narrativeBeat: 'The first directed void current condenses a black fluid along the test rig: Ecliptic Brine.',
    unlocks: {
      nodeTypes: ['ASSEMBLER'],
      recipeIds: ['assemble_logic_substrate'],
      materialIds: ['logic_substrate'],
      powerTiers: [4],
    },
  },
  {
    id: 'mission_logic',
    tier: 4,
    title: 'Ecliptic Logic Backbone',
    objective: 'Assemble Logic Substrates to model Ecliptic Brine behavior and prepare reactive alloys.',
    requirement: { materialId: 'logic_substrate', quantity: 30 },
    discoversVoidTypeId: 'paradoxite_ore',
    relayCommunication: getRelayCommunicationForTier(4),
    narrativeBeat: 'Brine simulations split into contradictory but valid outputs, pointing Earth toward Paradoxite Ore.',
    unlocks: {
      materialIds: ['catalyst', 'charged_alloy'],
      recipeIds: ['forge_charged_alloy'],
      powerTiers: [5],
    },
  },
  {
    id: 'mission_alloy',
    tier: 5,
    title: 'Paradox Metallurgy',
    objective: 'Forge Charged Alloy for high-density compute tooling that can survive Paradoxite branching.',
    requirement: { materialId: 'charged_alloy', quantity: 30 },
    discoversVoidTypeId: 'horizon_shard',
    relayCommunication: getRelayCommunicationForTier(5),
    narrativeBeat: 'Paradoxite lattice failures expose a harder boundary material: Horizon Shard.',
    unlocks: {
      materialIds: ['plasma', 'quantum_cpu'],
      recipeIds: ['synthesize_quantum_cpu'],
      powerTiers: [6],
    },
  },
  {
    id: 'mission_quantum_cpu',
    tier: 6,
    title: 'Horizon Control Plane',
    objective: 'Fabricate Quantum CPUs to stabilize Horizon Shard extraction and parse the next void band.',
    requirement: { materialId: 'quantum_cpu', quantity: 15 },
    discoversVoidTypeId: 'aurora_null',
    relayCommunication: getRelayCommunicationForTier(6),
    narrativeBeat: 'Horizon Shard containment reveals a silent energy ribbon that Earth designates Aurora Null.',
    unlocks: {
      materialIds: ['raw_exotic', 'chronal_fluid'],
      recipeIds: ['extract_chronal_fluid'],
      nodeTypes: ['FEEDBACK_REGULATOR'],
      powerTiers: [7],
    },
  },
  {
    id: 'mission_chronal',
    tier: 7,
    title: 'Aurora Coolant Loop',
    objective: 'Extract Chronal Fluid before attempting to cool Aurora Null containment drift.',
    requirement: { materialId: 'chronal_fluid', quantity: 20 },
    discoversVoidTypeId: 'chronosilt',
    relayCommunication: getRelayCommunicationForTier(7),
    narrativeBeat: 'Aurora Null forces coolant to arrive before it is pumped, confirming Chronosilt as a fluid void type.',
    unlocks: {
      recipeIds: ['forge_tachyon_core'],
      materialIds: ['tachyon_core', 'probability_ore', 'flux_filament'],
      powerTiers: [8],
    },
  },
  {
    id: 'mission_tachyon',
    tier: 8,
    title: 'Chronosilt Containment Cores',
    objective: 'Forge Tachyon Cores and prepare probabilistic filament processing around Chronosilt flow.',
    requirement: { materialId: 'tachyon_core', quantity: 10 },
    discoversVoidTypeId: 'apex_echo',
    relayCommunication: getRelayCommunicationForTier(8),
    narrativeBeat: 'Chronosilt containment resonates with a repeating singularity wake: Apex Echo.',
    unlocks: {
      recipeIds: ['process_flux_filament'],
      powerTiers: [9],
    },
  },
  {
    id: 'mission_flux',
    tier: 9,
    title: 'Apex Flux Weaving',
    objective: 'Process Flux Filament for singularity drive construction and relay Apex Echo proof to Earth.',
    requirement: { materialId: 'flux_filament', quantity: 25 },
    discoversVoidTypeId: 'genesis_cinder',
    relayCommunication: getRelayCommunicationForTier(9),
    narrativeBeat: 'Apex Echo resolves into the final known material signature: Genesis Cinder.',
    unlocks: {
      recipeIds: ['build_singularity_driver'],
      materialIds: ['singularity_driver'],
      powerTiers: [10],
    },
  },
  {
    id: 'mission_singularity',
    tier: 10,
    title: 'Genesis Driver',
    objective: 'Build the first Singularity Driver with Genesis Cinder-class tooling and complete the current progression arc.',
    requirement: { materialId: 'singularity_driver', quantity: 5 },
    narrativeBeat: 'Humanity now has a tool that can reshape the void rather than merely survive it.',
    unlocks: {},
  },
];

export function getCurrentMission(completedMissionIds: string[]): MissionDefinition | null {
  const completed = new Set(completedMissionIds);
  return MISSIONS.find((mission) => !completed.has(mission.id)) ?? null;
}

export function getUnlockedProgression(completedMissionIds: string[]): Required<MissionUnlocks> {
  const unlocked: Required<MissionUnlocks> = {
    nodeTypes: [...INITIAL_UNLOCKS.nodeTypes],
    materialIds: [...INITIAL_UNLOCKS.materialIds],
    recipeIds: [...INITIAL_UNLOCKS.recipeIds],
    powerTiers: [...INITIAL_UNLOCKS.powerTiers],
  };

  const addUnique = <T>(target: T[], values: T[] | undefined) => {
    for (const value of values ?? []) {
      if (!target.includes(value)) {
        target.push(value);
      }
    }
  };

  const completed = new Set(completedMissionIds);
  for (const mission of MISSIONS) {
    if (!completed.has(mission.id)) {
      continue;
    }

    addUnique(unlocked.nodeTypes, mission.unlocks.nodeTypes);
    addUnique(unlocked.materialIds, mission.unlocks.materialIds);
    addUnique(unlocked.recipeIds, mission.unlocks.recipeIds);
    addUnique(unlocked.powerTiers, mission.unlocks.powerTiers);
  }

  return unlocked;
}
