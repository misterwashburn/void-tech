import { FactoryEdge, FactoryNode, NodeType, PowerTier } from '../types';
import { ProgressionTier, getRelayCommunicationForTier } from './progression';

export interface MissionRequirement {
  materialId: string;
  quantity: number;
}

export type MissionStep =
  | {
      id: string;
      title: string;
      instruction: string;
      narrative: string;
      kind: 'BUILD_NODE';
      nodeType: NodeType;
      quantity: number;
    }
  | {
      id: string;
      title: string;
      instruction: string;
      narrative: string;
      kind: 'PRODUCE_MATERIAL';
      materialId: string;
      quantity: number;
    }
  | {
      id: string;
      title: string;
      instruction: string;
      narrative: string;
      kind: 'CONNECT_POWER';
      sourceNodeType: NodeType;
      targetNodeType: NodeType;
      quantity: number;
    }
  | {
      id: string;
      title: string;
      instruction: string;
      narrative: string;
      kind: 'STORE_MATERIAL';
      nodeType: NodeType;
      materialId: string;
      quantity: number;
    };

export interface MissionUnlocks {
  nodeTypes?: NodeType[];
  materialIds?: string[];
  recipeIds?: string[];
  powerTiers?: PowerTier[];
}

export interface MissionDefinition {
  id: string;
  tier: ProgressionTier;
  title: string;
  objective: string;
  requirement: MissionRequirement;
  steps?: MissionStep[];
  unlocks: MissionUnlocks;
  discoversVoidTypeId?: string;
  relayCommunication?: ReturnType<typeof getRelayCommunicationForTier>;
  narrativeBeat: string;
}

export const INITIAL_UNLOCKS: Required<MissionUnlocks> = {
  nodeTypes: ['POWER_GENERATOR', 'HARVESTER', 'STORAGE', 'SINK', 'MERGE_UNIT', 'SPLIT_UNIT', 'RELAY'],
  materialIds: ['void_ore'],
  recipeIds: [],
  powerTiers: [0],
};

export const MISSIONS: MissionDefinition[] = [
  {
    id: 'mission_into_the_void',
    tier: 0,
    title: 'Into the Void',
    objective: 'Bring the bootstrap station online, power the first extractor, and secure the first Void Ore reserve.',
    requirement: { materialId: 'void_ore', quantity: 100 },
    steps: [
      {
        id: 'build_power',
        title: 'Wake the station',
        instruction: 'Open Build, choose Power, and place a Bootstrap Generator.',
        narrative: 'Welcome to the outer station. Earth has parked you at the edge of known space because void technology is too unstable to test near home. First priority: give the station a heartbeat.',
        kind: 'BUILD_NODE',
        nodeType: 'POWER_GENERATOR',
        quantity: 1,
      },
      {
        id: 'build_harvester',
        title: 'Anchor the first seam',
        instruction: 'Open Build, choose Extraction, and place a Void Harvester.',
        narrative: 'The scanner has found a shallow Umbralite-class seam. It will not stay coherent for long unless you anchor it with harvesting equipment.',
        kind: 'BUILD_NODE',
        nodeType: 'HARVESTER',
        quantity: 1,
      },
      {
        id: 'connect_harvester_power',
        title: 'Power the harvester',
        instruction: 'Drag a power line from the Bootstrap Generator to the Void Harvester.',
        narrative: 'The harvester is anchored, but its containment field is dark. Feed it directly from the generator before the seam slips away.',
        kind: 'CONNECT_POWER',
        sourceNodeType: 'POWER_GENERATOR',
        targetNodeType: 'HARVESTER',
        quantity: 1,
      },
      {
        id: 'store_void_ore',
        title: 'Secure the first reserve',
        instruction: 'Build Storage, then drag a transport line from the Void Harvester to Storage and store 100 Void Ore.',
        narrative: 'The first fragments are not metal, not stone, and not fully here. Contain a reserve before the seam destabilizes.',
        kind: 'STORE_MATERIAL',
        nodeType: 'STORAGE',
        materialId: 'void_ore',
        quantity: 100,
      },
    ],
    narrativeBeat: 'Earthside command is losing the uplink. The void is expanding faster than projected, and this station is now the only platform close enough to respond. Keep extracting, build what you need, and follow the mission ledger. From here on, you are on your own.',
    unlocks: {},
  },
  {
    id: 'mission_void_ore',
    tier: 1,
    title: 'Bootstrap Extraction',
    objective: 'Route Umbralite-class Void Ore into the grid, then send the extraction proof to Earth through the Relay.',
    requirement: { materialId: 'void_ore', quantity: 250 },
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

export interface MissionStepStatus {
  step: MissionStep;
  isComplete: boolean;
  current: number;
  target: number;
}

export interface MissionProgressState {
  nodes: Record<string, FactoryNode>;
  edges?: Record<string, FactoryEdge>;
  producedTotals: Record<string, number>;
}

function getMaterialProgress(state: MissionProgressState, materialId: string): number {
  return state.producedTotals[materialId] ?? 0;
}

export function getMissionStepStatuses(
  mission: MissionDefinition,
  state: MissionProgressState
): MissionStepStatus[] {
  return (mission.steps ?? []).map((step) => {
    if (step.kind === 'BUILD_NODE') {
      const current = Object.values(state.nodes).filter((node) => node.type === step.nodeType).length;
      return {
        step,
        isComplete: current >= step.quantity,
        current,
        target: step.quantity,
      };
    }

    if (step.kind === 'CONNECT_POWER') {
      const current = Object.values(state.edges ?? {}).filter((edge) => {
        if (edge.connectionType !== 'POWER') {
          return false;
        }

        return state.nodes[edge.sourceNodeId]?.type === step.sourceNodeType
          && state.nodes[edge.targetNodeId]?.type === step.targetNodeType;
      }).length;
      return {
        step,
        isComplete: current >= step.quantity,
        current,
        target: step.quantity,
      };
    }

    if (step.kind === 'STORE_MATERIAL') {
      const current = Object.values(state.nodes)
        .filter((node) => node.type === step.nodeType)
        .reduce((total, node) => total + (node.inputBuffers[step.materialId]?.current ?? 0), 0);
      return {
        step,
        isComplete: current >= step.quantity,
        current,
        target: step.quantity,
      };
    }

    const current = getMaterialProgress(state, step.materialId);
    return {
      step,
      isComplete: current >= step.quantity,
      current,
      target: step.quantity,
    };
  });
}

export function isMissionComplete(
  mission: MissionDefinition,
  state: MissionProgressState
): boolean {
  if (mission.steps?.length) {
    return getMissionStepStatuses(mission, state).every((status) => status.isComplete);
  }

  const completedQuantity = getMaterialProgress(state, mission.requirement.materialId);
  return completedQuantity >= mission.requirement.quantity;
}

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
