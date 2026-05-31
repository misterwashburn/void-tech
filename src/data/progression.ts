export type ProgressionTier = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type VoidBaseType = 'ORE' | 'FLUID' | 'ENERGY';

export interface VoidTypeDefinition {
  id: string;
  tier: Exclude<ProgressionTier, 0>;
  name: string;
  baseType: VoidBaseType;
  codename: string;
  discoverySummary: string;
}

export interface RelayCommunicationDefinition {
  fromTier: Exclude<ProgressionTier, 0 | 10>;
  toTier: Exclude<ProgressionTier, 0 | 1>;
  durationSeconds: number;
  durationLabel: string;
  narrative: string;
}

export const NARRATIVE_BASELINE =
  'The year is twenty three fifty. a new, highly volatile technology has been discovered: void technology. because of the risk we\'re sending you (the player) to a new station just outside the solar system to harness it. build your station, discover new void types, and construct the tools that will change humanity.';

export const VOID_TYPES: VoidTypeDefinition[] = [
  {
    id: 'umbralite_ore',
    tier: 1,
    name: 'Umbralite Ore',
    baseType: 'ORE',
    codename: 'Anchor Dark',
    discoverySummary: 'A stable black mineral that can be mined directly from shallow void seams.',
  },
  {
    id: 'nullglass_ore',
    tier: 2,
    name: 'Nullglass Ore',
    baseType: 'ORE',
    codename: 'Mirror Zero',
    discoverySummary: 'A reflective ore that appears only after Umbralite is refined under station gravity.',
  },
  {
    id: 'vesper_charge',
    tier: 3,
    name: 'Vesper Charge',
    baseType: 'ENERGY',
    codename: 'Blue Dusk',
    discoverySummary: 'A cold void current that can be tapped as directed power instead of mined mass.',
  },
  {
    id: 'ecliptic_brine',
    tier: 4,
    name: 'Ecliptic Brine',
    baseType: 'FLUID',
    codename: 'Black Tide',
    discoverySummary: 'A pressure-sensitive fluid phase that condenses around energized void anchors.',
  },
  {
    id: 'paradoxite_ore',
    tier: 5,
    name: 'Paradoxite Ore',
    baseType: 'ORE',
    codename: 'Forkstone',
    discoverySummary: 'A branching ore whose lattice records multiple possible refinement histories.',
  },
  {
    id: 'horizon_shard',
    tier: 6,
    name: 'Horizon Shard',
    baseType: 'ORE',
    codename: 'Edgewake',
    discoverySummary: 'A dense fragment that forms at the boundary between local space and void shear.',
  },
  {
    id: 'aurora_null',
    tier: 7,
    name: 'Aurora Null',
    baseType: 'ENERGY',
    codename: 'Silent Green',
    discoverySummary: 'An oscillating energy band that emits no heat until it is forced through logic substrates.',
  },
  {
    id: 'chronosilt',
    tier: 8,
    name: 'Chronosilt',
    baseType: 'FLUID',
    codename: 'Slow River',
    discoverySummary: 'A granular fluid that drifts through containment seconds before the container moves.',
  },
  {
    id: 'apex_echo',
    tier: 9,
    name: 'Apex Echo',
    baseType: 'ENERGY',
    codename: 'Last Signal',
    discoverySummary: 'A self-amplifying pulse that repeats from the far side of a singularity wake.',
  },
  {
    id: 'genesis_cinder',
    tier: 10,
    name: 'Genesis Cinder',
    baseType: 'ORE',
    codename: 'First Fire',
    discoverySummary: 'A primordial ore that behaves like cooled creation pressure made tangible.',
  },
];

export const RELAY_COMMUNICATIONS: RelayCommunicationDefinition[] = [
  {
    fromTier: 1,
    toTier: 2,
    durationSeconds: 45,
    durationLabel: '45 seconds',
    narrative: 'Earth receives the Umbralite extraction proof and authorizes Nullglass prospecting almost immediately.',
  },
  {
    fromTier: 2,
    toTier: 3,
    durationSeconds: 5 * 60,
    durationLabel: '5 minutes',
    narrative: 'The Relay compresses Nullglass telemetry into a short burst that reveals the first energy-phase void signature.',
  },
  {
    fromTier: 3,
    toTier: 4,
    durationSeconds: 20 * 60,
    durationLabel: '20 minutes',
    narrative: 'Vesper Charge readings require deeper validation before Earth clears fluid-phase containment work.',
  },
  {
    fromTier: 4,
    toTier: 5,
    durationSeconds: 60 * 60,
    durationLabel: '1 hour',
    narrative: 'Ecliptic Brine samples take a full orbital relay packet to confirm the Paradoxite anomaly.',
  },
  {
    fromTier: 5,
    toTier: 6,
    durationSeconds: 3 * 60 * 60,
    durationLabel: '3 hours',
    narrative: 'Paradoxite forecasts are cross-checked against Earthside simulations before Horizon Shard mining unlocks.',
  },
  {
    fromTier: 6,
    toTier: 7,
    durationSeconds: 8 * 60 * 60,
    durationLabel: '8 hours',
    narrative: 'Horizon Shard data is too dense for a single pulse, forcing an extended Relay handshake.',
  },
  {
    fromTier: 7,
    toTier: 8,
    durationSeconds: 18 * 60 * 60,
    durationLabel: '18 hours',
    narrative: 'Aurora Null destabilizes standard decoding, delaying authorization for Chronosilt extraction.',
  },
  {
    fromTier: 8,
    toTier: 9,
    durationSeconds: 36 * 60 * 60,
    durationLabel: '36 hours',
    narrative: 'Chronosilt packets arrive out of order and must be reconciled before Apex Echo can be safely pursued.',
  },
  {
    fromTier: 9,
    toTier: 10,
    durationSeconds: 3 * 24 * 60 * 60,
    durationLabel: '3 days',
    narrative: 'Apex Echo confirmation crosses the longest real-time review window before Earth allows Genesis Cinder work.',
  },
];

export function getVoidTypeForTier(tier: ProgressionTier): VoidTypeDefinition | undefined {
  if (tier === 0) {
    return undefined;
  }

  return VOID_TYPES.find((voidType) => voidType.tier === tier);
}

export function getRelayCommunicationForTier(
  fromTier: ProgressionTier
): RelayCommunicationDefinition | undefined {
  if (fromTier === 0 || fromTier === 10) {
    return undefined;
  }

  return RELAY_COMMUNICATIONS.find((communication) => communication.fromTier === fromTier);
}
