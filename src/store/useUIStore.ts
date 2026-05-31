import { create } from 'zustand';
import { NodeType } from '../types';

interface UIState {
  placementNodeType: NodeType | null;
  selectedNodeId: string | null;
  connectingFromId: string | null;
  activeTab: 'PALETTE' | 'LEDGER' | 'MISSIONS';

  setPlacementNodeType: (type: NodeType | null) => void;
  setSelectedNodeId: (id: string | null) => void;
  setConnectingFromId: (id: string | null) => void;
  setActiveTab: (tab: 'PALETTE' | 'LEDGER' | 'MISSIONS') => void;
}

export const useUIStore = create<UIState>((set) => ({
  placementNodeType: null,
  selectedNodeId: null,
  connectingFromId: null,
  activeTab: 'PALETTE',

  setPlacementNodeType: (type) => set({ placementNodeType: type, selectedNodeId: null, connectingFromId: null }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id, connectingFromId: null }),
  setConnectingFromId: (id) => set({ connectingFromId: id }),
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
