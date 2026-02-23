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

function cleanBluetoothOutput(raw: string): string {
  return raw
    .replace(/\x1B\[[0-9;]*[A-Za-z]/g, "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/^\[[^\]]+\]>\s*/, "").trim())
    .filter(Boolean)
    .join("\n")
}

async function runBluetoothRead(command: string): Promise<string> {
  const out = await execAsync(
    `bash -lc "timeout 5s bluetoothctl ${command} 2>&1 || true"`,
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
    out = await execAsync(
      `bash -lc "timeout ${timeoutSec}s bluetoothctl ${command} 2>&1"`,
    )
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

  const isAllowed = allowedErrorPatterns.some((pattern) => pattern.test(cleaned))
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
    const [showRaw, devicesRaw, pairedRaw, connectedRaw] = await Promise.all([
      runBluetoothRead("show"),
      runBluetoothRead("devices"),
      runBluetoothRead("devices Paired"),
      runBluetoothRead("devices Connected"),
    ])

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

    const devices: BluetoothDevice[] = [...all.entries()].map(([mac, name]) => ({
      mac,
      name,
      paired: paired.has(mac),
      connected: connected.has(mac),
    }))

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
  const cleanMac = mac.trim().toUpperCase()
  if (!cleanMac) throw new Error("MAC inválida")

  await runBluetoothAction(`pair ${shellQuote(cleanMac)}`, 20, [
    /AlreadyExists/i,
    /already paired/i,
  ])
  await runBluetoothAction(`trust ${shellQuote(cleanMac)}`)
}

export async function connectBluetoothDevice(mac: string): Promise<void> {
  const cleanMac = mac.trim().toUpperCase()
  if (!cleanMac) throw new Error("MAC inválida")
  await runBluetoothAction(`connect ${shellQuote(cleanMac)}`, 15, [/already connected/i])
}

export async function disconnectBluetoothDevice(mac: string): Promise<void> {
  const cleanMac = mac.trim().toUpperCase()
  if (!cleanMac) throw new Error("MAC inválida")
  await runBluetoothAction(`disconnect ${shellQuote(cleanMac)}`, 10, [
    /not connected/i,
  ])
}

export async function removeBluetoothDevice(mac: string): Promise<void> {
  const cleanMac = mac.trim().toUpperCase()
  if (!cleanMac) throw new Error("MAC inválida")
  await runBluetoothAction(`remove ${shellQuote(cleanMac)}`)
}

export async function openBluemanFallback(): Promise<void> {
  await execAsync(`bash -lc "blueman-manager >/dev/null 2>&1 &"`)
}
