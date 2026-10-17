import { createContext, type ReactNode, useContext, useState } from "react";
import { getCurrentTerrain } from "./terrain-catalog";

type DemoProject = {
  currentTerrain: ReturnType<typeof getCurrentTerrain>;
  selectCurrentTerrain: (id: string) => boolean;
};
const DemoProjectContext = createContext<DemoProject | undefined>(undefined);

export function DemoProjectProvider({ children }: { children: ReactNode }) {
  const [currentId, setCurrentId] = useState<string | null>(null);
  function selectCurrentTerrain(id: string) {
    if (!getCurrentTerrain(id)) return false;
    setCurrentId(id);
    return true;
  }
  return (
    <DemoProjectContext.Provider value={{ currentTerrain: getCurrentTerrain(currentId), selectCurrentTerrain }}>
      {children}
    </DemoProjectContext.Provider>
  );
}

export function useDemoProject() {
  const project = useContext(DemoProjectContext);
  if (!project) throw new Error("useDemoProject requires DemoProjectProvider");
  return project;
}
