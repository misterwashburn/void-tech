import { FactoryNode } from '../types';

export const STORAGE_STACK_SIZE = 100;
export const STORAGE_STACK_CAPACITY = 10;
export const STORAGE_ITEM_CAPACITY = STORAGE_STACK_SIZE * STORAGE_STACK_CAPACITY;

export function getStorageUsedStackCount(node: Pick<FactoryNode, 'inputBuffers'>): number {
  return Object.values(node.inputBuffers).reduce(
    (total, buffer) => total + Math.ceil(Math.max(0, buffer.current) / STORAGE_STACK_SIZE),
    0
  );
}

export function getStorageItemCount(node: Pick<FactoryNode, 'inputBuffers'>): number {
  return Object.values(node.inputBuffers).reduce(
    (total, buffer) => total + Math.max(0, buffer.current),
    0
  );
}

export function getStorageAvailableCapacityForMaterial(
  node: Pick<FactoryNode, 'inputBuffers'>,
  materialId: string
): number {
  const current = Math.max(0, node.inputBuffers[materialId]?.current ?? 0);
  const materialStacks = Math.ceil(current / STORAGE_STACK_SIZE);
  const freeStacks = Math.max(0, STORAGE_STACK_CAPACITY - getStorageUsedStackCount(node));

  return Math.max(0, (materialStacks + freeStacks) * STORAGE_STACK_SIZE - current);
}
