import { execAsync } from "ags/process"

export type BluetoothDevice = {
  mac: string
  name: string
  paired: boolean
  connected: boolean
}

export type BluetoothState = {
  controllerName: string
  powered: boolean
  discovering: boolean
  devices: BluetoothDevice[]
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function normalizeBluetoothCommand(command: string): string {
  const clean = command.replace(/[\r\n]+/g, " ").trim()
  if (!clean) throw new Error("Comando bluetooth inválido")
  return clean
}

function buildBluetoothSessionInput(commands: string[]): string {
  const lines = commands.map(normalizeBluetoothCommand)
  if (!lines.length) throw new Error("Comando bluetooth inválido")
  return `${lines.join("\n")}\nquit\n`
}

function normalizeBluetoothMac(mac: string): string {
  const clean = mac.trim().toUpperCase()
  if (!/^[0-9A-F]{2}(?::[0-9A-F]{2}){5}$/.test(clean)) {
    throw new Error("MAC inválida")
  }
  return clean
}

const BLUETOOTH_READ_COMMANDS = [
  "show",
  "devices",
  "devices Paired",
  "devices Connected",
] as const

function splitSessionOutputByCommand(
  raw: string,
  commands: readonly string[],
): Map<string, string> {
  const result = new Map<string, string>()
  for (const command of commands) result.set(command, "")

  const commandSet = new Set(commands)
  let currentCommand = ""

  for (const line of raw.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (commandSet.has(trimmed)) {
      currentCommand = trimmed
      continue
    }

    if (trimmed === "quit") {
      currentCommand = ""
      continue
    }

    if (!currentCommand) continue
    const previous = result.get(currentCommand) ?? ""
    result.set(currentCommand, previous ? `${previous}\n${trimmed}` : trimmed)
  }

  return result
}

function cleanBluetoothOutput(raw: string): string {
  return raw
    .replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "")
    .replace(/\u0008/g, "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/^\[[^\]]+\][>#]\s*/, "").trim())
    .filter(Boolean)
    .join("\n")
}

async function runBluetoothSession(
  commands: string[],
  timeoutSec = 8,
  tolerateFailure = false,
): Promise<string> {
  const input = shellQuote(buildBluetoothSessionInput(commands))
  const maybeAllowFailure = tolerateFailure ? " || true" : ""
  const out = await execAsync(
    `bash -lc "printf %s ${input} | timeout ${timeoutSec}s bluetoothctl 2>&1${maybeAllowFailure}"`,
  )
  return cleanBluetoothOutput(out)
}

function pickUsefulError(output: string): string {
  const line =
    output
      .split("\n")
      .map((entry) => entry.trim())
      .find((entry) =>
        /failed|error|not available|no default controller|invalid|not ready/i.test(
          entry,
        ),
      ) ?? output.trim()

  return line || "Operación bluetooth falló"
}

async function runBluetoothAction(
  command: string,
  timeoutSec = 8,
  allowedErrorPatterns: RegExp[] = [],
): Promise<void> {
  let out = ""
  try {
    out = await runBluetoothSession([command], timeoutSec, false)
  } catch (error) {
    const message =
      typeof error === "string"
        ? error
        : error instanceof Error
          ? error.message
          : "Error ejecutando bluetoothctl"
    throw new Error(pickUsefulError(cleanBluetoothOutput(message)))
  }

  const cleaned = cleanBluetoothOutput(out)
  const hasKnownError =
    /failed|error|not available|no default controller|invalid|not ready/i.test(
      cleaned,
    )
  if (!hasKnownError) return

  const isAllowed = allowedErrorPatterns.some((pattern) =>
    pattern.test(cleaned),
  )
  if (!isAllowed) {
    throw new Error(pickUsefulError(cleaned))
  }
}

function parseDevices(raw: string): Map<string, string> {
  const devices = new Map<string, string>()

  for (const line of raw.split("\n")) {
    const match = line.match(/^Device\s+([0-9A-F:]{17})\s+(.+)$/i)
    if (!match) continue
    const mac = match[1].toUpperCase()
    const name = match[2].trim() || mac
    devices.set(mac, name)
  }

  return devices
}

export async function readBluetoothState(): Promise<BluetoothState> {
  try {
    const readsRaw = await runBluetoothSession(
      [...BLUETOOTH_READ_COMMANDS],
      7,
      true,
    )
    const sections = splitSessionOutputByCommand(
      readsRaw,
      BLUETOOTH_READ_COMMANDS,
    )
    const showRaw = sections.get("show") ?? ""
    const devicesRaw = sections.get("devices") ?? ""
    const pairedRaw = sections.get("devices Paired") ?? ""
    const connectedRaw = sections.get("devices Connected") ?? ""

    const powered = /Powered:\s+yes/i.test(showRaw)
    const discovering = /Discovering:\s+yes/i.test(showRaw)
    const controllerName =
      showRaw
        .split("\n")
        .find((line) => line.startsWith("Alias:"))
        ?.replace("Alias:", "")
        .trim() ?? ""

    const all = parseDevices(devicesRaw)
    const paired = parseDevices(pairedRaw)
    const connected = parseDevices(connectedRaw)

    for (const [mac, name] of paired) {
      if (!all.has(mac)) all.set(mac, name)
    }
    for (const [mac, name] of connected) {
      if (!all.has(mac)) all.set(mac, name)
    }

    const devices: BluetoothDevice[] = [...all.entries()].map(
      ([mac, name]) => ({
        mac,
        name,
        paired: paired.has(mac),
        connected: connected.has(mac),
      }),
    )

    devices.sort((a, b) => {
      if (a.connected !== b.connected) return a.connected ? -1 : 1
      if (a.paired !== b.paired) return a.paired ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    return {
      controllerName,
      powered,
      discovering,
      devices,
    }
  } catch {
    return {
      controllerName: "",
      powered: false,
      discovering: false,
      devices: [],
    }
  }
}

export async function setBluetoothPower(enabled: boolean): Promise<void> {
  await runBluetoothAction(`power ${enabled ? "on" : "off"}`)
}

export async function setBluetoothScan(enabled: boolean): Promise<void> {
  await runBluetoothAction(`scan ${enabled ? "on" : "off"}`)
}

export async function pairAndTrustDevice(mac: string): Promise<void> {
  const cleanMac = normalizeBluetoothMac(mac)

  await runBluetoothAction(`pair ${cleanMac}`, 20, [
    /AlreadyExists/i,
    /already paired/i,
  ])
  await runBluetoothAction(`trust ${cleanMac}`)
}

export async function connectBluetoothDevice(mac: string): Promise<void> {
  const cleanMac = normalizeBluetoothMac(mac)
  await runBluetoothAction(`connect ${cleanMac}`, 15, [/already connected/i])
}

export async function disconnectBluetoothDevice(mac: string): Promise<void> {
  const cleanMac = normalizeBluetoothMac(mac)
  await runBluetoothAction(`disconnect ${cleanMac}`, 10, [/not connected/i])
}

export async function removeBluetoothDevice(mac: string): Promise<void> {
  const cleanMac = normalizeBluetoothMac(mac)
  await runBluetoothAction(`remove ${cleanMac}`)
}

export async function openBluemanFallback(): Promise<void> {
  await execAsync(`bash -lc "blueman-manager >/dev/null 2>&1 &"`)
}
