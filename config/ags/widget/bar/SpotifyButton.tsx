import { execAsync } from "ags/process"
import { createPoll } from "ags/time"

let lastClickMs = 0

function marqueeText(text: string, tick: number, width: number) {
  const clean = text.trim()
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

async function openSpotifyApp() {
  await execAsync(
    `bash -lc 'if command -v spotify >/dev/null 2>&1; then spotify; elif command -v gtk-launch >/dev/null 2>&1; then gtk-launch spotify; else xdg-open spotify:; fi'`,
  ).catch(() => {})
}

export default function SpotifyButton() {
  const track = createPoll("", 2000, async () => {
    try {
      const out = await execAsync(
        `playerctl -p spotify metadata --format '{{title}}' 2>/dev/null || echo ''`,
      )
      return out.trim()
    } catch {
      return ""
    }
  })

  const marqueeTick = createPoll(0, 110, (prev) => prev + 1)

  const title = marqueeTick((tick) => {
    const current = track()
    if (!current) return "Spotify"
    return marqueeText(current, tick, 16)
  })

  const playing = createPoll(false, 2000, async () => {
    try {
      const out = await execAsync(
        `playerctl -p spotify status 2>/dev/null || echo ''`,
      )
      return out.trim() === "Playing"
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
          widthChars={16}
          maxWidthChars={16}
          singleLineMode
          ellipsize={0}
          xalign={0}
        />
      </box>
    </button>
  )
}
