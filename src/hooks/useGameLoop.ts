import { useEffect, useRef } from 'react';
import { evaluateTick } from '../engine/SimulationEngine';
import { useFactoryStore } from '../store/useFactoryStore';

export const TICK_INTERVAL_MS = 200; // 5 ticks per second
export const TICK_INTERVAL_SECONDS = TICK_INTERVAL_MS / 1000;

export function useGameLoop() {
  const lastErrorLogAt = useRef(0);
  const getNodesMap = useFactoryStore((s) => s.getNodesMap);
  const getEdgesMap = useFactoryStore((s) => s.getEdgesMap);
  const applyTickResult = useFactoryStore((s) => s.applyTickResult);

  useEffect(() => {
    const interval = setInterval(() => {
      const nodes = getNodesMap();
      if (nodes.size === 0) return;
      try {
        const result = evaluateTick(nodes, getEdgesMap());
        applyTickResult(result, TICK_INTERVAL_SECONDS);
      } catch (error) {
        const now = Date.now();
        if (__DEV__ && now - lastErrorLogAt.current >= 5000) {
          lastErrorLogAt.current = now;
          console.error('Simulation tick failed', error);
        }
      }
    }, TICK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [getNodesMap, getEdgesMap, applyTickResult]);
}
