import app from "ags/gtk4/app"
import { Astal, Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { createPoll } from "ags/time"

const fallbackCover = "/usr/share/icons/hicolor/128x128/apps/spotify-client.png"
const cachedCover = "/tmp/ags-spotify-cover.jpg"

function formatTime(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

function parseFloatSafe(raw: string) {
  const normalized = raw.trim().replace(",", ".")
  const n = Number(normalized)
  return Number.isFinite(n) ? n : 0
}

function shSingleQuote(value: string) {
  return `'${value.replace(/'/g, `'"'"'`)}'`
}

type SpotifyState = {
  title: string
  artist: string
  status: string
  totalSec: number
  currentSec: number
  artPath: string
}

let lastArtUrl = ""

async function resolveArtPath(url: string) {
  if (!url) return fallbackCover

  if (url.startsWith("file://")) {
    try {
      return decodeURIComponent(url.replace("file://", ""))
    } catch {
      return url.replace("file://", "")
    }
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      const safeUrl = shSingleQuote(url)
      await execAsync(`bash -lc "curl -L --silent --show-error --max-time 4 --output ${shSingleQuote(cachedCover)} -- ${safeUrl}"`)
      return cachedCover
    } catch {
      return fallbackCover
    }
  }

  return fallbackCover
}

function statusLabel(status: string) {
  if (status === "Playing") return "Reproduciendo"
  if (status === "Paused") return "Pausado"
  return "Detenido"
}

export default function SpotifyPopup() {
  const state = createPoll<SpotifyState>(
    {
      title: "No hay reproducción",
      artist: "",
      status: "Detenido",
      totalSec: 0,
      currentSec: 0,
      artPath: fallbackCover,
    },
    1000,
    async () => {
      try {
        const out = await execAsync(`bash -lc '
meta=$(playerctl -p spotify metadata --format "{{title}}|||{{artist}}|||{{mpris:length}}|||{{mpris:artUrl}}" 2>/dev/null || echo "|||0||")
status=$(playerctl -p spotify status 2>/dev/null || echo "Stopped")
pos=$(playerctl -p spotify position 2>/dev/null || echo "0")
printf "%s|||%s|||%s" "$meta" "$status" "$pos"
'`)

        const parts = out.split("|||")
        const title = (parts[0] || "").trim() || "No hay reproducción"
        const artist = (parts[1] || "").trim()
        const micros = Number((parts[2] || "0").trim())
        const artUrl = (parts[3] || "").trim()
        const status = (parts[4] || "Stopped").trim()
        const currentSec = parseFloatSafe(parts[5] || "0")

        const totalSec = Number.isFinite(micros) && micros > 0 ? micros / 1_000_000 : 0

        let artPath = fallbackCover
        if (artUrl === lastArtUrl) {
          artPath = artUrl.startsWith("http") ? cachedCover : await resolveArtPath(artUrl)
          if (!artPath) artPath = fallbackCover
        } else {
          artPath = await resolveArtPath(artUrl)
          lastArtUrl = artUrl
        }

        return { title, artist, status, totalSec, currentSec, artPath }
      } catch {
        return {
          title: "No hay reproducción",
          artist: "",
          status: "Detenido",
          totalSec: 0,
          currentSec: 0,
          artPath: fallbackCover,
        }
      }
    },
  )

  const progressText = state((s) => {
    if (s.totalSec <= 0) return "◉───────────"
    const slots = 12
    const ratio = Math.max(0, Math.min(1, s.currentSec / s.totalSec))
    const head = Math.min(slots - 1, Math.floor(ratio * slots))
    return `${"━".repeat(head)}◉${"─".repeat(Math.max(0, slots - head - 1))}`
  })

  const progressTime = state((s) => `${formatTime(s.currentSec)} / ${formatTime(s.totalSec)}`)

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
            <image file={state((s) => s.artPath)} cssName="spotifyCover" widthRequest={88} heightRequest={88} />
          </box>

          <box orientation={Gtk.Orientation.VERTICAL} spacing={6} hexpand>
            <box spacing={8} halign={Gtk.Align.FILL}>
              <label label=" Spotify" cssName="spotifyPopupHeading" hexpand xalign={0} />
              <label label={state((s) => statusLabel(s.status))} cssName="spotifyPopupStatus" />
            </box>

            <label label={state((s) => s.title)} wrap maxWidthChars={30} cssName="spotifyPopupTrack" xalign={0} />
            <label label={state((s) => (s.artist ? `por ${s.artist}` : ""))} cssName="spotifyPopupArtist" xalign={0} />

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
