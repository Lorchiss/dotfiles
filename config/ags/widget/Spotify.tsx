import app from "ags/gtk4/app"
import { Astal, Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { createPoll } from "ags/time"

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds))
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

function toLocalArtPath(url: string) {
  if (!url) return ""
  if (url.startsWith("file://")) {
    try {
      return decodeURIComponent(url.replace("file://", ""))
    } catch {
      return url.replace("file://", "")
    }
  }
  return ""
}

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



  const progressTime = createPoll("0:00 / 0:00", 400, async () => {
    try {
      const len = await execAsync(`playerctl -p spotify metadata --format '{{mpris:length}}' 2>/dev/null || echo '0'`)
      const pos = await execAsync(`playerctl -p spotify position 2>/dev/null || echo '0'`)
      const totalSec = Number(len.trim()) / 1_000_000
      const currentSec = Number(pos.trim())
      return `${formatTime(currentSec)} / ${formatTime(totalSec)}`
    } catch {
      return "0:00 / 0:00"
    }
  })

  const progressText = createPoll("○──────────", 300, async () => {
    try {
      const len = await execAsync(`playerctl -p spotify metadata --format '{{mpris:length}}' 2>/dev/null || echo '0'`)
      const pos = await execAsync(`playerctl -p spotify position 2>/dev/null || echo '0'`)
      const totalSec = Number(len.trim()) / 1_000_000
      const currentSec = Number(pos.trim())

      if (!Number.isFinite(totalSec) || totalSec <= 0 || !Number.isFinite(currentSec)) return "○──────────"

      const slots = 12
      const ratio = Math.max(0, Math.min(1, currentSec / totalSec))
      const head = Math.min(slots - 1, Math.floor(ratio * slots))
      const left = "━".repeat(head)
      const right = "─".repeat(Math.max(0, slots - head - 1))
      return `${left}◉${right}`
    } catch {
      return "○──────────"
    }
  })

  const artPath = createPoll("", 2000, async () => {
    try {
      const out = await execAsync(`playerctl -p spotify metadata --format '{{mpris:artUrl}}' 2>/dev/null || echo ''`)
      return toLocalArtPath(out.trim())
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
      marginTop={68}
      marginRight={36}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.ON_DEMAND}
    >
      <box orientation={Gtk.Orientation.VERTICAL} spacing={12} cssName="spotifyPopupCard">
        <box spacing={10}>
          <box cssName="spotifyCoverWrap" valign={Gtk.Align.START}>
            <image file={artPath} cssName="spotifyCover" />
          </box>

          <box orientation={Gtk.Orientation.VERTICAL} spacing={6} hexpand>
            <box spacing={8} halign={Gtk.Align.FILL}>
              <label label=" Spotify" cssName="spotifyPopupHeading" hexpand xalign={0} />
              <label label={status} cssName="spotifyPopupStatus" />
            </box>

            <label label={title} wrap maxWidthChars={30} cssName="spotifyPopupTrack" xalign={0} />
            <label label={artist((a) => (a ? `por ${a}` : ""))} cssName="spotifyPopupArtist" xalign={0} />

            <box orientation={Gtk.Orientation.VERTICAL} spacing={2}>
              <label label={progressText} cssName="spotifyProgressWave" xalign={0} />
              <label label={progressTime} cssName="spotifyProgressTime" xalign={0} />
            </box>
          </box>
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
