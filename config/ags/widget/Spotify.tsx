import app from "ags/gtk4/app"
import { Astal, Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { createPoll } from "ags/time"

const fallbackCover = "/usr/share/icons/hicolor/128x128/apps/spotify-client.png"
const cachedCover = "/tmp/ags-spotify-cover.jpg"

type SpotifyState = {
  title: string
  artist: string
  status: string
  totalSec: number
  currentSec: number
  artPath: string
}

let lastArtUrl = ""

function formatTime(seconds: number) {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

function parseFloatSafe(raw: string) {
  const n = Number((raw || "").trim().replace(",", "."))
  return Number.isFinite(n) ? n : 0
}

function statusLabel(status: string) {
  if (status === "Playing") return "Reproduciendo"
  if (status === "Paused") return "Pausado"
  return "Detenido"
}

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
    if (url !== lastArtUrl) {
      try {
        await execAsync(`bash -lc 'curl -L --silent --show-error --max-time 4 --output "${cachedCover}" -- "${url}"'`)
        lastArtUrl = url
      } catch {
        return fallbackCover
      }
    }
    return cachedCover
  }

  return fallbackCover
}

export default function SpotifyPopup() {
  const state = createPoll<SpotifyState>(
    {
      title: "No hay reproducción",
      artist: "",
      status: "Stopped",
      totalSec: 0,
      currentSec: 0,
      artPath: fallbackCover,
    },
    1800,
    async () => {
      try {
        const snapshot = await execAsync(`bash -lc '
title=$(playerctl -p spotify metadata --format "{{title}}" 2>/dev/null || echo "")
artist=$(playerctl -p spotify metadata --format "{{artist}}" 2>/dev/null || echo "")
length=$(playerctl -p spotify metadata --format "{{mpris:length}}" 2>/dev/null || echo "0")
art=$(playerctl -p spotify metadata --format "{{mpris:artUrl}}" 2>/dev/null || echo "")
status=$(playerctl -p spotify status 2>/dev/null || echo "Stopped")
pos=$(playerctl -p spotify position 2>/dev/null || echo "0")
printf "%s\n%s\n%s\n%s\n%s\n%s" "$title" "$artist" "$length" "$art" "$status" "$pos"
'`)

        const [titleRaw = "", artistRaw = "", lenRaw = "0", artUrlRaw = "", statusRaw = "Stopped", posRaw = "0"] = snapshot
          .split("\n")
          .map((v) => v.trim())

        const title = titleRaw.trim() || "No hay reproducción"
        const artist = artistRaw.trim()
        const status = statusRaw.trim() || "Stopped"
        const micros = Number(lenRaw.trim())
        const totalSec = Number.isFinite(micros) && micros > 0 ? micros / 1_000_000 : 0
        const currentSec = parseFloatSafe(posRaw)
        const artPath = await resolveArtPath(artUrlRaw)

        return { title, artist, status, totalSec, currentSec, artPath }
      } catch {
        return {
          title: "No hay reproducción",
          artist: "",
          status: "Stopped",
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
      <box orientation={Gtk.Orientation.VERTICAL} spacing={10} cssName="spotifyPopupCard" widthRequest={360}>
        <box spacing={10}>
          <box cssName="spotifyCoverWrap" valign={Gtk.Align.START}>
            <image file={state((s) => s.artPath)} cssName="spotifyCover" widthRequest={92} heightRequest={92} />
          </box>

          <box orientation={Gtk.Orientation.VERTICAL} spacing={4}>
            <box spacing={8} halign={Gtk.Align.FILL}>
              <label label="Spotify" cssName="spotifyPopupHeading" hexpand xalign={0} />
              <label label={state((s) => statusLabel(s.status))} cssName="spotifyPopupStatus" />
            </box>

            <label label={state((s) => s.title)} wrap maxWidthChars={24} cssName="spotifyPopupTrack" xalign={0} />
            <label label={state((s) => (s.artist ? `por ${s.artist}` : ""))} cssName="spotifyPopupArtist" xalign={0} />

            <box orientation={Gtk.Orientation.VERTICAL} spacing={2}>
              <label label={progressText} cssName="spotifyProgressWave" xalign={0} />
              <label label={progressTime} cssName="spotifyProgressTime" xalign={0} />
            </box>
          </box>
        </box>

        <box spacing={10} cssName="spotifyPopupControls" halign={Gtk.Align.CENTER}>
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
