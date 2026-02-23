import { runCommand } from "./command"

export type BatteryStatus = "charging" | "discharging" | "full" | "unknown"

export type BatteryState = {
  batteryAvailable: boolean
  batteryPercent: number | null
  batteryStatus: BatteryStatus
  batteryHealthPercent: number | null
  onAcPower: boolean | null
  powerWatts: number | null
  timeRemainingMinutes: number | null
}

const LOW_BATTERY_NOTIFY_THRESHOLD = 15
const LOW_BATTERY_RESET_THRESHOLD = 20

let lowBatteryNotified = false

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function parseIntSafe(raw: string): number | null {
  const value = Number.parseInt(raw.trim(), 10)
  return Number.isFinite(value) ? value : null
}

function parseFloatSafe(raw: string): number | null {
  const value = Number.parseFloat(raw.trim().replace(",", "."))
  return Number.isFinite(value) ? value : null
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value))
}

function round(value: number, precision = 1): number {
  const base = 10 ** precision
  return Math.round(value * base) / base
}

function normalizeStatus(raw: string): BatteryStatus {
  const clean = raw.trim().toLowerCase()
  if (clean.includes("charging")) return "charging"
  if (clean.includes("discharging")) return "discharging"
  if (clean.includes("full")) return "full"
  return "unknown"
}

function mapRawValues(raw: string): Record<string, string> {
  const map: Record<string, string> = {}

  for (const line of raw.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const separator = trimmed.indexOf("=")
    if (separator <= 0) continue

    const key = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1).trim()
    if (!key) continue

    map[key] = value
  }

  return map
}

function inferBatteryPercent(values: Record<string, string>): number | null {
  const capacity = parseIntSafe(values.capacity ?? "")
  if (capacity !== null) return clampPercent(capacity)

  const energyNow = parseFloatSafe(values.energy_now ?? "")
  const energyFull = parseFloatSafe(values.energy_full ?? "")
  if (energyNow !== null && energyFull !== null && energyFull > 0) {
    return clampPercent(Math.round((energyNow * 100) / energyFull))
  }

  const chargeNow = parseFloatSafe(values.charge_now ?? "")
  const chargeFull = parseFloatSafe(values.charge_full ?? "")
  if (chargeNow !== null && chargeFull !== null && chargeFull > 0) {
    return clampPercent(Math.round((chargeNow * 100) / chargeFull))
  }

  return null
}

function inferHealthPercent(values: Record<string, string>): number | null {
  const energyFull = parseFloatSafe(values.energy_full ?? "")
  const energyFullDesign = parseFloatSafe(values.energy_full_design ?? "")
  if (
    energyFull !== null &&
    energyFullDesign !== null &&
    energyFullDesign > 0
  ) {
    return clampPercent(round((energyFull * 100) / energyFullDesign, 1))
  }

  const chargeFull = parseFloatSafe(values.charge_full ?? "")
  const chargeFullDesign = parseFloatSafe(values.charge_full_design ?? "")
  if (
    chargeFull !== null &&
    chargeFullDesign !== null &&
    chargeFullDesign > 0
  ) {
    return clampPercent(round((chargeFull * 100) / chargeFullDesign, 1))
  }

  return null
}

function inferPowerMicrowatts(values: Record<string, string>): number | null {
  const powerNow = parseFloatSafe(values.power_now ?? "")
  if (powerNow !== null && powerNow > 0) return powerNow

  const currentNow = parseFloatSafe(values.current_now ?? "")
  const voltageNow = parseFloatSafe(values.voltage_now ?? "")
  if (
    currentNow !== null &&
    voltageNow !== null &&
    currentNow > 0 &&
    voltageNow > 0
  ) {
    return (currentNow * voltageNow) / 1_000_000
  }

  return null
}

function inferEnergyNowMicrowattHour(
  values: Record<string, string>,
): number | null {
  const energyNow = parseFloatSafe(values.energy_now ?? "")
  if (energyNow !== null && energyNow > 0) return energyNow

  const chargeNow = parseFloatSafe(values.charge_now ?? "")
  const voltageNow = parseFloatSafe(values.voltage_now ?? "")
  if (
    chargeNow !== null &&
    voltageNow !== null &&
    chargeNow > 0 &&
    voltageNow > 0
  ) {
    return (chargeNow * voltageNow) / 1_000_000
  }

  return null
}

function inferEnergyFullMicrowattHour(
  values: Record<string, string>,
): number | null {
  const energyFull = parseFloatSafe(values.energy_full ?? "")
  if (energyFull !== null && energyFull > 0) return energyFull

  const chargeFull = parseFloatSafe(values.charge_full ?? "")
  const voltageNow = parseFloatSafe(values.voltage_now ?? "")
  if (
    chargeFull !== null &&
    voltageNow !== null &&
    chargeFull > 0 &&
    voltageNow > 0
  ) {
    return (chargeFull * voltageNow) / 1_000_000
  }

  return null
}

