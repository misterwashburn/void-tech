import { NodeType, PowerTier, Recipe } from '../types';
import { ProgressionTier } from './progression';

export interface PowerTierDefinition {
  tier: PowerTier;
  unlockedInTier: ProgressionTier;
  name: string;
  powerOutput: number;
  maxTransferRate: number;
  unlockMissionId?: string;
  voidTypeId?: string;
}

export const POWER_TIERS: PowerTierDefinition[] = [
  { tier: 0, unlockedInTier: 0, name: 'Field Dynamo', powerOutput: 35, maxTransferRate: 35 },
  {
    tier: 2,
    unlockedInTier: 2,
    name: 'Field Dynamo Array',
    powerOutput: 75,
    maxTransferRate: 75,
    unlockMissionId: 'mission_void_ore',
    voidTypeId: 'nullglass_ore',
  },
  {
    tier: 3,
    unlockedInTier: 3,
    name: 'Vesper Charge Tap',
    powerOutput: 140,
    maxTransferRate: 140,
    unlockMissionId: 'mission_plasteel',
    voidTypeId: 'vesper_charge',
  },
  {
    tier: 4,
    unlockedInTier: 4,
    name: 'Brine-Cooled Vesper Tap',
    powerOutput: 240,
    maxTransferRate: 240,
    unlockMissionId: 'mission_polymer',
    voidTypeId: 'ecliptic_brine',
  },
  {
    tier: 5,
    unlockedInTier: 5,
    name: 'Paradoxite Lattice Reactor',
    powerOutput: 400,
    maxTransferRate: 400,
    unlockMissionId: 'mission_logic',
    voidTypeId: 'paradoxite_ore',
  },
  {
    tier: 6,
    unlockedInTier: 6,
    name: 'Horizon-Bound Lattice Reactor',
    powerOutput: 650,
    maxTransferRate: 650,
    unlockMissionId: 'mission_alloy',
    voidTypeId: 'horizon_shard',
  },
  {
    tier: 7,
    unlockedInTier: 7,
    name: 'Aurora Null Conduit',
    powerOutput: 1000,
    maxTransferRate: 1000,
    unlockMissionId: 'mission_quantum_cpu',
    voidTypeId: 'aurora_null',
  },
  {
    tier: 8,
    unlockedInTier: 8,
    name: 'Chronosilt-Cooled Null Conduit',
    powerOutput: 1500,
    maxTransferRate: 1500,
    unlockMissionId: 'mission_chronal',
    voidTypeId: 'chronosilt',
  },
  {
    tier: 9,
    unlockedInTier: 9,
    name: 'Apex Echo Cascade',
    powerOutput: 2250,
    maxTransferRate: 2250,
    unlockMissionId: 'mission_tachyon',
    voidTypeId: 'apex_echo',
  },
  {
    tier: 10,
    unlockedInTier: 10,
    name: 'Genesis-Cored Echo Cascade',
    powerOutput: 3500,
    maxTransferRate: 3500,
    unlockMissionId: 'mission_flux',
    voidTypeId: 'genesis_cinder',
  },
];

const BASE_POWER_REQUIREMENTS: Record<NodeType, number> = {
  POWER_GENERATOR: 0,
  HARVESTER: 8,
  REFINER: 18,
  ASSEMBLER: 32,
  STORAGE: 2,
  SINK: 1,
  RELAY: 12,
  FEEDBACK_REGULATOR: 45,
};

export function getPowerTierDefinition(tier: PowerTier): PowerTierDefinition {
  return POWER_TIERS.find((definition) => definition.tier === tier) ?? POWER_TIERS[0];
}

export function getDefaultPowerRequirement(nodeType: NodeType, recipe?: Recipe): number {
  if (nodeType === 'POWER_GENERATOR') {
    return 0;
  }

  return Math.max(BASE_POWER_REQUIREMENTS[nodeType], recipe?.energyCost ?? 0);
}

export function getUnlockedPowerTiers(completedMissionIds: string[]): PowerTier[] {
  const completed = new Set(completedMissionIds);

  return POWER_TIERS
    .filter((definition) => !definition.unlockMissionId || completed.has(definition.unlockMissionId))
    .map((definition) => definition.tier);
}
