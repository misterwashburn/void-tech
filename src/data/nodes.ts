import { FactoryNode, NodeType } from '../types';

export const STANDARD_NODE_SIZE = 64;
export const COMPACT_NODE_SIZE = 16;

export function getNodeCode(type: NodeType): string {
  switch (type) {
    case 'POWER_GENERATOR': return 'PWR';
    case 'HARVESTER': return 'HAR';
    case 'REFINER': return 'RES';
    case 'ASSEMBLER': return 'ASM';
    case 'STORAGE': return 'STO';
    case 'SINK': return 'SNK';
    case 'RELAY': return 'RLY';
    case 'FEEDBACK_REGULATOR': return 'FBK';
    case 'MERGE_UNIT': return 'MRG';
    case 'SPLIT_UNIT': return 'SPL';
    default: return '???';
  }
}

export function getNodeDisplayName(type: NodeType): string {
  switch (type) {
    case 'POWER_GENERATOR': return 'Generator';
    case 'HARVESTER': return 'Void Harvester';
    case 'REFINER': return 'Resolver';
    case 'ASSEMBLER': return 'Assembler';
    case 'STORAGE': return 'Storage';
    case 'SINK': return 'Output Sink';
    case 'RELAY': return 'Relay';
    case 'FEEDBACK_REGULATOR': return 'Feedback Regulator';
    case 'MERGE_UNIT': return 'Merge Unit';
    case 'SPLIT_UNIT': return 'Split Unit';
    default: return type;
  }
}

export function getNodeFootprintSize(type: NodeType): number {
  return type === 'MERGE_UNIT' || type === 'SPLIT_UNIT' ? COMPACT_NODE_SIZE : STANDARD_NODE_SIZE;
}

export function getFactoryNodeFootprintSize(node: Pick<FactoryNode, 'type'>): number {
  return getNodeFootprintSize(node.type);
}
