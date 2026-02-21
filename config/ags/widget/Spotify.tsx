import app from "ags/gtk4/app"
import { Astal, Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { createPoll } from "ags/time"

export default function SpotifyPopup() {
  const title = createPoll("No hay reproducción", 1200, async () => {
    try {
      const out = await execAsync(`playerctl -p spotify metadata --format '{{title}}' 2>/dev/null || echo ''`)
      return out.trim() || "No hay reproducción"
    } catch {
      return "No hay reproducción"
    }
  })

  const artist = createPoll("", 1200, async () => {
    try {
      const out = await execAsync(`playerctl -p spotify metadata --format '{{artist}}' 2>/dev/null || echo ''`)
      return out.trim()
    } catch {
      return ""
    }
  })

  const status = createPoll("Detenido", 1200, async () => {
    try {
      const out = await execAsync(`playerctl -p spotify status 2>/dev/null || echo ''`)
      const s = out.trim()
      if (s === "Playing") return "Reproduciendo"
      if (s === "Paused") return "Pausado"
      return "Detenido"
    } catch {
      return "Detenido"
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
      marginTop={68}
      marginRight={36}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.ON_DEMAND}
    >
      <box orientation={Gtk.Orientation.VERTICAL} spacing={12} cssName="spotifyPopupCard">
        <box spacing={8} halign={Gtk.Align.FILL}>
          <label label=" Spotify" cssName="spotifyPopupHeading" hexpand xalign={0} />
          <label label={status} cssName="spotifyPopupStatus" />
        </box>

        <box orientation={Gtk.Orientation.VERTICAL} spacing={4}>
          <label label={title} wrap maxWidthChars={34} cssName="spotifyPopupTrack" xalign={0} />
          <label label={artist((a) => (a ? `por ${a}` : ""))} cssName="spotifyPopupArtist" xalign={0} />
        </box>

        <box spacing={10} cssName="spotifyPopupControls">
          <button onClicked={() => execAsync("playerctl -p spotify previous").catch(() => {})}>
            <label label="⏮" />
          </button>
          <button onClicked={() => execAsync("playerctl -p spotify play-pause").catch(() => {})}>
            <label label="⏯" />
          </button>
          <button onClicked={() => execAsync("playerctl -p spotify next").catch(() => {})}>
            <label label="⏭" />
          </button>
        </box>
      </box>
    </window>
  )
}
