export type NodeType =
  | 'POWER_GENERATOR'
  | 'HARVESTER'
  | 'REFINER'
  | 'ASSEMBLER'
  | 'STORAGE'
  | 'SINK'
  | 'MERGE_UNIT'
  | 'SPLIT_UNIT'
  | 'RELAY'
  | 'FEEDBACK_REGULATOR';

export type ConnectionType = 'RESOURCE' | 'POWER';
export type PowerTier = 0 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type HarvesterTier = 0 | 5 | 10;

export interface Material {
  id: string;
  name: string;
  isVolatile: boolean;
  volatilityTrigger: 'STALL' | 'OVERFLOW' | 'NONE';
}

export interface StochasticParameters {
  baseMean: number;
  standardDeviation: number;
}

export interface Recipe {
  nodeType?: Extract<NodeType, 'HARVESTER' | 'REFINER' | 'ASSEMBLER'>;
  inputs: Array<{ materialId: string; ratePerSecond: number }>;
  outputs: Array<{ materialId: string; ratePerSecond: number; stochastic?: StochasticParameters }>;
  energyCost: number;
}

export type ConnectionPortId = `port_${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7}`;

export interface BaseEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourcePortId?: ConnectionPortId;
  targetPortId?: ConnectionPortId;
  connectionType: ConnectionType;
}

export interface ResourceEdge extends BaseEdge {
  connectionType: 'RESOURCE';
  materialId: string;
  maxCapacityRate: number;
  currentFlowRate: number;
}

export interface PowerEdge extends BaseEdge {
  connectionType: 'POWER';
  maxTransferRate: number;
  currentTransferRate: number;
}

export type FactoryEdge = ResourceEdge | PowerEdge;

export interface FactoryNode {
  id: string;
  name: string;
  type: NodeType;
  gridX: number;
  gridY: number;
  x?: number;
  y?: number;
  inputBuffers: Record<string, { current: number; max: number }>;
  outputBuffers: Record<string, { current: number; max: number }>;
  productionRecipe?: Recipe;
  powerRequirement: number;
  powerOutput: number;
  powerTier?: PowerTier;
  harvesterTier?: HarvesterTier;
  efficiencyRating: number;
  isOperational: boolean;
  cosmeticSkinId: string | null;
  stallTicksAccumulated: number;
  operationalStatus: 'OPERATIONAL' | 'STARVED' | 'WARNING' | 'STALLED';
}

export interface SectorState {
  id: string;
  isUnlocked: boolean;
  nodes: Map<string, FactoryNode>;
  edges: Map<string, FactoryEdge>;
  availableEnergy: number;
  consumedEnergy: number;
}

export interface NodeTickDelta {
  nodeId: string;
  calculatedEfficiency: number;
  operationalStatus: 'OPERATIONAL' | 'STARVED' | 'WARNING' | 'STALLED';
  energyDraw: number;
}

export interface EdgeTickDelta {
  edgeId: string;
  actualFlowRate: number;
}

export interface TickResult {
  timestamp: number;
  nodeDeltas: Map<string, NodeTickDelta>;
  edgeDeltas: Map<string, EdgeTickDelta>;
  productionRatesByNode: Map<string, Record<string, number>>;
  globalEnergyBalance: { production: number; consumption: number };
}

export interface UserLicense {
  purchasedSectorIds: string[];
  unlockedUiThemes: string[];
  hasPremiumAnalytics: boolean;
}
