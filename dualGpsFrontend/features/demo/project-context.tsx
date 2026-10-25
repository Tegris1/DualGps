import { createContext, type ReactNode, useContext, useState } from "react";
import { getCurrentTerrain, getTargetTerrain } from "./terrain-catalog";

type DemoProject = {
  currentTerrain: ReturnType<typeof getCurrentTerrain>;
  targetTerrain: ReturnType<typeof getTargetTerrain>;
  selectCurrentTerrain: (id: string) => boolean;
  selectTargetTerrain: (id: string) => boolean;
};
const DemoProjectContext = createContext<DemoProject | undefined>(undefined);

export function DemoProjectProvider({ children }: { children: ReactNode }) {
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  function selectCurrentTerrain(id: string) {
    if (!getCurrentTerrain(id)) return false;
    if (id !== currentId) setTargetId(null);
    setCurrentId(id);
    return true;
  }
  function selectTargetTerrain(id: string) {
    const current = getCurrentTerrain(currentId);
    const target = getTargetTerrain(id);
    if (!current || !target || current.asset === target.asset) return false;
    setTargetId(id);
    return true;
  }
  return (
    <DemoProjectContext.Provider value={{ currentTerrain: getCurrentTerrain(currentId),
      targetTerrain: getTargetTerrain(targetId), selectCurrentTerrain, selectTargetTerrain }}>
      {children}
    </DemoProjectContext.Provider>
  );
}

export function useDemoProject() {
  const project = useContext(DemoProjectContext);
  if (!project) throw new Error("useDemoProject requires DemoProjectProvider");
  return project;
}
