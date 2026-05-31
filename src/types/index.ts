export type NodeType = 'HARVESTER' | 'REFINER' | 'ASSEMBLER' | 'STORAGE' | 'SINK' | 'FEEDBACK_REGULATOR';

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
  nodeType?: Extract<NodeType, 'REFINER' | 'ASSEMBLER'>;
  inputs: Array<{ materialId: string; ratePerSecond: number }>;
  outputs: Array<{ materialId: string; ratePerSecond: number; stochastic?: StochasticParameters }>;
  energyCost: number;
}

export interface ResourceEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  materialId: string;
  maxCapacityRate: number;
  currentFlowRate: number;
}

export interface FactoryNode {
  id: string;
  name: string;
  type: NodeType;
  gridX: number;
  gridY: number;
  inputBuffers: Record<string, { current: number; max: number }>;
  outputBuffers: Record<string, { current: number; max: number }>;
  productionRecipe?: Recipe;
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
  edges: Map<string, ResourceEdge>;
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
  globalEnergyBalance: { production: number; consumption: number };
}

export interface UserLicense {
  purchasedSectorIds: string[];
  unlockedUiThemes: string[];
  hasPremiumAnalytics: boolean;
}
