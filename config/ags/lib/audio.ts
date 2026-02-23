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
  volume: number
  muted: boolean
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.trunc(value)))
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

async function readSinkVolumeState(): Promise<{
  volume: number
  muted: boolean
}> {
  try {
    const wpLine = (
      await execAsync(
        `bash -lc "LC_ALL=C wpctl get-volume @DEFAULT_AUDIO_SINK@ 2>/dev/null || true"`,
      )
    ).trim()

    if (wpLine) {
      const match = wpLine.match(/([0-9]+(?:[.,][0-9]+)?)/)
      if (match) {
        const parsed = Number.parseFloat(match[1].replace(",", "."))
        if (Number.isFinite(parsed)) {
          return {
            volume: clampPercent(Math.round(parsed * 100)),
            muted: wpLine.includes("[MUTED]"),
          }
        }
      }
    }
  } catch {}

  try {
    const out = await execAsync(`bash -lc '
vol=$(pactl get-sink-volume @DEFAULT_SINK@ 2>/dev/null | head -n1 | awk "{print \$5}" | tr -d "%")
mute=$(pactl get-sink-mute @DEFAULT_SINK@ 2>/dev/null | awk "{print \$2}")
printf "%s\n%s" "$vol" "$mute"
'`)

    const [volRaw = "0", muteRaw = "no"] = out
      .trim()
      .split("\n")
      .map((value) => value.trim())

    const parsedVolume = Number.parseInt(volRaw, 10)
    return {
      volume: clampPercent(parsedVolume),
      muted: muteRaw === "yes",
    }
  } catch {
    return { volume: 0, muted: false }
  }
}

export async function readAudioState(): Promise<AudioState> {
  try {
    const [sinksRaw, sourcesRaw, defaultSinkRaw, defaultSourceRaw, sinkVolume] =
      await Promise.all([
        execAsync(`bash -lc "pactl list short sinks"`),
        execAsync(`bash -lc "pactl list short sources"`),
        execAsync(`bash -lc "pactl get-default-sink"`),
        execAsync(`bash -lc "pactl get-default-source"`),
        readSinkVolumeState(),
      ])

    const defaultSink = defaultSinkRaw.trim()
    const defaultSource = defaultSourceRaw.trim()

    return {
      defaultSink,
      defaultSource,
      sinks: parseNodes(sinksRaw, "sink", defaultSink),
      sources: parseNodes(sourcesRaw, "source", defaultSource),
      volume: sinkVolume.volume,
      muted: sinkVolume.muted,
    }
  } catch {
    return {
      defaultSink: "",
      defaultSource: "",
      sinks: [],
      sources: [],
      volume: 0,
      muted: false,
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
  await execAsync(
    `bash -lc "pactl set-default-source ${shellQuote(cleanName)}"`,
  )
}

export async function setSinkVolume(percent: number): Promise<void> {
  const safePercent = clampPercent(Math.round(percent))
  await execAsync(
    `bash -lc "if command -v wpctl >/dev/null 2>&1; then wpctl set-volume @DEFAULT_AUDIO_SINK@ ${safePercent}%; else pactl set-sink-volume @DEFAULT_SINK@ ${safePercent}%; fi"`,
  )
}

export async function toggleSinkMute(): Promise<void> {
  await execAsync(
    `bash -lc "if command -v wpctl >/dev/null 2>&1; then wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle; else pactl set-sink-mute @DEFAULT_SINK@ toggle; fi"`,
  )
}

export async function openPavucontrol(): Promise<void> {
  await execAsync(`bash -lc "pavucontrol >/dev/null 2>&1 &"`)
}
