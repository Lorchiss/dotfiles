import { runCommand } from "./command"

type HyprMonitorRaw = {
  name?: string
  description?: string
  make?: string
  model?: string
  width?: number
  height?: number
  refreshRate?: number
  x?: number
  y?: number
  scale?: number
  focused?: boolean
}

export type DisplayLayoutMode =
  | "secondary-right"
  | "secondary-left"
  | "stacked"
  | "primary-only"
  | "secondary-only"

export type DisplayMonitorState = {
  name: string
  label: string
  width: number
  height: number
  refreshRate: number
  x: number
  y: number
  scale: number
  focused: boolean
}

export type DisplayState = {
  monitors: DisplayMonitorState[]
  available: boolean
  reason: string
}

type DisplayPair = {
  primary: DisplayMonitorState
  secondary: DisplayMonitorState
}

const PRIMARY_MONITOR: DisplayMonitorState = {
  name: "DP-1",
  label: "DP-1",
  width: 1920,
  height: 1080,
  refreshRate: 165,
  x: 0,
  y: 0,
  scale: 1,
  focused: false,
}

const SECONDARY_MONITOR: DisplayMonitorState = {
  name: "HDMI-A-1",
  label: "HDMI-A-1",
  width: 1920,
  height: 1080,
  refreshRate: 60,
  x: 1920,
  y: 0,
  scale: 1,
  focused: false,
}

const PRIMARY_WORKSPACES = [1, 2, 3, 4, 5]
const SECONDARY_WORKSPACES = [6, 7, 8, 9]

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function formatRefreshRate(refreshRate: number): string {
  const rounded = Math.round(refreshRate)
  return Number.isFinite(rounded) && rounded > 0 ? `${rounded}` : "preferred"
}

function formatMonitorKeyword(
  monitor: DisplayMonitorState,
  x: number,
  y: number,
): string {
  const mode = `${monitor.width}x${monitor.height}@${formatRefreshRate(
    monitor.refreshRate,
  )}`
  return `${monitor.name},${mode},${x}x${y},${monitor.scale}`
}

function monitorLabel(monitor: HyprMonitorRaw): string {
  const name = String(monitor.name ?? "").trim()
  const model = String(monitor.model ?? "").trim()
  if (model && name) return `${name} · ${model}`
  return name || model || "Monitor"
}

function normalizeMonitor(monitor: HyprMonitorRaw): DisplayMonitorState | null {
  const name = String(monitor.name ?? "").trim()
  if (!name) return null

  return {
    name,
    label: monitorLabel(monitor),
    width: readNumber(monitor.width, 1920),
    height: readNumber(monitor.height, 1080),
    refreshRate: readNumber(monitor.refreshRate, 60),
    x: readNumber(monitor.x, 0),
    y: readNumber(monitor.y, 0),
    scale: readNumber(monitor.scale, 1),
    focused: Boolean(monitor.focused),
  }
}

function pickDisplayPair(monitors: DisplayMonitorState[]): DisplayPair {
  const primary =
    monitors.find((monitor) => monitor.name === PRIMARY_MONITOR.name) ??
    monitors.find((monitor) => monitor.focused) ??
    monitors[0] ??
    PRIMARY_MONITOR
  const secondary =
    monitors.find(
      (monitor) =>
        monitor.name === SECONDARY_MONITOR.name &&
        monitor.name !== primary.name,
    ) ??
    monitors.find((monitor) => monitor.name !== primary.name) ??
    SECONDARY_MONITOR

  if (!primary || !secondary) {
    throw new Error("Se necesitan dos monitores activos")
  }

  return { primary, secondary }
}

async function scheduleAgsMonitorRebind(): Promise<void> {
  await runCommand(
    `(sleep 0.8; systemctl --user restart ags.service >/dev/null 2>&1) >/dev/null 2>&1 &`,
    { timeoutMs: 1000, allowFailure: true, dedupeKey: "ags-monitor-rebind" },
  )
}

function workspaceMoveCommands(
  workspaces: number[],
  monitorName: string,
): string[] {
  return workspaces.map(
    (workspace) =>
      `dispatch moveworkspacetomonitor ${workspace} ${monitorName}`,
  )
}

