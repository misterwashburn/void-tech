import { NodeType, PowerTier, Recipe } from '../types';

export interface PowerTierDefinition {
  tier: PowerTier;
  name: string;
  powerOutput: number;
  maxTransferRate: number;
  unlockMissionId?: string;
}

export const POWER_TIERS: PowerTierDefinition[] = [
  { tier: 1, name: 'Hand-Crank Dynamo', powerOutput: 35, maxTransferRate: 35 },
  { tier: 2, name: 'Thermal Pile', powerOutput: 75, maxTransferRate: 75, unlockMissionId: 'mission_void_ore' },
  { tier: 3, name: 'Combustion Turbine', powerOutput: 140, maxTransferRate: 140, unlockMissionId: 'mission_plasteel' },
  { tier: 4, name: 'Polymer Fuel Cell', powerOutput: 240, maxTransferRate: 240, unlockMissionId: 'mission_polymer' },
  { tier: 5, name: 'Catalyst Reactor', powerOutput: 400, maxTransferRate: 400, unlockMissionId: 'mission_logic' },
  { tier: 6, name: 'Plasma Inductor', powerOutput: 650, maxTransferRate: 650, unlockMissionId: 'mission_alloy' },
  { tier: 7, name: 'Quantum Tap', powerOutput: 1000, maxTransferRate: 1000, unlockMissionId: 'mission_quantum_cpu' },
  { tier: 8, name: 'Chronal Flywheel', powerOutput: 1500, maxTransferRate: 1500, unlockMissionId: 'mission_chronal' },
  { tier: 9, name: 'Tachyon Cascade', powerOutput: 2250, maxTransferRate: 2250, unlockMissionId: 'mission_tachyon' },
  { tier: 10, name: 'Singularity Dynamo', powerOutput: 3500, maxTransferRate: 3500, unlockMissionId: 'mission_flux' },
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
