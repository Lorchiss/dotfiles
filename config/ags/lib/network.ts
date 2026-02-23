import { openInTerminal } from "./terminal"
import { runCommand } from "./command"

export type WifiInterface = {
  device: string
  state: string
  connection: string
}

export type WifiNetwork = {
  ssid: string
  displayName: string
  signal: number
  security: string
  bars: string
  inUse: boolean
}

export type WifiState = {
  radioEnabled: boolean
  interfaces: WifiInterface[]
  primaryInterface: string
  currentConnection: string
  networks: WifiNetwork[]
}

type ReadWifiOptions = {
  includeNetworks?: boolean
  previousNetworks?: WifiNetwork[]
}

function errorText(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === "string") return error
  return ""
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function isConnectedState(state: string): boolean {
  const normalized = state.toLowerCase()
  return (
    normalized.includes("connected") && !normalized.includes("disconnected")
  )
}

function parseTableLine(rawLine: string, separator = ":"): string[] {
  const line = rawLine.trim()
  if (!line) return []

  const parts: string[] = []
  let current = ""
  let escaped = false

  for (const char of line) {
    if (escaped) {
      current += char
      escaped = false
      continue
    }

    if (char === "\\") {
      escaped = true
      continue
    }

    if (char === separator) {
      parts.push(current.trim())
      current = ""
      continue
    }

    current += char
  }

  if (escaped) current += "\\"
  parts.push(current.trim())
  return parts
}

function parseIntSafe(raw: string): number {
  const numeric = Number.parseInt(raw.trim(), 10)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(100, numeric))
}

function parseWifiInterfaces(raw: string): WifiInterface[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseTableLine(line))
    .filter((parts) => parts.length >= 4)
    .filter((parts) => parts[1] === "wifi")
    .filter((parts) => !parts[0].startsWith("p2p-"))
    .map((parts) => ({
      device: parts[0],
      state: parts[2],
      connection: parts[3],
    }))
}

function parseWifiNetworks(raw: string): WifiNetwork[] {
  const deduped = new Map<string, WifiNetwork>()

  for (const line of raw.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const parts = parseTableLine(trimmed)
    if (parts.length < 5) continue

    const inUse = parts[0] === "*" || parts[0].toLowerCase() === "yes"
    const ssid = parts[1]
    const displayName = ssid || "(oculta)"
    const signal = parseIntSafe(parts[2])
    const security = parts[3] === "--" ? "" : parts[3]
    const bars = parts[4]
    const key = ssid || `hidden:${displayName}`
    const candidate: WifiNetwork = {
      ssid,
      displayName,
      signal,
      security,
      bars,
      inUse,
    }

    const previous = deduped.get(key)
    if (!previous) {
      deduped.set(key, candidate)
      continue
    }

    if (candidate.inUse && !previous.inUse) {
      deduped.set(key, candidate)
      continue
    }

    if (candidate.signal > previous.signal) {
      deduped.set(key, candidate)
    }
  }

  return [...deduped.values()].sort((a, b) => {
    if (a.inUse !== b.inUse) return a.inUse ? -1 : 1
    if (a.signal !== b.signal) return b.signal - a.signal
    return a.displayName.localeCompare(b.displayName)
  })
}

export function wifiNeedsPassword(network: WifiNetwork): boolean {
  return Boolean(network.security && network.security.trim())
}

export async function readWifiState(
  options: ReadWifiOptions = {},
): Promise<WifiState> {
  const includeNetworks = options.includeNetworks ?? true
  const previousNetworks = options.previousNetworks ?? []

  try {
    const [radioRaw, interfacesRaw] = await Promise.all([
      runCommand(`LC_ALL=C nmcli -t -f WIFI g`, { timeoutMs: 6000 }),
      runCommand(
        `LC_ALL=C nmcli -t -f DEVICE,TYPE,STATE,CONNECTION device status`,
        {
          timeoutMs: 6000,
        },
      ),
    ])

    const radioEnabled = radioRaw.trim().toLowerCase() === "enabled"
    const interfaces = parseWifiInterfaces(interfacesRaw)
    const primary =
      interfaces.find((iface) => isConnectedState(iface.state)) ?? interfaces[0]

    let networks = radioEnabled ? previousNetworks : []
    if (includeNetworks && radioEnabled && primary?.device) {
      try {
        const listRaw = await runCommand(
          `LC_ALL=C nmcli -t -f IN-USE,SSID,SIGNAL,SECURITY,BARS dev wifi list ifname ${shellQuote(primary.device)}`,
          { timeoutMs: 9000 },
        )
        networks = parseWifiNetworks(listRaw)
      } catch {
        networks = previousNetworks
      }
    }

    return {
      radioEnabled,
      interfaces,
      primaryInterface: primary?.device ?? "",
      currentConnection:
        primary?.connection && primary.connection !== "--"
          ? primary.connection
          : "",
      networks,
    }
  } catch {
    return {
      radioEnabled: false,
      interfaces: [],
      primaryInterface: "",
      currentConnection: "",
      networks: previousNetworks,
    }
  }
}

export async function setWifiRadio(enabled: boolean): Promise<void> {
  const mode = enabled ? "on" : "off"
  await runCommand(`nmcli radio wifi ${mode}`, { timeoutMs: 6000 })
}

export async function disconnectWifiInterface(
  interfaceName: string,
): Promise<void> {
  if (!interfaceName) return
  await runCommand(`nmcli device disconnect ${shellQuote(interfaceName)}`, {
    timeoutMs: 8000,
  })
}

export async function connectWifiNetwork(
  ssid: string,
  interfaceName: string,
  password?: string,
): Promise<void> {
  const cleanSsid = ssid.trim()
  if (!cleanSsid) throw new Error("SSID inválido")
  if (!interfaceName.trim()) throw new Error("Interfaz Wi-Fi no disponible")

  const parts = [
    "nmcli",
    "--wait",
    "12",
    "dev",
    "wifi",
    "connect",
    shellQuote(cleanSsid),
    "ifname",
    shellQuote(interfaceName.trim()),
  ]

  const cleanPassword = (password ?? "").trim()
  if (cleanPassword) {
    parts.push("password", shellQuote(cleanPassword))
  }

  const connectCommand = `LC_ALL=C ${parts.join(" ")}`

  try {
    await runCommand(connectCommand, { timeoutMs: 18_000 })
  } catch (error) {
    const details = errorText(error).toLowerCase()
    const shouldRetryWithFreshProfile =
      Boolean(cleanPassword) &&
      (details.includes("key-mgmt") ||
        details.includes("secrets were required") ||
        details.includes("not provided"))

    if (!shouldRetryWithFreshProfile) throw error

    try {
      const profilesRaw = await runCommand(
        `LC_ALL=C nmcli -t -f NAME,TYPE,802-11-wireless.ssid connection show`,
        { timeoutMs: 8000 },
      )

      const matchingProfiles = profilesRaw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => parseTableLine(line))
        .filter((parts) => parts.length >= 3)
        .filter((parts) => parts[1] === "802-11-wireless")
        .filter((parts) => parts[2] === cleanSsid)
        .map((parts) => parts[0])
        .filter(Boolean)

      for (const profileName of matchingProfiles) {
        await runCommand(
          `LC_ALL=C nmcli connection delete id ${shellQuote(profileName)} >/dev/null 2>&1 || true`,
          { timeoutMs: 7000, allowFailure: true },
        )
      }
    } catch {
      // Ignore cleanup failures and still retry once.
    }

    await runCommand(connectCommand, { timeoutMs: 18_000 })
  }
}

export async function openNmtuiFallback(): Promise<void> {
  await openInTerminal("nmtui")
}
