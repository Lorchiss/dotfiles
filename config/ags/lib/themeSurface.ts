import { createPoll } from "ags/time"
import {
  createAccentCache,
  DEFAULT_ACCENT_CLASS,
  DEFAULT_ACCENT_POLL_MS,
  resolveCurrentMusicAccentClass,
} from "./musicAccent"
import { readThemeMode } from "./themeMode"

export function createPopupSurfaceClassState(
  baseClass: string,
  pollMs = DEFAULT_ACCENT_POLL_MS,
) {
  const cache = createAccentCache()

  return createPoll<string>(
    `${baseClass} popup-accent-surface popup-theme-dark ${DEFAULT_ACCENT_CLASS}`,
    pollMs,
    async () => {
      const [themeMode, accentClass] = await Promise.all([
        readThemeMode().catch(() => "dark" as const),
        resolveCurrentMusicAccentClass(cache),
      ])

      return [
        baseClass,
        "popup-accent-surface",
        `popup-theme-${themeMode}`,
        accentClass,
      ].join(" ")
    },
  )
}
