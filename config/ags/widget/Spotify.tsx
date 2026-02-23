import app from "ags/gtk4/app"
import { Astal, Gdk, Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { createPoll } from "ags/time"
import { extractSpotifyTrackId, shellQuoted } from "../lib/spotify"
import {
  readLikeStatus,
  resolveAccentClass,
  startSpotifyPkceLogin,
  toggleLike,
} from "../lib/spotifyApi"

type SpotifyState = {
  title: string
  artist: string
  status: string
  totalSec: number
  currentSec: number
  artPath: string
  trackUrl: string
  trackId: string
  shuffleOn: boolean
  liked: boolean
  apiAuthorized: boolean
  apiBusy: boolean
  apiMessage: string
  accentClass: string
}

const POPUP_LAYOUT: "horizontal" | "vertical" = "vertical"
const COVER_WRAP_SIZE = 188
const COVER_IMAGE_SIZE = 184
const POPUP_PADDING = 14
const POPUP_WIDTH_REQUEST =
  POPUP_LAYOUT === "vertical" ? COVER_WRAP_SIZE + POPUP_PADDING * 2 : 520

const MARQUEE_TICK_MS = 110
const POPUP_TITLE_WIDTH = POPUP_LAYOUT === "vertical" ? 24 : 34
const POPUP_ARTIST_WIDTH = POPUP_LAYOUT === "vertical" ? 26 : 38
const LIKE_REFRESH_MS = 4500
const MANUAL_MESSAGE_TTL_MS = 4200
const LIKE_OVERRIDE_TTL_MS = 7000
const AUTH_OVERRIDE_TTL_MS = 15_000
const SHUFFLE_OVERRIDE_TTL_MS = 3_200
const DEFAULT_ACCENT_CLASS = "spotify-accent-default"

const EMPTY_STATE: SpotifyState = {
  title: "No hay reproducción",
  artist: "",
  status: "Stopped",
  totalSec: 0,
  currentSec: 0,
  artPath: "",
  trackUrl: "",
  trackId: "",
  shuffleOn: false,
  liked: false,
  apiAuthorized: false,
  apiBusy: false,
  apiMessage: "",
  accentClass: DEFAULT_ACCENT_CLASS,
}

let lastResolvedArtPath = ""

let apiBusyFlag = false
let likeCacheTrackId = ""
let likeCacheLiked = false
let likeCacheAuthorized = false
let likeCacheMessage = ""
let likeCacheCheckedAt = 0

let manualMessage = ""
let manualMessageUntil = 0

let likeOverrideTrackId = ""
let likeOverrideValue: boolean | null = null
let likeOverrideUntil = 0

let authOverrideValue: boolean | null = null
let authOverrideUntil = 0

let shuffleOverrideValue: boolean | null = null
let shuffleOverrideUntil = 0

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

function parseShuffle(raw: string) {
  const normalized = raw.trim().toLowerCase()
  return normalized === "on" || normalized === "true" || normalized === "1"
}

function artCachePathFor(url: string) {
  let hash = 0
  for (let i = 0; i < url.length; i++) {
    hash = (hash * 31 + url.charCodeAt(i)) >>> 0
  }
  return `/tmp/ags-spotify-cover-${hash}.jpg`
}

async function fileExists(path: string) {
  if (!path) return false
  try {
    const checkCommand = `[ -f ${shellQuoted(path)} ] && echo yes || echo no`
    const out = await execAsync(`bash -lc ${shellQuoted(checkCommand)}`)
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
        const curlCommand =
          `curl -L --silent --show-error --max-time 6 ` +
          `--output ${shellQuoted(target)} -- ${shellQuoted(url)}`
        await execAsync(`bash -lc ${shellQuoted(curlCommand)}`)
      } catch {
        return lastResolvedArtPath || ""
      }
    }
    lastResolvedArtPath = target
    return target
  }

  return lastResolvedArtPath || ""
}

function nowMs() {
  return Date.now()
}

function isManualMessageActive(now: number) {
  return manualMessage.trim().length > 0 && now < manualMessageUntil
}

function currentManualMessage(now: number) {
  if (!isManualMessageActive(now)) return ""
  return manualMessage
}

function setManualMessage(message: string, ttlMs = MANUAL_MESSAGE_TTL_MS) {
  manualMessage = message.trim()
  manualMessageUntil = nowMs() + ttlMs
}

function setLikeOverride(trackId: string, liked: boolean) {
  likeOverrideTrackId = trackId
  likeOverrideValue = liked
  likeOverrideUntil = nowMs() + LIKE_OVERRIDE_TTL_MS
}

function setAuthOverride(authorized: boolean) {
  authOverrideValue = authorized
  authOverrideUntil = nowMs() + AUTH_OVERRIDE_TTL_MS
}

