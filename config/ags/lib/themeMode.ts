import { createPoll } from "ags/time"
import { runCommand } from "./command"

export type ThemeMode = "dark" | "light"

const THEME_SYNC_SCRIPT = "$HOME/.config/hypr/scripts/theme-sync.sh"
const THEME_POLL_MS = 1500

function normalizeThemeMode(raw: string, fallback: ThemeMode): ThemeMode {
  const clean = raw.trim().toLowerCase()
  if (clean === "light") return "light"
  if (clean === "dark") return "dark"
  return fallback
}

export async function readThemeMode(): Promise<ThemeMode> {
  const raw = await runCommand(`${THEME_SYNC_SCRIPT} status`, {
    timeoutMs: 1400,
    allowFailure: true,
    dedupeKey: "theme-mode-status",
  })
  return normalizeThemeMode(raw, "dark")
}

export async function toggleThemeMode(): Promise<ThemeMode> {
  const raw = await runCommand(`${THEME_SYNC_SCRIPT} toggle`, {
    timeoutMs: 3200,
    allowFailure: true,
    dedupeKey: "theme-mode-toggle",
  })
  const clean = raw.trim().toLowerCase()
  if (clean === "dark" || clean === "light") return clean
  return readThemeMode()
}

const themeModeState = createPoll<ThemeMode>(
  "dark",
  THEME_POLL_MS,
  async (prev) => {
    try {
      return await readThemeMode()
    } catch {
      return prev
    }
  },
)

export function themeModeBinding() {
  return themeModeState
}
