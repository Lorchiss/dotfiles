import { execAsync } from "ags/process"

type HyprMonitorRaw = {
  id?: number
  name?: string
  focused?: boolean
  activeWorkspace?: {
    id?: number
    name?: string
  }
}

type HyprWorkspaceRaw = {
  id?: number
  monitor?: string
  windows?: number
}

export type WorkspaceChipState =
  | "active-focused"
  | "active-unfocused"
  | "occupied"

export type MonitorLaneState = {
  monitorName: string
  monitorLabel: string
  focused: boolean
  activeWorkspaceId: number
  workspaceIds: number[]
}

export type HyprWorkspaceState = {
  lanes: MonitorLaneState[]
  hasError: boolean
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function toPositiveWorkspaceId(value: unknown): number {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : NaN

  if (!Number.isFinite(numeric)) return 0
  const id = Math.trunc(numeric)
  return id > 0 ? id : 0
}

function workspaceIdsForLane(
  activeWorkspaceId: number,
  workspaces: HyprWorkspaceRaw[],
): number[] {
  const ids = new Set<number>()
  if (activeWorkspaceId > 0) ids.add(activeWorkspaceId)

  for (const ws of workspaces) {
    const id = toPositiveWorkspaceId(ws.id)
    const windows = Number(ws.windows ?? 0)
    if (id > 0 && Number.isFinite(windows) && windows > 0) ids.add(id)
  }

  return [...ids].sort((a, b) => a - b)
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

export async function readHyprWorkspaceState(): Promise<HyprWorkspaceState> {
  try {
    const [monitorsRaw, workspacesRaw] = await Promise.all([
      execAsync(`bash -lc "hyprctl -j monitors"`),
      execAsync(`bash -lc "hyprctl -j workspaces"`),
    ])

    const monitors = safeJsonParse<HyprMonitorRaw[]>(monitorsRaw) ?? []
    const workspaces = safeJsonParse<HyprWorkspaceRaw[]>(workspacesRaw) ?? []

    const lanes = monitors
      .filter((monitor) => !!monitor.name)
      .sort((a, b) => Number(a.id ?? 0) - Number(b.id ?? 0))
      .map((monitor) => {
        const monitorName = String(monitor.name ?? "")
        const activeWorkspaceId = toPositiveWorkspaceId(
          monitor.activeWorkspace?.id,
        )
        const laneWorkspaces = workspaces.filter(
          (workspace) => workspace.monitor === monitorName,
        )
        const workspaceIds = workspaceIdsForLane(
          activeWorkspaceId,
          laneWorkspaces,
        )

        return {
          monitorName,
          monitorLabel: monitorName,
          focused: Boolean(monitor.focused),
          activeWorkspaceId,
          workspaceIds:
            workspaceIds.length > 0
              ? workspaceIds
              : activeWorkspaceId > 0
                ? [activeWorkspaceId]
                : [],
        } satisfies MonitorLaneState
      })

    return {
      lanes,
      hasError: lanes.length === 0,
    }
  } catch {
    return {
      lanes: [],
      hasError: true,
    }
  }
}

export function workspaceChipState(
  lane: MonitorLaneState,
  workspaceId: number,
): WorkspaceChipState {
  if (workspaceId === lane.activeWorkspaceId) {
    return lane.focused ? "active-focused" : "active-unfocused"
  }
  return "occupied"
}

export async function switchWorkspaceOnMonitor(
  monitorName: string,
  workspaceId: number,
): Promise<void> {
  const safeWorkspaceId = toPositiveWorkspaceId(workspaceId)
  if (!monitorName || safeWorkspaceId <= 0) return

  const batch = `dispatch focusmonitor ${monitorName}; dispatch workspace ${safeWorkspaceId}`
  await execAsync(
    `bash -lc "hyprctl --batch ${shellQuote(batch)} >/dev/null 2>&1"`,
  )
}