function setShuffleOverride(enabled: boolean) {
  shuffleOverrideValue = enabled
  shuffleOverrideUntil = nowMs() + SHUFFLE_OVERRIDE_TTL_MS
}

function clearExpiredEphemeralState(trackId: string, now: number) {
  if (now >= manualMessageUntil) {
    manualMessage = ""
  }

  if (likeOverrideValue !== null) {
    if (now >= likeOverrideUntil || likeOverrideTrackId !== trackId) {
      likeOverrideTrackId = ""
      likeOverrideValue = null
      likeOverrideUntil = 0
    }
  }

  if (authOverrideValue !== null && now >= authOverrideUntil) {
    authOverrideValue = null
    authOverrideUntil = 0
  }

  if (shuffleOverrideValue !== null && now >= shuffleOverrideUntil) {
    shuffleOverrideValue = null
    shuffleOverrideUntil = 0
  }
}

function notifyUser(title: string, body: string) {
  const cleanTitle = title.trim() || "Spotify"
  const cleanBody = body.trim()
  if (!cleanBody) return

  const command = `notify-send ${shellQuoted(cleanTitle)} ${shellQuoted(cleanBody)}`
  execAsync(`bash -lc ${shellQuoted(command)}`).catch(() => {})
}

function buildPopupClass(state: SpotifyState) {
  let className = `spotifyPopupCardShell spotify-layout-${POPUP_LAYOUT} ${state.accentClass || DEFAULT_ACCENT_CLASS}`
  if (state.apiBusy) className += " spotify-api-busy"
  return className
}

function readBindingValue<T>(binding: any, fallback: T): T {
  try {
    if (binding && typeof binding.peek === "function")
      return binding.peek() as T
    if (typeof binding === "function") return binding() as T
  } catch {}
  return fallback
}