function splitWorkspaceCommands(
  primaryName: string,
  secondaryName: string,
): string[] {
  return [
    ...workspaceMoveCommands(PRIMARY_WORKSPACES, primaryName),
    ...workspaceMoveCommands(SECONDARY_WORKSPACES, secondaryName),
  ]
}

export function createEmptyDisplayState(): DisplayState {
  return {
    monitors: [],
    available: false,
    reason: "hyprctl no disponible",
  }
}

export async function readDisplayState(): Promise<DisplayState> {
  const raw = await runCommand(
    `if command -v hyprctl >/dev/null 2>&1; then hyprctl -j monitors; fi`,
    { timeoutMs: 2500, allowFailure: true, dedupeKey: "read-displays" },
  )

  const trimmed = raw.trim()
  if (!trimmed) return createEmptyDisplayState()

  try {
    const parsed = JSON.parse(trimmed) as HyprMonitorRaw[]
    const monitors = parsed
      .map(normalizeMonitor)
      .filter((monitor): monitor is DisplayMonitorState => monitor !== null)
      .sort((a, b) => a.x - b.x || a.y - b.y || a.name.localeCompare(b.name))

    return {
      monitors,
      available: monitors.length > 0,
      reason:
        monitors.length > 0 ? "" : "Hyprland no reportó monitores activos",
    }
  } catch {
    return {
      monitors: [],
      available: false,
      reason: "No se pudo leer la configuración de pantallas",
    }
  }
}

export async function applyDisplayLayout(
  mode: DisplayLayoutMode,
): Promise<void> {
  const state = await readDisplayState()
  const { primary, secondary } = pickDisplayPair(state.monitors)

  if (mode === "primary-only" || mode === "secondary-only") {
    const enabled = mode === "primary-only" ? primary : secondary
    const disabled = mode === "primary-only" ? secondary : primary

    if (enabled.name === disabled.name) {
      throw new Error("No se puede desactivar el único monitor activo")
    }

    const commands = [
      `keyword monitor ${formatMonitorKeyword(enabled, 0, 0)}`,
      `keyword monitor ${disabled.name},disable`,
      `dispatch focusmonitor ${enabled.name}`,
      ...workspaceMoveCommands(
        [...PRIMARY_WORKSPACES, ...SECONDARY_WORKSPACES],
        enabled.name,
      ),
    ]

    await runCommand(`hyprctl --batch ${shellQuote(commands.join("; "))}`, {
      timeoutMs: 5000,
    })
    await scheduleAgsMonitorRebind()
    return
  }

  let primaryX = 0
  let primaryY = 0
  let secondaryX = primary.width
  let secondaryY = 0

  if (mode === "secondary-left") {
    primaryX = secondary.width
    secondaryX = 0
  } else if (mode === "stacked") {
    secondaryX = 0
    secondaryY = primary.height
  }

  const commands = [
    `keyword monitor ${formatMonitorKeyword(primary, primaryX, primaryY)}`,
    `keyword monitor ${formatMonitorKeyword(secondary, secondaryX, secondaryY)}`,
    ...splitWorkspaceCommands(primary.name, secondary.name),
  ]

  await runCommand(`hyprctl --batch ${shellQuote(commands.join("; "))}`, {
    timeoutMs: 5000,
  })
  await scheduleAgsMonitorRebind()
}

export async function applyAutomaticDisplayLayout(): Promise<void> {
  const commands = [
    `keyword monitor ${formatMonitorKeyword(PRIMARY_MONITOR, 0, 0)}`,
    `keyword monitor ${formatMonitorKeyword(
      SECONDARY_MONITOR,
      PRIMARY_MONITOR.width,
      0,
    )}`,
    ...splitWorkspaceCommands(PRIMARY_MONITOR.name, SECONDARY_MONITOR.name),
  ]

  await runCommand(`hyprctl --batch ${shellQuote(commands.join("; "))}`, {
    timeoutMs: 5000,
  })
  await scheduleAgsMonitorRebind()
}

export async function restoreDailyWorkspaceLayout(): Promise<void> {
  await runCommand(
    `script="$HOME/.config/hypr/scripts/bootstrap-workspaces.sh"; if [ -x "$script" ]; then "$script" --layout-only; fi`,
    { timeoutMs: 5000 },
  )
}
