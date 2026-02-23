import { execAsync } from "ags/process"
import { openInTerminal } from "./terminal"

export type PowerProfile =
  | "power-saver"
  | "balanced"
  | "performance"
  | "unknown"

export type SystemState = {
  updatesCount: number | null
  maxTemperatureC: number | null
  powerProfile: PowerProfile
  powerProfileAvailable: boolean
}

function parseIntSafe(raw: string): number | null {
  const parsed = Number.parseInt(raw.trim(), 10)
  return Number.isFinite(parsed) ? parsed : null
}

function parseFloatSafe(raw: string): number | null {
  const parsed = Number.parseFloat(raw.trim().replace(",", "."))
  return Number.isFinite(parsed) ? parsed : null
}

export async function readSystemState(): Promise<SystemState> {
  const [updatesRaw, temperatureRaw, profileRaw] = await Promise.all([
    execAsync(
      `bash -lc "if command -v checkupdates >/dev/null 2>&1; then checkupdates 2>/dev/null | wc -l; else pacman -Qu 2>/dev/null | wc -l; fi"`,
    ).catch(() => ""),
    execAsync(`bash -lc '
max=0
for tempFile in /sys/class/thermal/thermal_zone*/temp; do
  [ -r "$tempFile" ] || continue
  value=$(cat "$tempFile" 2>/dev/null || echo 0)
  case "$value" in
    ''|*[!0-9]*) continue ;;
  esac
  if [ "$value" -gt "$max" ]; then max=$value; fi
done
if [ "$max" -gt 0 ]; then
  awk "BEGIN { printf \\"%.1f\\", $max / 1000 }"
fi
'`).catch(() => ""),
    execAsync(
      `bash -lc "if command -v powerprofilesctl >/dev/null 2>&1; then powerprofilesctl get 2>/dev/null; fi"`,
    ).catch(() => ""),
  ])

  const updatesCount = parseIntSafe(updatesRaw)
  const maxTemperatureC = parseFloatSafe(temperatureRaw)

  const cleanProfile = profileRaw.trim()
  const isKnownProfile =
    cleanProfile === "power-saver" ||
    cleanProfile === "balanced" ||
    cleanProfile === "performance"

  return {
    updatesCount,
    maxTemperatureC,
    powerProfile: isKnownProfile ? cleanProfile : "unknown",
    powerProfileAvailable: isKnownProfile,
  }
}

export async function setPowerProfile(profile: PowerProfile): Promise<void> {
  if (
    profile !== "power-saver" &&
    profile !== "balanced" &&
    profile !== "performance"
  ) {
    return
  }
  await execAsync(`bash -lc "powerprofilesctl set ${profile}"`)
}

export async function openUpdateTerminal(): Promise<void> {
  await openInTerminal(
    `echo "Actualización manual"; sudo pacman -Syu; echo; read -r -p "Enter para cerrar" _`,
  )
}
