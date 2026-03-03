import { Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { createPoll } from "ags/time"
import { barSystemStateBinding } from "../../lib/barSignals"
import { barLog } from "../../lib/barObservability"
import { openSpotifyApp } from "../../lib/spotify"

type StrictInput = string | number | null | undefined

type PrimaryStatusBlockV2Props = {
  spotifyEnabled?: boolean
}

const FALLBACK_LABEL = "—"
const SPOTIFY_LABEL = "Spotify"
const CHIP_TITLE_WIDTH = 16
const MARQUEE_TICK_MS = 140
const FORBIDDEN_PATTERNS = [
  /\[object/i,
  /instance\s+wrapper/i,
  /gtk\./i,
  /gobject/i,
  /accessor/i,
  /native@/i,
  /\bundefined\b/i,
  /\bnull\b/i,
]

let lastSpotifyClickMs = 0

function valuePreview(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value).replace(/\s+/g, " ").trim().slice(0, 80)
  }
  if (typeof value === "function") {
    return `[function ${value.name || "anonymous"}]`
  }
  if (value === null) return "null"
  if (value === undefined) return "undefined"
  if (typeof value === "object") {
    const ctorName =
      (value as { constructor?: { name?: string } }).constructor?.name ||
      "unknown"
    return `[object ${ctorName}]`
  }
  return String(value).replace(/\s+/g, " ").trim().slice(0, 80)
}

function containsForbiddenText(value: string): boolean {
  return FORBIDDEN_PATTERNS.some((pattern) => pattern.test(value))
}

function normalizeStrict(value: string | number): string {
  return String(value).replace(/\s+/g, " ").trim()
}

function safeTextStrict(
  value: unknown,
  fallback: StrictInput = FALLBACK_LABEL,
  fieldName = "value",
): string {
  const fallbackText =
    typeof fallback === "string" || typeof fallback === "number"
      ? normalizeStrict(fallback)
      : FALLBACK_LABEL

  if (typeof value !== "string" && typeof value !== "number") {
    barLog(
      "PRIMARY_STATUS_V2",
      `WARN rejected field=${fieldName} reason=non-primitive raw=${valuePreview(value)} fallback=${fallbackText}`,
    )
    return fallbackText
  }

  const text = normalizeStrict(value)
  if (!text) return fallbackText
  if (containsForbiddenText(text)) {
    barLog(
      "PRIMARY_STATUS_V2",
      `WARN rejected field=${fieldName} reason=forbidden-pattern raw=${valuePreview(value)} fallback=${fallbackText}`,
    )
    return fallbackText
  }

  return text
}

function resolveAlertLabel(
  batteryAvailable: boolean,
  batteryPercent: number | null,
  batteryStatus: string,
  maxTemperatureC: number | null,
): string {
  if (
    batteryAvailable &&
    batteryPercent !== null &&
    Number.isFinite(batteryPercent) &&
    batteryStatus === "discharging" &&
    batteryPercent <= 15
  ) {
    return `BAT ${Math.trunc(batteryPercent)}%`
  }

  if (
    maxTemperatureC !== null &&
    Number.isFinite(maxTemperatureC) &&
    maxTemperatureC >= 88
  ) {
    return `TEMP ${Math.trunc(maxTemperatureC)}°`
  }

  return ""
}

function marqueeText(text: string, tick: number, width: number): string {
  const clean = text.trim()
  if (!clean) return ""

  const chars = Array.from(clean)
  if (chars.length <= width) return clean

  const spacer = "\u2009"
  const loop = Array.from(`${chars.join(spacer)}${spacer.repeat(width)}`)
  const windowSize = width * 2 - 1
  const start = tick % loop.length
  let output = ""

  for (let index = 0; index < windowSize; index += 1) {
    output += loop[(start + index) % loop.length] ?? " "
  }

  return output
}

