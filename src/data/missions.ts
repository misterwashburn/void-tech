import { NodeType } from '../types';

export interface MissionRequirement {
  materialId: string;
  quantity: number;
}

export interface MissionUnlocks {
  nodeTypes?: NodeType[];
  materialIds?: string[];
  recipeIds?: string[];
}

export interface MissionDefinition {
  id: string;
  title: string;
  objective: string;
  requirement: MissionRequirement;
  unlocks: MissionUnlocks;
}

export const INITIAL_UNLOCKS: Required<MissionUnlocks> = {
  nodeTypes: ['HARVESTER', 'SINK', 'STORAGE'],
  materialIds: ['void_ore'],
  recipeIds: [],
};

export const MISSIONS: MissionDefinition[] = [
  {
    id: 'mission_void_ore',
    title: 'Bootstrap Extraction',
    objective: 'Route Void Ore into the grid to prove the site can sustain basic throughput.',
    requirement: { materialId: 'void_ore', quantity: 50 },
    unlocks: {
      nodeTypes: ['REFINER'],
      recipeIds: ['smelt_plasteel'],
      materialIds: ['plasteel'],
    },
  },
  {
    id: 'mission_plasteel',
    title: 'Pressure Hull Stockpile',
    objective: 'Smelt enough Plasteel Matrix to reinforce the first expansion frame.',
    requirement: { materialId: 'plasteel', quantity: 40 },
    unlocks: {
      materialIds: ['hydrocarbon', 'polymer_sheet'],
      recipeIds: ['refine_polymer'],
    },
  },
  {
    id: 'mission_polymer',
    title: 'Flexible Substrates',
    objective: 'Produce Polymer Sheets for insulated circuitry and machine housings.',
    requirement: { materialId: 'polymer_sheet', quantity: 60 },
    unlocks: {
      nodeTypes: ['ASSEMBLER'],
      recipeIds: ['assemble_logic_substrate'],
      materialIds: ['logic_substrate'],
    },
  },
  {
    id: 'mission_logic',
    title: 'Logic Backbone',
    objective: 'Assemble Logic Substrates to unlock reactive alloys.',
    requirement: { materialId: 'logic_substrate', quantity: 30 },
    unlocks: {
      materialIds: ['catalyst', 'charged_alloy'],
      recipeIds: ['forge_charged_alloy'],
    },
  },
  {
    id: 'mission_alloy',
    title: 'Charged Metallurgy',
    objective: 'Forge Charged Alloy for high-density compute tooling.',
    requirement: { materialId: 'charged_alloy', quantity: 30 },
    unlocks: {
      materialIds: ['plasma', 'quantum_cpu'],
      recipeIds: ['synthesize_quantum_cpu'],
    },
  },
  {
    id: 'mission_quantum_cpu',
    title: 'Quantum Control Plane',
    objective: 'Fabricate Quantum CPUs to stabilize exotic extraction.',
    requirement: { materialId: 'quantum_cpu', quantity: 15 },
    unlocks: {
      materialIds: ['raw_exotic', 'chronal_fluid'],
      recipeIds: ['extract_chronal_fluid'],
      nodeTypes: ['FEEDBACK_REGULATOR'],
    },
  },
  {
    id: 'mission_chronal',
    title: 'Temporal Coolant Loop',
    objective: 'Extract Chronal Fluid before attempting tachyon containment.',
    requirement: { materialId: 'chronal_fluid', quantity: 20 },
    unlocks: {
      recipeIds: ['forge_tachyon_core'],
      materialIds: ['tachyon_core', 'probability_ore', 'flux_filament'],
    },
  },
  {
    id: 'mission_tachyon',
    title: 'Containment Cores',
    objective: 'Forge Tachyon Cores and prepare probabilistic filament processing.',
    requirement: { materialId: 'tachyon_core', quantity: 10 },
    unlocks: {
      recipeIds: ['process_flux_filament'],
    },
  },
  {
    id: 'mission_flux',
    title: 'Flux Weaving',
    objective: 'Process Flux Filament for singularity drive construction.',
    requirement: { materialId: 'flux_filament', quantity: 25 },
    unlocks: {
      recipeIds: ['build_singularity_driver'],
      materialIds: ['singularity_driver'],
    },
  },
  {
    id: 'mission_singularity',
    title: 'Singularity Driver',
    objective: 'Build the first Singularity Driver and complete the current progression arc.',
    requirement: { materialId: 'singularity_driver', quantity: 5 },
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
  }

  return unlocked;
}
