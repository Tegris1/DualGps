import { useState } from "react";

export type DashboardMenuActions = {
  onOpenConnectionSetup?: () => void;
  onOpenSettings?: () => void;
  onSignOut: () => void;
};

export function useDashboardMenu(actions: DashboardMenuActions) {
  const [visible, setVisible] = useState(false);
  const { onOpenConnectionSetup, onOpenSettings } = actions;

  function select(action: () => void) {
    setVisible(false);
    action();
  }

  return {
    visible,
    onOpen: () => setVisible(true),
    onClose: () => setVisible(false),
    onOpenConnectionSetup: onOpenConnectionSetup ? () => select(onOpenConnectionSetup) : undefined,
    onOpenSettings: onOpenSettings ? () => select(onOpenSettings) : undefined,
    onSignOut: () => select(actions.onSignOut),
  };
}
