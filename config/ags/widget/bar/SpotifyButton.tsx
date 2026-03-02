import { execAsync } from "ags/process"
import { createPoll } from "ags/time"
import { openSpotifyApp } from "../../lib/spotify"
import { safeText } from "../../lib/text"
import { barLog } from "../../lib/barObservability"

const MARQUEE_TICK_MS = 140
const CHIP_TITLE_WIDTH = 16
const SPOTIFY_FALLBACK = "Spotify"

let lastClickMs = 0

function sanitizeChipText(value: unknown, fallback = SPOTIFY_FALLBACK): string {
  const cleaned = safeText(value, fallback, "SPOTIFY", "chip-text")
  if (!cleaned)
    return safeText(fallback, SPOTIFY_FALLBACK, "SPOTIFY", "chip-text-fallback")
  return cleaned
}

function marqueeText(text: string, tick: number, width: number) {
  const clean = sanitizeChipText(text, "")
  if (!clean) return ""

  const chars = Array.from(clean)
  if (chars.length <= width) return clean

  const smoothSpacer = "\u2009"
  const smoothText = chars.join(smoothSpacer)
  const gap = smoothSpacer.repeat(width)
  const loop = Array.from(`${smoothText}${gap}`)
  const windowSize = width * 2 - 1
  const start = tick % loop.length
  let out = ""

  for (let i = 0; i < windowSize; i++) {
    out += loop[(start + i) % loop.length] ?? " "
  }

  return out
}

export default function SpotifyButton() {
  barLog("SPOTIFY", "mounting SpotifyButton")
  const track = createPoll("", 2000, async () => {
    try {
      const out = await execAsync(
        `playerctl -p spotify metadata --format '{{title}}' 2>/dev/null || echo ''`,
      )
      return sanitizeChipText(out, "")
    } catch {
      return ""
    }
  })

  const marqueeTick = createPoll(0, MARQUEE_TICK_MS, (prev) => prev + 1)

  const title = marqueeTick((tick) => {
    const current = sanitizeChipText(track(), "")
    if (!current) return SPOTIFY_FALLBACK
    return sanitizeChipText(
      marqueeText(current, tick, CHIP_TITLE_WIDTH),
      SPOTIFY_FALLBACK,
    )
  })

  const playing = createPoll(false, 2000, async () => {
    try {
      const out = await execAsync(
        `playerctl -p spotify status 2>/dev/null || echo ''`,
      )
      const status = sanitizeChipText(out, "")
      return status.trim() === "Playing"
    } catch {
      return false
    }
  })

  const onSpotifyButtonClick = async () => {
    const now = Date.now()
    if (now - lastClickMs <= 300) {
      lastClickMs = 0
      await openSpotifyApp()
      return
    }

    lastClickMs = now
    execAsync("ags toggle spotify").catch(() => {})
  }

  return (
    <button
      onClicked={onSpotifyButtonClick}
      class={playing((isPlaying) =>
        isPlaying ? "spotify-chip spotify-active" : "spotify-chip",
      )}
      tooltipText="Spotify"
    >
      <box class="spotify-chip-content" spacing={6}>
        <label class="spotify-chip-icon" label="" />
        <label
          class="spotify-chip-title"
          label={title}
          widthChars={CHIP_TITLE_WIDTH}
          maxWidthChars={CHIP_TITLE_WIDTH}
          singleLineMode
          ellipsize={0}
          xalign={0}
        />
      </box>
    </button>
  )
}
