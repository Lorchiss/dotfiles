import {
  createEmptyBatteryState,
  maybeNotifyLowBattery,
  readBatteryState,
  type BatteryStatus,
} from "./battery"
import { runCommand } from "./command"
import {
  markArchNewsAsRead,
  openLatestArchNews,
  openSnapperRollbackTerminal,
  openSystemUpdateTerminal,
  readArchNewsState,
  readSnapperAvailability,
  readUpdatesBreakdown,
  refreshUpdatesBreakdown,
} from "./maintenance"

export type PowerProfile =
  | "power-saver"
  | "balanced"
  | "performance"
  | "unknown"

export type SystemState = {
  updatesCount: number | null
  updatesOfficialCount: number | null
  updatesAurCount: number | null
  updatesAurEnabled: boolean
  maxTemperatureC: number | null
  powerProfile: PowerProfile
  powerProfileAvailable: boolean
  archNewsUnreadCount: number
  archNewsTitle: string
  archNewsLink: string
  archNewsPublishedAt: string
  snapperAvailable: boolean
  snapperStatusReason: string
  batteryAvailable: boolean
  batteryPercent: number | null
  batteryStatus: BatteryStatus
  batteryHealthPercent: number | null
  onAcPower: boolean | null
  powerWatts: number | null
  timeRemainingMinutes: number | null
}

type ReadSystemStateOptions = {
  includeUpdates?: boolean
  forceUpdatesRefresh?: boolean
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function parseFloatSafe(raw: string): number | null {
  const parsed = Number.parseFloat(raw.trim().replace(",", "."))
  return Number.isFinite(parsed) ? parsed : null
}

function normalizePowerProfile(raw: string): {
  powerProfile: PowerProfile
  powerProfileAvailable: boolean
} {
  const cleanProfile = raw.trim()
  if (
    cleanProfile === "power-saver" ||
    cleanProfile === "balanced" ||
    cleanProfile === "performance"
  ) {
    return {
      powerProfile: cleanProfile,
      powerProfileAvailable: true,
    }
  }

  return {
    powerProfile: "unknown",
    powerProfileAvailable: false,
  }
}

async function readMaxTemperatureC(): Promise<number | null> {
  const temperatureRaw = await runCommand(
    `
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
  awk "BEGIN { printf \\\"%.1f\\\", $max / 1000 }"
fi
`,
    { timeoutMs: 4000, allowFailure: true },
  )
  return parseFloatSafe(temperatureRaw)
}

async function readPowerProfileStatus(): Promise<{
  powerProfile: PowerProfile
  powerProfileAvailable: boolean
}> {
  const profileRaw = await runCommand(
    `if command -v powerprofilesctl >/dev/null 2>&1; then powerprofilesctl get 2>/dev/null; fi`,
    { timeoutMs: 2500, allowFailure: true },
  )
  return normalizePowerProfile(profileRaw)
}

export function createEmptySystemState(): SystemState {
  const battery = createEmptyBatteryState()

  return {
    updatesCount: null,
    updatesOfficialCount: null,
    updatesAurCount: null,
    updatesAurEnabled: false,
    maxTemperatureC: null,
    powerProfile: "unknown",
    powerProfileAvailable: false,
    archNewsUnreadCount: 0,
    archNewsTitle: "",
    archNewsLink: "",
    archNewsPublishedAt: "",
    snapperAvailable: false,
    snapperStatusReason: "snapper no disponible",
    batteryAvailable: battery.batteryAvailable,
    batteryPercent: battery.batteryPercent,
    batteryStatus: battery.batteryStatus,
    batteryHealthPercent: battery.batteryHealthPercent,
    onAcPower: battery.onAcPower,
    powerWatts: battery.powerWatts,
    timeRemainingMinutes: battery.timeRemainingMinutes,
  }
}

export async function readSystemState(
  options: ReadSystemStateOptions = {},
): Promise<SystemState> {
  const includeUpdates = options.includeUpdates !== false
  const forceUpdatesRefresh = options.forceUpdatesRefresh === true

  const [
    updatesBreakdown,
    maxTemperatureC,
    powerProfileStatus,
    archNews,
    snapper,
    battery,
  ] = await Promise.all([
    includeUpdates
      ? readUpdatesBreakdown({ forceRefresh: forceUpdatesRefresh })
      : Promise.resolve({
          official: null,
          aur: null,
          total: null,
          aurEnabled: false,
        }),
    readMaxTemperatureC(),
    readPowerProfileStatus(),
    readArchNewsState({ forceRefresh: forceUpdatesRefresh }),
    readSnapperAvailability(),
    readBatteryState(),
  ])

  await maybeNotifyLowBattery(battery)

  return {
    updatesCount: includeUpdates ? updatesBreakdown.total : null,
    updatesOfficialCount: includeUpdates ? updatesBreakdown.official : null,
    updatesAurCount: includeUpdates ? updatesBreakdown.aur : null,
    updatesAurEnabled: includeUpdates ? updatesBreakdown.aurEnabled : false,
    maxTemperatureC,
    powerProfile: powerProfileStatus.powerProfile,
    powerProfileAvailable: powerProfileStatus.powerProfileAvailable,
    archNewsUnreadCount: archNews.unreadCount,
    archNewsTitle: archNews.latestTitle,
    archNewsLink: archNews.latestLink,
    archNewsPublishedAt: archNews.latestPublishedAt,
    snapperAvailable: snapper.snapperAvailable,
    snapperStatusReason: snapper.reason,
    batteryAvailable: battery.batteryAvailable,
    batteryPercent: battery.batteryPercent,
    batteryStatus: battery.batteryStatus,
    batteryHealthPercent: battery.batteryHealthPercent,
    onAcPower: battery.onAcPower,
    powerWatts: battery.powerWatts,
    timeRemainingMinutes: battery.timeRemainingMinutes,
  }
}

export async function refreshSystemUpdatesCache(): Promise<number | null> {
  const [updates] = await Promise.all([
    refreshUpdatesBreakdown(),
    readArchNewsState({ forceRefresh: true }),
  ])

  return updates.total
}

export async function setPowerProfile(profile: PowerProfile): Promise<void> {
  if (
    profile !== "power-saver" &&
    profile !== "balanced" &&
    profile !== "performance"
  ) {
    return
  }

  await runCommand(`powerprofilesctl set ${shellQuote(profile)}`, {
    timeoutMs: 5000,
  })
}

export async function openUpdateTerminal(): Promise<void> {
  await openSystemUpdateTerminal()
}

export async function openRollbackTerminal(): Promise<void> {
  await openSnapperRollbackTerminal()
}

export async function openArchNewsLatest(): Promise<void> {
  await openLatestArchNews()
}

export async function markLatestArchNewsRead(): Promise<void> {
  const news = await readArchNewsState()
  if (!news.latestPublishedAt.trim()) return

  await markArchNewsAsRead(news.latestPublishedAt)
}
