import { FactoryNode, HarvesterTier } from '../types';

export interface HarvesterTierDefinition {
  tier: HarvesterTier;
  unlockedInTier: HarvesterTier;
  name: string;
  maxEfficientVoidTier: number;
  baseRatePerSecond: number;
  internalInventoryCapacity: number;
}

export const HARVESTER_TIERS: HarvesterTierDefinition[] = [
  {
    tier: 0,
    unlockedInTier: 0,
    name: 'Void Harvester',
    maxEfficientVoidTier: 2,
    baseRatePerSecond: 10,
    internalInventoryCapacity: 10,
  },
  {
    tier: 5,
    unlockedInTier: 5,
    name: 'Deep Void Harvester',
    maxEfficientVoidTier: 6,
    baseRatePerSecond: 16,
    internalInventoryCapacity: 10,
  },
  {
    tier: 10,
    unlockedInTier: 10,
    name: 'Genesis Void Harvester',
    maxEfficientVoidTier: 10,
    baseRatePerSecond: 24,
    internalInventoryCapacity: 10,
  },
];

export const DEFAULT_HARVESTER_TIER: HarvesterTier = 0;

export const EXTRACTABLE_MATERIAL_VOID_TIERS: Record<string, number> = {
  void_ore: 1,
  hydrocarbon: 2,
  catalyst: 5,
  plasma: 6,
  raw_exotic: 7,
  probability_ore: 9,
};

export function getHarvesterTierDefinition(tier: HarvesterTier | undefined): HarvesterTierDefinition {
  return HARVESTER_TIERS.find((definition) => definition.tier === tier) ?? HARVESTER_TIERS[0];
}

export function getHarvesterOutputRate(node: Pick<FactoryNode, 'harvesterTier'>, materialId: string): number {
  const definition = getHarvesterTierDefinition(node.harvesterTier);
  const voidTier = EXTRACTABLE_MATERIAL_VOID_TIERS[materialId] ?? 1;
  const tierPenalty = Math.max(0, voidTier - definition.maxEfficientVoidTier);
  const speedMultiplier = Math.max(0.2, 1 - tierPenalty * 0.2);

  return definition.baseRatePerSecond * speedMultiplier;
}

export function getUnlockedHarvesterTiers(completedMissionIds: string[]): HarvesterTier[] {
  const completed = new Set(completedMissionIds);
  const tiers: HarvesterTier[] = [0];

  if (completed.has('mission_logic')) {
    tiers.push(5);
  }

  if (completed.has('mission_flux')) {
    tiers.push(10);
  }

  return tiers;
}
