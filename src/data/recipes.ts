import { Recipe } from '../types';

export const RECIPES: Record<string, Recipe> = {
  // Tier 1
  smelt_plasteel: {
    inputs:  [{ materialId: 'void_ore',      ratePerSecond: 5 }],
    outputs: [{ materialId: 'plasteel',      ratePerSecond: 3 }],
    energyCost: 8,
  },
  refine_polymer: {
    inputs:  [{ materialId: 'hydrocarbon',   ratePerSecond: 4 }],
    outputs: [{ materialId: 'polymer_sheet', ratePerSecond: 4 }],
    energyCost: 6,
  },

  // Tier 2
  assemble_logic_substrate: {
    inputs:  [
      { materialId: 'plasteel',      ratePerSecond: 3 },
      { materialId: 'polymer_sheet', ratePerSecond: 3 },
    ],
    outputs: [{ materialId: 'logic_substrate', ratePerSecond: 2 }],
    energyCost: 15,
  },
  forge_charged_alloy: {
    inputs:  [
      { materialId: 'void_ore',  ratePerSecond: 4 },
      { materialId: 'catalyst',  ratePerSecond: 2 },
    ],
    outputs: [{ materialId: 'charged_alloy', ratePerSecond: 2 }],
    energyCost: 12,
  },

  // Tier 3
  synthesize_quantum_cpu: {
    inputs:  [
      { materialId: 'logic_substrate', ratePerSecond: 2 },
      { materialId: 'plasma',          ratePerSecond: 3 },
    ],
    outputs: [{ materialId: 'quantum_cpu', ratePerSecond: 1 }],
    energyCost: 25,
  },
  extract_chronal_fluid: {
    inputs:  [{ materialId: 'raw_exotic',    ratePerSecond: 3 }],
    outputs: [{ materialId: 'chronal_fluid', ratePerSecond: 2 }],
    energyCost: 18,
  },

  // Tier 4
  forge_tachyon_core: {
    inputs:  [
      { materialId: 'chronal_fluid',  ratePerSecond: 2 },
      { materialId: 'charged_alloy',  ratePerSecond: 2 },
    ],
    outputs: [{ materialId: 'tachyon_core', ratePerSecond: 1 }],
    energyCost: 30,
  },
  process_flux_filament: {
    inputs:  [{ materialId: 'probability_ore', ratePerSecond: 4 }],
    outputs: [{
      materialId: 'flux_filament',
      ratePerSecond: 3,
      stochastic: { baseMean: 3, standardDeviation: 1 },
    }],
    energyCost: 20,
  },

  // Tier 5
  build_singularity_driver: {
    inputs:  [
      { materialId: 'tachyon_core',  ratePerSecond: 1 },
      { materialId: 'flux_filament', ratePerSecond: 2 },
    ],
    outputs: [{ materialId: 'singularity_driver', ratePerSecond: 1 }],
    energyCost: 50,
  },
};

export const RECIPES_BY_OUTPUT: Record<string, string> = Object.fromEntries(
  Object.entries(RECIPES).map(([id, r]) => [r.outputs[0].materialId, id])
);
