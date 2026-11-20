import { getDashboardPresentation } from "../presentation/dashboard-readings";
import type { DashboardViewModel } from "../types";
import { useDashboardGnss } from "./use-dashboard-gnss";

export function useDashboard(): DashboardViewModel {
  const receiverGnss = useDashboardGnss();
  const secondReceiverGnss = useDashboardGnss(2);

  return getDashboardPresentation({
    primaryGnss: receiverGnss,
    secondaryGnss: secondReceiverGnss,
    sourceLabel: "GNSS 1 / 2: ODBIORNIKI",
  });
}
