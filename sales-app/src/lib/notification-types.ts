export type NotificationTone =
  | "default"
  | "urgent"
  | "chime"
  | "bell"
  | "pulse"
  | "silent";

export type NotificationRow = {
  id: string;
  type:
    | "NEW_LEAD"
    | "FOLLOW_UP_DUE"
    | "DEAL_WON"
    | "LEAD_FLAG"
    | "UNCONTACTED_MANAGER_ALERT"
    | "FB_TOKEN_EXPIRED"
    | "BACKFILL_COMPLETE"
    | string;
  message: string;
  read: boolean;
  lead_id: string | null;
  client_id?: string | null;
  created_at: string;
};

export const NOTIFICATION_TONE_OPTIONS: Array<{
  id: NotificationTone;
  label: string;
  description: string;
}> = [
  { id: "default", label: "Standard", description: "Balanced two-tone alert" },
  { id: "urgent", label: "Urgent", description: "Fast triple beep — hard to miss" },
  { id: "chime", label: "Chime", description: "Ascending notes" },
  { id: "bell", label: "Bell", description: "Longer ring with decay" },
  { id: "pulse", label: "Pulse", description: "Repeating low pulse" },
  { id: "silent", label: "Silent", description: "System tray only, no sound" },
];
