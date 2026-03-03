import { execAsync } from "ags/process"

export type SessionAction = "logout" | "suspend" | "reboot" | "shutdown"

const SESSION_ACTION_LABELS: Record<SessionAction, string> = {
  logout: "Cerrar sesión",
  suspend: "Suspender",
  reboot: "Reiniciar",
  shutdown: "Apagar",
}

const SESSION_SNAPSHOT_COMMAND =
  `$HOME/.config/hypr/scripts/window-session.py save >/dev/null 2>&1 || true`

const SESSION_ACTION_COMMANDS: Record<SessionAction, string> = {
  logout: `${SESSION_SNAPSHOT_COMMAND}; hyprctl dispatch exit`,
  suspend: `${SESSION_SNAPSHOT_COMMAND}; systemctl suspend`,
  reboot: `${SESSION_SNAPSHOT_COMMAND}; systemctl reboot`,
  shutdown: `${SESSION_SNAPSHOT_COMMAND}; systemctl poweroff`,
}

export function sessionActionLabel(action: SessionAction): string {
  return SESSION_ACTION_LABELS[action]
}

export async function executeSessionAction(
  action: SessionAction,
): Promise<void> {
  const command = SESSION_ACTION_COMMANDS[action]
  await execAsync(`bash -lc "${command}"`)
}
