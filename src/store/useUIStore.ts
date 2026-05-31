import { create } from 'zustand';
import { NodeType } from '../types';

type ActiveTab = 'PALETTE' | 'LEDGER' | 'MISSIONS';

interface PlacementDrop {
  id: number;
  nodeType: NodeType;
  absoluteX: number;
  absoluteY: number;
}

interface UIState {
  placementNodeType: NodeType | null;
  placementDrop: PlacementDrop | null;
  selectedNodeId: string | null;
  connectingFromId: string | null;
  activeTab: ActiveTab;
  isDockRaised: boolean;

  setPlacementNodeType: (type: NodeType | null) => void;
  requestPlacementDrop: (nodeType: NodeType, absoluteX: number, absoluteY: number) => void;
  clearPlacementDrop: () => void;
  setSelectedNodeId: (id: string | null) => void;
  setConnectingFromId: (id: string | null) => void;
  setActiveTab: (tab: ActiveTab) => void;
  setDockRaised: (isRaised: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  placementNodeType: null,
  placementDrop: null,
  selectedNodeId: null,
  connectingFromId: null,
  activeTab: 'PALETTE',
  isDockRaised: false,

  setPlacementNodeType: (type) => set({
    placementNodeType: type,
    selectedNodeId: null,
    connectingFromId: null,
    isDockRaised: type !== null,
  }),
  requestPlacementDrop: (nodeType, absoluteX, absoluteY) => set({
    placementNodeType: nodeType,
    placementDrop: {
      id: Date.now(),
      nodeType,
      absoluteX,
      absoluteY,
    },
    selectedNodeId: null,
    connectingFromId: null,
  }),
  clearPlacementDrop: () => set({ placementDrop: null }),
  setSelectedNodeId: (id) => set({ selectedNodeId: id, connectingFromId: null }),
  setConnectingFromId: (id) => set({ connectingFromId: id }),
  setActiveTab: (tab) => set({ activeTab: tab, isDockRaised: true }),
  setDockRaised: (isRaised) => set({ isDockRaised: isRaised }),
}));