function inferTimeRemainingMinutes(
  status: BatteryStatus,
  energyNow: number | null,
  energyFull: number | null,
  powerMicrowatts: number | null,
): number | null {
  if (powerMicrowatts === null || powerMicrowatts <= 0) return null
  if (energyNow === null || energyNow <= 0) return null

  if (status === "discharging") {
    return Math.max(0, Math.round((energyNow * 60) / powerMicrowatts))
  }

  if (status === "charging" && energyFull !== null && energyFull > energyNow) {
    return Math.max(
      0,
      Math.round(((energyFull - energyNow) * 60) / powerMicrowatts),
    )
  }

  return null
}

export function createEmptyBatteryState(): BatteryState {
  return {
    batteryAvailable: false,
    batteryPercent: null,
    batteryStatus: "unknown",
    batteryHealthPercent: null,
    onAcPower: null,
    powerWatts: null,
    timeRemainingMinutes: null,
  }
}

export async function readBatteryState(): Promise<BatteryState> {
  const raw = await runCommand(
    `
read_value() {
  local path="$1"
  if [ -r "$path" ]; then
    cat "$path" 2>/dev/null || true
  fi
}

battery_dir=""
for candidate in /sys/class/power_supply/BAT*; do
  [ -d "$candidate" ] || continue
  battery_dir="$candidate"
  break
done

if [ -z "$battery_dir" ]; then
  echo "battery_available=0"
  exit 0
fi

ac_online=""
for ac_dir in /sys/class/power_supply/AC* /sys/class/power_supply/ADP*; do
  [ -r "$ac_dir/online" ] || continue
  ac_online=$(read_value "$ac_dir/online")
  break
done

echo "battery_available=1"
printf 'capacity=%s\\n' "$(read_value "$battery_dir/capacity")"
printf 'status=%s\\n' "$(read_value "$battery_dir/status")"
printf 'energy_now=%s\\n' "$(read_value "$battery_dir/energy_now")"
printf 'energy_full=%s\\n' "$(read_value "$battery_dir/energy_full")"
printf 'energy_full_design=%s\\n' "$(read_value "$battery_dir/energy_full_design")"
printf 'charge_now=%s\\n' "$(read_value "$battery_dir/charge_now")"
printf 'charge_full=%s\\n' "$(read_value "$battery_dir/charge_full")"
printf 'charge_full_design=%s\\n' "$(read_value "$battery_dir/charge_full_design")"
printf 'power_now=%s\\n' "$(read_value "$battery_dir/power_now")"
printf 'current_now=%s\\n' "$(read_value "$battery_dir/current_now")"
printf 'voltage_now=%s\\n' "$(read_value "$battery_dir/voltage_now")"
printf 'ac_online=%s\\n' "$ac_online"
`,
    {
      timeoutMs: 4500,
      allowFailure: true,
      dedupeKey: "battery-read-state",
    },
  )

  const values = mapRawValues(raw)
  if (values.battery_available !== "1") return createEmptyBatteryState()

  const batteryStatus = normalizeStatus(values.status ?? "")
  const batteryPercent = inferBatteryPercent(values)
  const batteryHealthPercent = inferHealthPercent(values)
  const powerMicrowatts = inferPowerMicrowatts(values)
  const powerWatts =
    powerMicrowatts !== null && powerMicrowatts > 0
      ? round(powerMicrowatts / 1_000_000, 2)
      : null

  const energyNow = inferEnergyNowMicrowattHour(values)
  const energyFull = inferEnergyFullMicrowattHour(values)
  const timeRemainingMinutes = inferTimeRemainingMinutes(
    batteryStatus,
    energyNow,
    energyFull,
    powerMicrowatts,
  )

  const acOnlineRaw = parseIntSafe(values.ac_online ?? "")
  const onAcPower = acOnlineRaw === null ? null : acOnlineRaw > 0 ? true : false

  return {
    batteryAvailable: true,
    batteryPercent,
    batteryStatus,
    batteryHealthPercent,
    onAcPower,
    powerWatts,
    timeRemainingMinutes,
  }
}

export async function maybeNotifyLowBattery(
  state: BatteryState,
): Promise<void> {
  if (!state.batteryAvailable) {
    lowBatteryNotified = false
    return
  }

  const percent = state.batteryPercent
  const isDischarging = state.batteryStatus === "discharging"

  if (!isDischarging || state.onAcPower === true) {
    lowBatteryNotified = false
    return
  }

  if (percent === null) return

  if (percent >= LOW_BATTERY_RESET_THRESHOLD) {
    lowBatteryNotified = false
    return
  }

  if (percent > LOW_BATTERY_NOTIFY_THRESHOLD) return
  if (lowBatteryNotified) return

  lowBatteryNotified = true

  const title = "Batería baja"
  const body = `${percent}% restante. Conecta el cargador.`

  await runCommand(
    `notify-send ${shellQuote(title)} ${shellQuote(body)} -u normal`,
    {
      timeoutMs: 1500,
      allowFailure: true,
      dedupeKey: "battery-low-notification",
    },
  )
}
