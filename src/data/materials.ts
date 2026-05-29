import { Material } from '../types';

export const MATERIALS: Record<string, Material> = {
  void_ore:          { id: 'void_ore',          name: 'Void Ore',          isVolatile: false, volatilityTrigger: 'NONE' },
  hydrocarbon:       { id: 'hydrocarbon',        name: 'Hydrocarbon',       isVolatile: false, volatilityTrigger: 'NONE' },
  plasteel:          { id: 'plasteel',           name: 'Plasteel Matrix',   isVolatile: false, volatilityTrigger: 'NONE' },
  polymer_sheet:     { id: 'polymer_sheet',      name: 'Polymer Sheet',     isVolatile: false, volatilityTrigger: 'NONE' },
  logic_substrate:   { id: 'logic_substrate',    name: 'Logic Substrate',   isVolatile: false, volatilityTrigger: 'NONE' },
  charged_alloy:     { id: 'charged_alloy',      name: 'Charged Alloy',     isVolatile: false, volatilityTrigger: 'NONE' },
  catalyst:          { id: 'catalyst',           name: 'Catalyst',          isVolatile: false, volatilityTrigger: 'NONE' },
  plasma:            { id: 'plasma',             name: 'Plasma',            isVolatile: false, volatilityTrigger: 'NONE' },
  quantum_cpu:       { id: 'quantum_cpu',        name: 'Quantum CPU',       isVolatile: false, volatilityTrigger: 'NONE' },
  raw_exotic:        { id: 'raw_exotic',         name: 'Raw Exotic',        isVolatile: false, volatilityTrigger: 'NONE' },
  chronal_fluid:     { id: 'chronal_fluid',      name: 'Chronal Fluid',     isVolatile: true,  volatilityTrigger: 'STALL' },
  tachyon_core:      { id: 'tachyon_core',       name: 'Tachyon Core',      isVolatile: false, volatilityTrigger: 'NONE' },
  probability_ore:   { id: 'probability_ore',    name: 'Probability Ore',   isVolatile: true,  volatilityTrigger: 'OVERFLOW' },
  flux_filament:     { id: 'flux_filament',      name: 'Flux Filament',     isVolatile: false, volatilityTrigger: 'NONE' },
  singularity_driver:{ id: 'singularity_driver', name: 'Singularity Driver',isVolatile: false, volatilityTrigger: 'NONE' },
};

export const TIER_1_MATERIALS = ['void_ore', 'hydrocarbon', 'plasteel', 'polymer_sheet'] as const;
