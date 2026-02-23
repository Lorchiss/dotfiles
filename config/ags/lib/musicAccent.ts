import { execAsync } from "ags/process"
import { createPoll } from "ags/time"
import { shellQuoted } from "./spotify"
import { resolveAccentClass } from "./spotifyApi"

const DEFAULT_ACCENT_CLASS = "spotify-accent-default"
const DEFAULT_POLL_MS = 3600

function artCachePathFor(url: string) {
  let hash = 0
  for (let i = 0; i < url.length; i++) {
    hash = (hash * 31 + url.charCodeAt(i)) >>> 0
  }
  return `/tmp/ags-shared-cover-${hash}.jpg`
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

async function resolveArtPath(url: string, fallbackPath: string) {
  if (!url) return fallbackPath || ""

  if (url.startsWith("file://")) {
    const localPath = decodeURIComponent(url.replace("file://", ""))
    if (await fileExists(localPath)) return localPath
    return fallbackPath || ""
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
        return fallbackPath || ""
      }
    }

    if (await fileExists(target)) return target
    return fallbackPath || ""
  }

  return fallbackPath || ""
}

export function createMusicAccentClassState(pollMs = DEFAULT_POLL_MS) {
  let lastArtUrl = ""
  let lastArtPath = ""
  let lastAccentClass = DEFAULT_ACCENT_CLASS

  return createPoll<string>(DEFAULT_ACCENT_CLASS, pollMs, async () => {
    try {
      const rawArtUrl = await execAsync(
        `bash -lc "playerctl -p spotify metadata --format '{{mpris:artUrl}}' 2>/dev/null || echo ''"`,
      )
      const artUrl = rawArtUrl.trim()

      if (!artUrl) {
        lastArtUrl = ""
        lastArtPath = ""
        lastAccentClass = DEFAULT_ACCENT_CLASS
        return DEFAULT_ACCENT_CLASS
      }

      if (artUrl === lastArtUrl && lastAccentClass) return lastAccentClass

      const artPath = await resolveArtPath(artUrl, lastArtPath)
      lastArtUrl = artUrl

      if (!artPath) {
        lastArtPath = ""
        lastAccentClass = DEFAULT_ACCENT_CLASS
        return DEFAULT_ACCENT_CLASS
      }

      lastArtPath = artPath
      const accentClass = (await resolveAccentClass(artPath)).trim()
      lastAccentClass = accentClass || DEFAULT_ACCENT_CLASS
      return lastAccentClass
    } catch {
      return lastAccentClass || DEFAULT_ACCENT_CLASS
    }
  })
}
