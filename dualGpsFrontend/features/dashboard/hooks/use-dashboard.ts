import { getDashboardPresentation } from "../presentation/dashboard-readings";
import type { DashboardViewModel } from "../types";
import { useDashboardGnss } from "./use-dashboard-gnss";

export function useDashboard(): DashboardViewModel {
  const receiverGnss = useDashboardGnss();

  return getDashboardPresentation({
    primaryGnss: receiverGnss,
    sourceLabel: "GNSS 1: ODBIORNIK · RESZTA: DEMO",
  });
}