export default function PrimaryStatusBlockV2({
  spotifyEnabled = true,
}: PrimaryStatusBlockV2Props) {
  barLog("PRIMARY_STATUS_V2", "mounting")
  const system = barSystemStateBinding()

  const hasAlert = system((s) =>
    Boolean(
      safeTextStrict(
        resolveAlertLabel(
          s.batteryAvailable,
          s.batteryPercent,
          s.batteryStatus,
          s.maxTemperatureC,
        ),
        "",
        "alert-presence",
      ),
    ),
  )

  const alertLabel = system((s) =>
    safeTextStrict(
      resolveAlertLabel(
        s.batteryAvailable,
        s.batteryPercent,
        s.batteryStatus,
        s.maxTemperatureC,
      ),
      FALLBACK_LABEL,
      "alert-label",
    ),
  )
  const showSpotify = system(
    (s) =>
      !Boolean(
        safeTextStrict(
          resolveAlertLabel(
            s.batteryAvailable,
            s.batteryPercent,
            s.batteryStatus,
            s.maxTemperatureC,
          ),
          "",
          "alert-presence-inverse",
        ),
      ),
  )

  const spotifyTrack = createPoll<StrictInput>("", 2000, async () => {
    if (!spotifyEnabled) return FALLBACK_LABEL

    try {
      const out = await execAsync(
        `playerctl -p spotify metadata --format '{{title}}' 2>/dev/null || echo ''`,
      )
      return out.trim()
    } catch {
      return ""
    }
  })

  const marqueeTick = createPoll(0, MARQUEE_TICK_MS, (prev) => prev + 1)

  const spotifyLabel = marqueeTick((tick) => {
    if (!spotifyEnabled) return FALLBACK_LABEL
    const base = safeTextStrict(spotifyTrack(), "", "spotify-track")
    if (!base) return SPOTIFY_LABEL
    return safeTextStrict(
      marqueeText(base, tick, CHIP_TITLE_WIDTH),
      SPOTIFY_LABEL,
      "spotify-marquee",
    )
  })

  const spotifyPlaying = createPoll(false, 2000, async () => {
    if (!spotifyEnabled) return false

    try {
      const out = await execAsync(
        `playerctl -p spotify status 2>/dev/null || echo ''`,
      )
      const status = safeTextStrict(out, "", "spotify-status")
      return status === "Playing"
    } catch {
      return false
    }
  })

  const onSpotifyClick = async () => {
    if (!spotifyEnabled) return

    const now = Date.now()
    if (now - lastSpotifyClickMs <= 300) {
      lastSpotifyClickMs = 0
      await openSpotifyApp()
      return
    }

    lastSpotifyClickMs = now
    execAsync("ags toggle spotify").catch(() => {})
  }

  return (
    <box class="primary-status-block-v2" spacing={0} valign={Gtk.Align.CENTER}>
      <button
        class="primary-status-alert"
        visible={hasAlert}
        tooltipText="Alerta crítica del sistema"
        onClicked={() => execAsync("ags toggle control-center").catch(() => {})}
      >
        <box spacing={6}>
          <label label="⚠" />
          <label label={alertLabel} />
        </box>
      </button>

      <button
        visible={showSpotify}
        class={spotifyPlaying((isPlaying) =>
          isPlaying ? "spotify-chip spotify-active" : "spotify-chip",
        )}
        tooltipText={spotifyEnabled ? "Spotify" : "Estado"}
        sensitive={spotifyEnabled}
        onClicked={onSpotifyClick}
      >
        <box class="spotify-chip-content" spacing={6}>
          <label
            class="spotify-chip-icon"
            label={spotifyEnabled ? "" : FALLBACK_LABEL}
          />
          <label
            class="spotify-chip-title"
            label={spotifyLabel}
            widthChars={CHIP_TITLE_WIDTH}
            maxWidthChars={CHIP_TITLE_WIDTH}
            singleLineMode
            ellipsize={0}
            xalign={0}
          />
        </box>
      </button>
    </box>
  )
}
