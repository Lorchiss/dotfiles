import { execAsync } from "ags/process"
import { createPoll } from "ags/time"

export default function SpotifyButton() {
  const title = createPoll("", 2000, async () => {
    try {
      const out = await execAsync(`playerctl -p spotify metadata --format '{{title}}' 2>/dev/null || echo ''`)
      const track = out.trim()
      return track ? ` ${track}` : ""
    } catch {
      return ""
    }
  })

  const playing = createPoll(false, 2000, async () => {
    try {
      const out = await execAsync(`playerctl -p spotify status 2>/dev/null || echo ''`)
      return out.trim() === "Playing"
    } catch {
      return false
    }
  })

  const toggleSpotifyPopup = () => execAsync("ags toggle spotify").catch(() => {})

  return (
    <button onClicked={toggleSpotifyPopup} class={playing((isPlaying) => (isPlaying ? "spotify-active" : ""))}>
      <label label={title} />
    </button>
  )
}
