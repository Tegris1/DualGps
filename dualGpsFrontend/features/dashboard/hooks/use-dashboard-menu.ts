import { useState } from "react";

export type DashboardMenuActions = {
  onOpenConnectionSetup?: () => void;
  onOpenSettings?: () => void;
  onSignOut: () => void;
};

type ViewActions = {
  onOpenView?: () => void;
  onOpenLayers?: () => void;
  onResetView?: () => void;
};

export function useDashboardMenu(actions: DashboardMenuActions & ViewActions) {
  const [visible, setVisible] = useState(false);
  const { onOpenConnectionSetup, onOpenSettings } = actions;
  const { onOpenView, onOpenLayers, onResetView } = actions;

  function select(action: () => void) {
    setVisible(false);
    action();
  }

  return {
    visible,
    onOpen: () => setVisible(true),
    onClose: () => setVisible(false),
    onOpenView: onOpenView ? () => select(onOpenView) : undefined,
    onOpenLayers: onOpenLayers ? () => select(onOpenLayers) : undefined,
    onResetView: onResetView ? () => select(onResetView) : undefined,
    onOpenConnectionSetup: onOpenConnectionSetup ? () => select(onOpenConnectionSetup) : undefined,
    onOpenSettings: onOpenSettings ? () => select(onOpenSettings) : undefined,
    onSignOut: () => select(actions.onSignOut),
  };
}
