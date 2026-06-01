import { create } from 'zustand';

interface SettingsState {
  musicVolume: number;
  effectsVolume: number;
  setMusicVolume: (volume: number) => void;
  setEffectsVolume: (volume: number) => void;
}

function clampVolume(volume: number) {
  return Math.min(1, Math.max(0, volume));
}

export const useSettingsStore = create<SettingsState>((set) => ({
  musicVolume: 0.6,
  effectsVolume: 0.8,
  setMusicVolume: (volume) => set({ musicVolume: clampVolume(volume) }),
  setEffectsVolume: (volume) => set({ effectsVolume: clampVolume(volume) }),
}));
