import app from "ags/gtk4/app"
import { Astal, Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { createPoll } from "ags/time"

type SpotifyState = {
  title: string
  artist: string
  status: string
  totalSec: number
  currentSec: number
  artPath: string
}

let lastResolvedArtPath = ""

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

function artCachePathFor(url: string) {
  let hash = 0
  for (let i = 0; i < url.length; i++)
    hash = (hash * 31 + url.charCodeAt(i)) >>> 0
  return `/tmp/ags-spotify-cover-${hash}.jpg`
}

async function fileExists(path: string) {
  if (!path) return false
  try {
    const out = await execAsync(
      `bash -lc '[ -f "${path}" ] && echo yes || echo no'`,
    )
    return out.trim() === "yes"
  } catch {
    return false
  }
}

async function resolveArtPath(url: string) {
  if (!url) return lastResolvedArtPath || ""

  if (url.startsWith("file://")) {
    const localPath = decodeURIComponent(url.replace("file://", ""))
    if (await fileExists(localPath)) {
      lastResolvedArtPath = localPath
      return localPath
    }
    return lastResolvedArtPath || ""
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    const target = artCachePathFor(url)
    if (!(await fileExists(target))) {
      try {
        await execAsync(
          `bash -lc 'curl -L --silent --show-error --max-time 5 --output "${target}" -- "${url}"'`,
        )
      } catch {
        return lastResolvedArtPath || ""
      }
    }
    lastResolvedArtPath = target
    return target
  }

  return lastResolvedArtPath || ""
}

export default function SpotifyPopup() {
  const state = createPoll<SpotifyState>(
    {
      title: "No hay reproducción",
      artist: "",
      status: "Stopped",
      totalSec: 0,
      currentSec: 0,
      artPath: "",
    },
    1200,
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

        const [
          titleRaw = "",
          artistRaw = "",
          lenRaw = "0",
          artUrlRaw = "",
          statusRaw = "Stopped",
          posRaw = "0",
        ] = snapshot.split("\n").map((v) => v.trim())

        const micros = Number(lenRaw)
        const totalSec =
          Number.isFinite(micros) && micros > 0 ? micros / 1_000_000 : 0
        const currentSec = parseFloatSafe(posRaw)
        const status = statusRaw || "Stopped"

        return {
          title: titleRaw || "No hay reproducción",
          artist: artistRaw,
          status,
          totalSec,
          currentSec,
          artPath: await resolveArtPath(artUrlRaw),
        }
      } catch {
        return {
          title: "No hay reproducción",
          artist: "",
          status: "Stopped",
          totalSec: 0,
          currentSec: 0,
          artPath: lastResolvedArtPath || "",
        }
      }
    },
  )

  const progressFraction = state((s) => {
    if (s.totalSec <= 0) return 0
    return Math.max(0, Math.min(1, s.currentSec / s.totalSec))
  })

  const progress = state((s) =>
    s.totalSec > 0 ? Math.max(0, Math.min(1, s.currentSec / s.totalSec)) : 0,
  )
  const marqueeTick = createPoll(0, 110, (prev) => prev + 1)
  const marqueeTitle = marqueeTick((tick) =>
    marqueeText(state().title || "No hay reproducción", tick, 30),
  )
  const marqueeArtist = marqueeTick((tick) =>
    marqueeText(state().artist || "", tick, 34),
  )

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
      <box
        orientation={Gtk.Orientation.VERTICAL}
        spacing={12}
        cssName="spotifyPopupCard"
        widthRequest={480}
      >
        <box spacing={16}>
          <box cssName="spotifyCoverWrap" valign={Gtk.Align.START}>
            <image
              visible={state((s) => !!s.artPath)}
              file={state((s) => s.artPath)}
              cssName="spotifyCover"
              pixelSize={128}
            />
            <label
              visible={state((s) => !s.artPath)}
              label=""
              cssName="spotifyCoverFallback"
            />
          </box>

          <box orientation={Gtk.Orientation.VERTICAL} spacing={8} hexpand>
            <box spacing={8}>
              <label
                label=" Spotify"
                cssName="spotifyPopupHeading"
                hexpand
                xalign={0}
              />
              <label
                label={state((s) => statusLabel(s.status))}
                cssName="spotifyPopupStatus"
              />
            </box>

            <label
              label={marqueeTitle}
              wrap={false}
              singleLineMode
              widthChars={30}
              maxWidthChars={30}
              cssName="spotifyPopupTrack"
              xalign={0}
            />
            <label
              label={marqueeArtist}
              wrap={false}
              singleLineMode
              widthChars={34}
              maxWidthChars={34}
              cssName="spotifyPopupArtist"
              xalign={0}
            />

            <box
              orientation={Gtk.Orientation.VERTICAL}
              spacing={4}
              cssName="spotifyProgressGroup"
            >
              <Gtk.ProgressBar
                fraction={progressFraction}
                hexpand
                class="spotifyProgressBar"
              />
              <box>
                <label
                  label={state((s) => formatTime(s.currentSec))}
                  cssName="spotifyProgressTime"
                  hexpand
                  xalign={0}
                />
                <label
                  label={state((s) => formatTime(s.totalSec))}
                  cssName="spotifyProgressTime"
                  xalign={1}
                />
              </box>
            </box>
          </box>
        </box>

        <box
          spacing={12}
          cssName="spotifyPopupControls"
          halign={Gtk.Align.CENTER}
        >
          <button
            onClicked={() =>
              execAsync("playerctl -p spotify previous").catch(() => {})
            }
          >
            <label label="⏮" />
          </button>
          <button
            class="spotifyPlayButton"
            onClicked={() =>
              execAsync("playerctl -p spotify play-pause").catch(() => {})
            }
          >
            <label label="⏯" />
          </button>
          <button
            onClicked={() =>
              execAsync("playerctl -p spotify next").catch(() => {})
            }
          >
            <label label="⏭" />
          </button>
        </box>
      </box>
    </window>
  )
}
