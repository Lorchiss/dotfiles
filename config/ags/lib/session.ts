import { execAsync } from "ags/process"

export type SessionAction = "logout" | "suspend" | "reboot" | "shutdown"

const SESSION_ACTION_LABELS: Record<SessionAction, string> = {
  logout: "Cerrar sesión",
  suspend: "Suspender",
  reboot: "Reiniciar",
  shutdown: "Apagar",
}

const SESSION_ACTION_COMMANDS: Record<SessionAction, string> = {
  logout: `hyprctl dispatch exit`,
  suspend: `systemctl suspend`,
  reboot: `systemctl reboot`,
  shutdown: `systemctl poweroff`,
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
