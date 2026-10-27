import { useState } from "react";

export type DashboardMenuActions = {
  onOpenConnectionSetup: () => void;
  onOpenSettings: () => void;
  onSignOut: () => void;
};

export function useDashboardMenu(actions: DashboardMenuActions) {
  const [visible, setVisible] = useState(false);

  function select(action: () => void) {
    setVisible(false);
    action();
  }

  return {
    visible,
    onOpen: () => setVisible(true),
    onClose: () => setVisible(false),
    onOpenConnectionSetup: () => select(actions.onOpenConnectionSetup),
    onOpenSettings: () => select(actions.onOpenSettings),
    onSignOut: () => select(actions.onSignOut),
  };
}
