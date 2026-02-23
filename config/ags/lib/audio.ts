import { execAsync } from "ags/process"

export type AudioNodeKind = "sink" | "source"

export type AudioNode = {
  id: number
  name: string
  server: string
  format: string
  state: string
  kind: AudioNodeKind
  isDefault: boolean
}

export type AudioState = {
  defaultSink: string
  defaultSource: string
  sinks: AudioNode[]
  sources: AudioNode[]
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function parseNodeLine(rawLine: string, kind: AudioNodeKind): AudioNode | null {
  const line = rawLine.trim()
  if (!line) return null

  const parts = line.split("\t")
  if (parts.length < 2) return null

  const id = Number.parseInt(parts[0], 10)
  if (!Number.isFinite(id)) return null

  return {
    id,
    name: parts[1] ?? "",
    server: parts[2] ?? "",
    format: parts[3] ?? "",
    state: parts[4] ?? "",
    kind,
    isDefault: false,
  }
}

function parseNodes(
  raw: string,
  kind: AudioNodeKind,
  defaultName: string,
): AudioNode[] {
  const nodes = raw
    .split("\n")
    .map((line) => parseNodeLine(line, kind))
    .filter((node): node is AudioNode => node !== null)
    .map((node) => ({
      ...node,
      isDefault: node.name === defaultName,
    }))

  nodes.sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return nodes
}

export async function readAudioState(): Promise<AudioState> {
  try {
    const [sinksRaw, sourcesRaw, defaultSinkRaw, defaultSourceRaw] =
      await Promise.all([
        execAsync(`bash -lc "pactl list short sinks"`),
        execAsync(`bash -lc "pactl list short sources"`),
        execAsync(`bash -lc "pactl get-default-sink"`),
        execAsync(`bash -lc "pactl get-default-source"`),
      ])

    const defaultSink = defaultSinkRaw.trim()
    const defaultSource = defaultSourceRaw.trim()

    return {
      defaultSink,
      defaultSource,
      sinks: parseNodes(sinksRaw, "sink", defaultSink),
      sources: parseNodes(sourcesRaw, "source", defaultSource),
    }
  } catch {
    return {
      defaultSink: "",
      defaultSource: "",
      sinks: [],
      sources: [],
    }
  }
}

export async function setDefaultSink(name: string): Promise<void> {
  const cleanName = name.trim()
  if (!cleanName) return
  await execAsync(`bash -lc "pactl set-default-sink ${shellQuote(cleanName)}"`)
}

export async function setDefaultSource(name: string): Promise<void> {
  const cleanName = name.trim()
  if (!cleanName) return
  await execAsync(`bash -lc "pactl set-default-source ${shellQuote(cleanName)}"`)
}

export async function openPavucontrol(): Promise<void> {
  await execAsync(`bash -lc "pavucontrol >/dev/null 2>&1 &"`)
}
