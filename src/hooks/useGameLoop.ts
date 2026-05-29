import { useEffect } from 'react';
import { evaluateTick } from '../engine/SimulationEngine';
import { useFactoryStore } from '../store/useFactoryStore';

const TICK_INTERVAL_MS = 200; // 5 ticks per second

export function useGameLoop() {
  const getNodesMap = useFactoryStore((s) => s.getNodesMap);
  const getEdgesMap = useFactoryStore((s) => s.getEdgesMap);
  const applyTickResult = useFactoryStore((s) => s.applyTickResult);

  useEffect(() => {
    const interval = setInterval(() => {
      const nodes = getNodesMap();
      if (nodes.size === 0) return;
      try {
        const result = evaluateTick(nodes, getEdgesMap());
        applyTickResult(result);
      } catch (e) {
        // cycle or other engine error — skip tick
      }
    }, TICK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [getNodesMap, getEdgesMap, applyTickResult]);
}
