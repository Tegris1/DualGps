export type ReceiverDevice = { address: string; name?: string | null };

export type StatusBanner = { variant: "success" | "error" | "info"; message: string };

export type ConnectionAction = { label: string; disabled: boolean; loading: boolean };

export type DiagnosticRow = { label: string; value: string | number };
