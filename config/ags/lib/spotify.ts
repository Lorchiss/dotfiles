import { execAsync } from "ags/process"

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

export async function openSpotifyApp(): Promise<void> {
  await execAsync(
    `bash -lc '
launch_cmd=""
if command -v spotify >/dev/null 2>&1; then
  launch_cmd="exec spotify"
elif command -v gtk-launch >/dev/null 2>&1; then
  launch_cmd="exec gtk-launch spotify"
else
  launch_cmd="exec xdg-open spotify:"
fi

if command -v systemd-run >/dev/null 2>&1; then
  unit="ags-open-spotify-$(date +%s%N)"
  systemd-run --user --quiet --collect --unit "$unit" bash -lc "$launch_cmd" >/dev/null 2>&1 || true
else
  bash -lc "$launch_cmd" >/dev/null 2>&1 &
fi
'`,
  ).catch(() => {})
}

function trackIdFromUrl(urlRaw: string): string {
  const url = urlRaw.trim()
  if (!url) return ""

  const fromWeb = url.match(/open\.spotify\.com\/track\/([A-Za-z0-9]{22})/)
  if (fromWeb?.[1]) return fromWeb[1]

  const fromUri = url.match(/spotify:track:([A-Za-z0-9]{22})/)
  if (fromUri?.[1]) return fromUri[1]

  return ""
}

function trackIdFromMprisTrackId(trackIdRaw: string): string {
  const trackId = trackIdRaw.trim()
  if (!trackId) return ""

  const fromPath = trackId.match(/\/com\/spotify\/track\/([A-Za-z0-9]{22})/)
  if (fromPath?.[1]) return fromPath[1]

  const fromUri = trackId.match(/spotify:track:([A-Za-z0-9]{22})/)
  if (fromUri?.[1]) return fromUri[1]

  return ""
}

export function extractSpotifyTrackId(
  xesamUrl: string,
  mprisTrackId: string,
): string {
  const fromUrl = trackIdFromUrl(xesamUrl)
  if (fromUrl) return fromUrl
  return trackIdFromMprisTrackId(mprisTrackId)
}

export function shellQuoted(value: string): string {
  return shellQuote(value)
}
