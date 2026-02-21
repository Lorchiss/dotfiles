import app from "ags/gtk4/app"
import { Astal, Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { createPoll } from "ags/time"

export default function SpotifyPopup() {
  // Título dinámico (fallback a vacío)
  const title = createPoll("", 1500, async () => {
    try {
      const out = await execAsync(`playerctl metadata --format '{{title}}' 2>/dev/null || echo ''`)
      return out.trim()
    } catch {
      return ""
    }
  })

  return (
    <window
      name="spotify"
      class="SpotifyPopup"
      application={app}
      visible={false}
      layer={Astal.Layer.TOP}
      anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.RIGHT}
      // Debajo de barra 36px + gap 8px, alineado con margin-right 16
      exclusivity={Astal.Exclusivity.IGNORE}
    >
      <box orientation={Gtk.Orientation.VERTICAL} spacing={10} cssName="spotifyPopup">
        <label label="Spotify" cssName="spotifyTitle" />
        <label label={title} wrap maxWidthChars={40} cssName="spotifyTrack" />
        <box spacing={10}>
          <button onClicked={() => execAsync("playerctl previous").catch(() => {})}>
            <label label="⏮" />
          </button>
          <button onClicked={() => execAsync("playerctl play-pause").catch(() => {})}>
            <label label="⏯" />
          </button>
          <button onClicked={() => execAsync("playerctl next").catch(() => {})}>
            <label label="⏭" />
          </button>
        </box>
      </box>
    </window>
  )
}


