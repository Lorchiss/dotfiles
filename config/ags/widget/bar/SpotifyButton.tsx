import { execAsync } from "ags/process"
import { createPoll } from "ags/time"

let lastClickMs = 0

async function openSpotifyApp() {
  await execAsync(
    `bash -lc 'if command -v spotify >/dev/null 2>&1; then spotify; elif command -v gtk-launch >/dev/null 2>&1; then gtk-launch spotify; else xdg-open spotify:; fi'`,
  ).catch(() => {})
}

export default function SpotifyButton() {
  const title = createPoll("", 2000, async () => {
    try {
      const out = await execAsync(
        `playerctl -p spotify metadata --format '{{title}}' 2>/dev/null || echo ''`,
      )
      const track = out.trim()
      return track ? ` ${track}` : ""
    } catch {
      return ""
    }
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
      <label label={title} maxWidthChars={20} ellipsize={3} />
    </button>
  )
}
