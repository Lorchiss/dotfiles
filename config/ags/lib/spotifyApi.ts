import { execAsync } from "ags/process"
import { shellQuoted } from "./spotify"

const DEFAULT_ACCENT_CLASS = "spotify-accent-default"
const SPOTIFY_API_SCRIPT = `${SRC}/scripts/spotify_api.py`
const accentCache = new Map<string, string>()

type LoginResult = {
  ok: boolean
  message: string
}

type LikeStatusResult = {
  authorized: boolean
  liked: boolean
  message?: string
}

type ToggleLikeResult = {
  authorized: boolean
  liked: boolean
  message: string
}

function parseJsonOutput(raw: string): Record<string, unknown> {
  const trimmed = raw.trim()
  if (!trimmed) return {}

  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && typeof parsed === "object")
      return parsed as Record<string, unknown>
  } catch {}

  const lastLine = trimmed
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .pop()
  if (!lastLine) return {}

  try {
    const parsed = JSON.parse(lastLine)
    if (parsed && typeof parsed === "object")
      return parsed as Record<string, unknown>
  } catch {}

  return {}
}

async function runSpotifyApi(args: string[]): Promise<Record<string, unknown>> {
  const joinedArgs = args.map((arg) => shellQuoted(arg)).join(" ")
  const command =
    `script_path=${shellQuoted(SPOTIFY_API_SCRIPT)}; ` +
    `if [ ! -f "$script_path" ]; then script_path="$HOME/.config/ags/scripts/spotify_api.py"; fi; ` +
    `python3 "$script_path" ${joinedArgs}`

  try {
    const output = await execAsync(`bash -lc ${shellQuoted(command)}`)
    return parseJsonOutput(output)
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo ejecutar spotify_api.py"
    return {
      ok: false,
      message,
      authorized: false,
      liked: false,
      accentClass: DEFAULT_ACCENT_CLASS,
    }
  }
}

export async function startSpotifyPkceLogin(): Promise<LoginResult> {
  const result = await runSpotifyApi(["login"])
  return {
    ok: result.ok === true,
    message:
      typeof result.message === "string" && result.message.trim()
        ? result.message
        : result.ok === true
          ? "Spotify API conectada"
          : "No se pudo iniciar la conexión con Spotify",
  }
}

export async function readLikeStatus(
  trackId: string,
): Promise<LikeStatusResult> {
  const cleanTrackId = trackId.trim()
  if (!cleanTrackId) {
    return { authorized: false, liked: false, message: "Track inválido" }
  }

  const result = await runSpotifyApi([
    "like-status",
    "--track-id",
    cleanTrackId,
  ])
  return {
    authorized: result.authorized === true,
    liked: result.liked === true,
    message: typeof result.message === "string" ? result.message : undefined,
  }
}

export async function toggleLike(trackId: string): Promise<ToggleLikeResult> {
  const cleanTrackId = trackId.trim()
  if (!cleanTrackId) {
    return {
      authorized: false,
      liked: false,
      message: "Track inválido para favoritos",
    }
  }

  const result = await runSpotifyApi([
    "toggle-like",
    "--track-id",
    cleanTrackId,
  ])
  return {
    authorized: result.authorized === true,
    liked: result.liked === true,
    message:
      typeof result.message === "string" && result.message.trim()
        ? result.message
        : "No se pudo actualizar favoritos",
  }
}

function cacheAccent(path: string, accentClass: string) {
  accentCache.set(path, accentClass)
  if (accentCache.size <= 96) return

  const oldestKey = accentCache.keys().next().value
  if (typeof oldestKey === "string") accentCache.delete(oldestKey)
}

export async function resolveAccentClass(coverPath: string): Promise<string> {
  const cleanPath = coverPath.trim()
  if (!cleanPath) return DEFAULT_ACCENT_CLASS

  const cached = accentCache.get(cleanPath)
  if (cached) return cached

  const result = await runSpotifyApi(["accent", "--cover", cleanPath])
  const accentClass =
    typeof result.accentClass === "string" && result.accentClass.trim()
      ? result.accentClass
      : DEFAULT_ACCENT_CLASS

  cacheAccent(cleanPath, accentClass)
  return accentClass
}
