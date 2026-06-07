import { create } from 'zustand';
import { NodeType } from '../types';

type ActiveTab = 'VIEW' | 'PALETTE' | 'LEDGER' | 'MISSIONS';

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
  toggleActiveTab: (tab: ActiveTab) => void;
  setDockRaised: (isRaised: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  placementNodeType: null,
  placementDrop: null,
  selectedNodeId: null,
  connectingFromId: null,
  activeTab: 'VIEW',
  isDockRaised: false,

  setPlacementNodeType: (type) => set({
    placementNodeType: type,
    selectedNodeId: null,
    connectingFromId: null,
    activeTab: type === null ? 'VIEW' : 'PALETTE',
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
  setActiveTab: (tab) => set((state) => ({
    activeTab: tab,
    isDockRaised: tab !== 'VIEW',
    placementNodeType: tab === 'PALETTE' ? state.placementNodeType : null,
  })),
  toggleActiveTab: (tab) => set((state) => {
    const shouldCollapse = tab === 'VIEW' || (state.activeTab === tab && state.isDockRaised);
    const nextTab = shouldCollapse ? 'VIEW' : tab;

    return {
      activeTab: nextTab,
      isDockRaised: !shouldCollapse,
      placementNodeType: nextTab === 'PALETTE' ? state.placementNodeType : null,
    };
  }),
  setDockRaised: (isRaised) => set((state) => ({
    isDockRaised: isRaised,
    activeTab: isRaised ? state.activeTab : 'VIEW',
    placementNodeType: isRaised ? state.placementNodeType : null,
  })),
}));