export default function SpotifyPopup() {
  let windowRef: any = null

  const closePopup = () => {
    if (!windowRef) return
    windowRef.visible = false
  }

  const state = createPoll<SpotifyState>(EMPTY_STATE, 1200, async () => {
    try {
      const snapshot = await execAsync(`bash -lc '
title=$(playerctl -p spotify metadata --format "{{title}}" 2>/dev/null || echo "")
artist=$(playerctl -p spotify metadata --format "{{artist}}" 2>/dev/null || echo "")
length=$(playerctl -p spotify metadata --format "{{mpris:length}}" 2>/dev/null || echo "0")
art=$(playerctl -p spotify metadata --format "{{mpris:artUrl}}" 2>/dev/null || echo "")
status=$(playerctl -p spotify status 2>/dev/null || echo "Stopped")
pos=$(playerctl -p spotify position 2>/dev/null || echo "0")
url=$(playerctl -p spotify metadata --format "{{xesam:url}}" 2>/dev/null || echo "")
mpristrack=$(playerctl -p spotify metadata --format "{{mpris:trackid}}" 2>/dev/null || echo "")
shuffle=$(playerctl -p spotify shuffle 2>/dev/null || echo "Off")
printf "%s\n%s\n%s\n%s\n%s\n%s\n%s\n%s\n%s" "$title" "$artist" "$length" "$art" "$status" "$pos" "$url" "$mpristrack" "$shuffle"
'`)

      const [
        titleRaw = "",
        artistRaw = "",
        lenRaw = "0",
        artUrlRaw = "",
        statusRaw = "Stopped",
        posRaw = "0",
        trackUrlRaw = "",
        mprisTrackIdRaw = "",
        shuffleRaw = "Off",
      ] = snapshot.split("\n").map((value) => value.trim())

      const micros = Number(lenRaw)
      const totalSec =
        Number.isFinite(micros) && micros > 0 ? micros / 1_000_000 : 0
      const currentSec = parseFloatSafe(posRaw)
      const status = statusRaw || "Stopped"
      const trackUrl = trackUrlRaw
      const trackId = extractSpotifyTrackId(trackUrlRaw, mprisTrackIdRaw)

      const artPath = await resolveArtPath(artUrlRaw)
      const accentClass = await resolveAccentClass(artPath)

      const now = nowMs()
      clearExpiredEphemeralState(trackId, now)

      let shuffleOn = parseShuffle(shuffleRaw)
      if (shuffleOverrideValue !== null && now < shuffleOverrideUntil) {
        shuffleOn = shuffleOverrideValue
      }

      if (trackId && likeCacheTrackId !== trackId) {
        likeCacheTrackId = trackId
        likeCacheCheckedAt = 0
        likeCacheLiked = false
        likeCacheMessage = ""
      }

      if (
        trackId &&
        !apiBusyFlag &&
        (likeCacheTrackId !== trackId ||
          now - likeCacheCheckedAt >= LIKE_REFRESH_MS)
      ) {
        const likeState = await readLikeStatus(trackId)
        likeCacheTrackId = trackId
        likeCacheLiked = likeState.liked
        likeCacheAuthorized = likeState.authorized
        likeCacheCheckedAt = now
        if (likeState.message) likeCacheMessage = likeState.message
      }

      let liked =
        trackId && likeCacheTrackId === trackId
          ? likeCacheLiked
          : likeOverrideValue === true
      if (
        likeOverrideValue !== null &&
        likeOverrideTrackId === trackId &&
        now < likeOverrideUntil
      ) {
        liked = likeOverrideValue
      }

      let apiAuthorized = likeCacheAuthorized
      if (authOverrideValue !== null && now < authOverrideUntil) {
        apiAuthorized = authOverrideValue
      }

      const apiMessage = currentManualMessage(now) || likeCacheMessage

      return {
        title: titleRaw || "No hay reproducción",
        artist: artistRaw,
        status,
        totalSec,
        currentSec,
        artPath,
        trackUrl,
        trackId,
        shuffleOn,
        liked,
        apiAuthorized,
        apiBusy: apiBusyFlag,
        apiMessage,
        accentClass,
      }
    } catch {
      const now = nowMs()
      const apiMessage = currentManualMessage(now) || likeCacheMessage
      const fallbackAuthorized =
        authOverrideValue !== null && now < authOverrideUntil
          ? authOverrideValue
          : likeCacheAuthorized

      return {
        ...EMPTY_STATE,
        artPath: lastResolvedArtPath || "",
        apiAuthorized: fallbackAuthorized,
        liked: likeOverrideValue === true,
        apiBusy: apiBusyFlag,
        apiMessage,
        accentClass: DEFAULT_ACCENT_CLASS,
      }
    }
  })

  const progressFraction = state((s) => {
    if (s.totalSec <= 0) return 0
    return Math.max(0, Math.min(1, s.currentSec / s.totalSec))
  })

  const marqueeTick = createPoll(0, MARQUEE_TICK_MS, (prev) => prev + 1)

  const marqueeTitle = marqueeTick((tick) =>
    marqueeText(
      state().title || "No hay reproducción",
      tick,
      POPUP_TITLE_WIDTH,
    ),
  )

  const marqueeArtist = marqueeTick((tick) =>
    marqueeText(state().artist || "", tick, POPUP_ARTIST_WIDTH),
  )

  const withApiAction = async (runner: () => Promise<void>) => {
    if (apiBusyFlag) return
    apiBusyFlag = true
    try {
      await runner()
    } finally {
      apiBusyFlag = false
    }
  }

  const toggleShuffle = async () => {
    await withApiAction(async () => {
      try {
        await execAsync("playerctl -p spotify shuffle Toggle")
        const nextRaw = await execAsync("playerctl -p spotify shuffle")
        const enabled = parseShuffle(nextRaw)
        setShuffleOverride(enabled)
        const message = enabled ? "Shuffle activado" : "Shuffle desactivado"
        setManualMessage(message)
        notifyUser("Spotify", message)
      } catch {
        const message = "No se pudo cambiar shuffle"
        setManualMessage(message)
        notifyUser("Spotify", message)
      }
    })
  }

  const connectSpotifyApi = async () => {
    await withApiAction(async () => {
      const result = await startSpotifyPkceLogin()
      setManualMessage(result.message)
      setAuthOverride(result.ok)
      likeCacheCheckedAt = 0
      if (result.ok) likeCacheAuthorized = true
      notifyUser("Spotify API", result.message)
    })
  }

  const toggleLikeTrack = async () => {
    const current = readBindingValue(state, EMPTY_STATE)
    if (!current.trackId) {
      const message = "No hay track válido para favoritos"
      setManualMessage(message)
      notifyUser("Spotify", message)
      return
    }

    await withApiAction(async () => {
      const result = await toggleLike(current.trackId)
      setManualMessage(result.message)
      setAuthOverride(result.authorized)

      if (result.authorized) {
        likeCacheAuthorized = true
        likeCacheTrackId = current.trackId
        likeCacheLiked = result.liked
        likeCacheCheckedAt = nowMs()
        setLikeOverride(current.trackId, result.liked)
      } else {
        likeCacheAuthorized = false
      }

      notifyUser("Spotify", result.message)
    })
  }

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
      $={(window: any) => {
        windowRef = window

        const keyController = new Gtk.EventControllerKey()
        keyController.connect("key-pressed", (_: any, keyval: number) => {
          if (keyval === Gdk.KEY_Escape) {
            closePopup()
            return true
          }
          return false
        })

        window.add_controller(keyController)
      }}
    >
      <box
        orientation={
          POPUP_LAYOUT === "vertical"
            ? Gtk.Orientation.VERTICAL
            : Gtk.Orientation.HORIZONTAL
        }
        spacing={POPUP_LAYOUT === "vertical" ? 10 : 16}
        cssName="spotifyPopupCard"
        class={state((s) => buildPopupClass(s))}
        widthRequest={POPUP_WIDTH_REQUEST}
      >
        <box
          cssName="spotifyCoverWrap"
          class="spotifyCoverWrap"
          valign={Gtk.Align.START}
          halign={
            POPUP_LAYOUT === "vertical" ? Gtk.Align.CENTER : Gtk.Align.START
          }
        >
          <image
            visible={state((s) => !!s.artPath)}
            file={state((s) => s.artPath)}
            cssName="spotifyCover"
            class="spotifyCover"
            pixelSize={COVER_IMAGE_SIZE}
          />
          <label
            visible={state((s) => !s.artPath)}
            label=""
            cssName="spotifyCoverFallback"
            class="spotifyCoverFallback"
          />
        </box>

        <box
          orientation={Gtk.Orientation.VERTICAL}
          spacing={4}
          hexpand={POPUP_LAYOUT !== "vertical"}
          class="spotifyMainColumn"
        >
          <box spacing={8} class="spotifyHeaderRow">
            <label
              label=" Spotify"
              cssName="spotifyPopupHeading"
              class="spotifyPopupHeading"
              hexpand
              xalign={0}
            />
            <label
              label={state((s) => statusLabel(s.status))}
              cssName="spotifyPopupStatus"
              class="spotifyPopupStatus"
            />
          </box>

          <label
            label={marqueeTitle}
            wrap={false}
            singleLineMode
            widthChars={POPUP_TITLE_WIDTH}
            maxWidthChars={POPUP_TITLE_WIDTH}
            cssName="spotifyPopupTrack"
            class="spotifyPopupTrack"
            xalign={0}
          />
          <label
            label={marqueeArtist}
            wrap={false}
            singleLineMode
            widthChars={POPUP_ARTIST_WIDTH}
            maxWidthChars={POPUP_ARTIST_WIDTH}
            cssName="spotifyPopupArtist"
            class="spotifyPopupArtist"
            xalign={0}
          />

          <box
            orientation={Gtk.Orientation.VERTICAL}
            spacing={2}
            cssName="spotifyProgressGroup"
            class="spotifyProgressGroup"
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
                class="spotifyProgressTime"
                hexpand
                xalign={0}
              />
              <label
                label={state((s) => formatTime(s.totalSec))}
                cssName="spotifyProgressTime"
                class="spotifyProgressTime"
                xalign={1}
              />
            </box>
          </box>

          <box
            spacing={8}
            cssName="spotifyPopupControls"
            class="spotifyPrimaryControls"
            halign={Gtk.Align.FILL}
          >
            <button
              class="spotify-primary-btn"
              hexpand
              onClicked={() =>
                execAsync("playerctl -p spotify previous").catch(() => {})
              }
            >
              <label label="⏮" />
            </button>
            <button
              class="spotify-primary-btn spotifyPlayButton"
              hexpand
              onClicked={() =>
                execAsync("playerctl -p spotify play-pause").catch(() => {})
              }
            >
              <label label="⏯" />
            </button>
            <button
              class="spotify-primary-btn"
              hexpand
              onClicked={() =>
                execAsync("playerctl -p spotify next").catch(() => {})
              }
            >
              <label label="⏭" />
            </button>
          </box>

          <box spacing={8} class="spotifyUtilityControls">
            <button
              class={state((s) =>
                s.shuffleOn
                  ? "spotify-action-btn spotify-action-active"
                  : "spotify-action-btn",
              )}
              hexpand
              sensitive={state((s) => !s.apiBusy)}
              onClicked={toggleShuffle}
            >
              <label label="Shuffle" />
            </button>

            <button
              visible={state((s) => s.apiAuthorized)}
              class={state((s) =>
                s.liked
                  ? "spotify-action-btn spotify-like-active"
                  : "spotify-action-btn",
              )}
              hexpand
              sensitive={state((s) => !s.apiBusy && !!s.trackId)}
              onClicked={toggleLikeTrack}
            >
              <label label={state((s) => (s.liked ? "❤ Like" : "♡ Like"))} />
            </button>

            <button
              class="spotifyConnectButton"
              visible={state((s) => !s.apiAuthorized)}
              hexpand
              sensitive={state((s) => !s.apiBusy)}
              onClicked={connectSpotifyApi}
            >
              <label label="Conectar" />
            </button>
          </box>
        </box>
      </box>
    </window>
  )
}
