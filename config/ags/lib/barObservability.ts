import GLib from "gi://GLib"

const TRUE_LITERALS = new Set(["1", "true", "yes", "on"])
const FALSE_LITERALS = new Set(["0", "false", "no", "off"])

type BarModuleSpec = {
  env: string
  prefix: string
}

const BAR_MODULE_SPECS = {
  WS: { env: "BAR_WS", prefix: "[BAR:WS]" },
  ACTIVE_WINDOW: {
    env: "BAR_ACTIVE_WINDOW",
    prefix: "[BAR:ACTIVE_WINDOW]",
  },
  SPOTIFY: { env: "BAR_SPOTIFY", prefix: "[BAR:SPOTIFY]" },
  HEALTH: { env: "BAR_HEALTH", prefix: "[BAR:HEALTH]" },
  MAINTENANCE: { env: "BAR_MAINTENANCE", prefix: "[BAR:MAINTENANCE]" },
  CLOCK: { env: "BAR_CLOCK", prefix: "[BAR:CLOCK]" },
  AUDIO: { env: "BAR_AUDIO", prefix: "[BAR:AUDIO]" },
  CONNECTIVITY: { env: "BAR_CONNECTIVITY", prefix: "[BAR:CONNECTIVITY]" },
} as const satisfies Record<string, BarModuleSpec>

export type BarModuleName = keyof typeof BAR_MODULE_SPECS

function envValue(name: string): string {
  const raw = GLib.getenv(name)
  if (typeof raw !== "string") return ""
  return raw.trim()
}

function parseBooleanEnv(name: string, fallback: boolean): boolean {
  const raw = envValue(name).toLowerCase()
  if (!raw) return fallback
  if (TRUE_LITERALS.has(raw)) return true
  if (FALSE_LITERALS.has(raw)) return false
  return fallback
}

export const DEBUG_BAR = parseBooleanEnv("DEBUG_BAR", false)
export const BAR_SIMULATE_INVALID_TEXT = parseBooleanEnv(
  "BAR_SIMULATE_INVALID_TEXT",
  false,
)

const MODULE_FLAGS: Record<BarModuleName, boolean> = Object.fromEntries(
  Object.entries(BAR_MODULE_SPECS).map(([moduleName, spec]) => [
    moduleName,
    parseBooleanEnv(spec.env, true),
  ]),
) as Record<BarModuleName, boolean>

function modulePrefix(moduleName: string): string {
  const normalized = moduleName.toUpperCase()
  const known = BAR_MODULE_SPECS[normalized as BarModuleName]
  if (known) return known.prefix
  return `[BAR:${normalized}]`
}

export function isBarModuleEnabled(moduleName: BarModuleName): boolean {
  return MODULE_FLAGS[moduleName]
}

export function barLog(moduleName: string, message: string): void {
  if (!DEBUG_BAR) return
  print(`${modulePrefix(moduleName)} ${message}`)
}

export function logBarFlagsSummary(): void {
  if (!DEBUG_BAR) return
  const summary = (Object.keys(BAR_MODULE_SPECS) as BarModuleName[])
    .map((moduleName) => {
      const spec = BAR_MODULE_SPECS[moduleName]
      const value = isBarModuleEnabled(moduleName) ? "ON" : "OFF"
      return `${spec.env}=${value}`
    })
    .join(" ")

  print(`[BAR:FLAGS] DEBUG_BAR=ON ${summary}`)
}
