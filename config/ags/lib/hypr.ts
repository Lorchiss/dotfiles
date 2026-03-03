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

type HyprClientRaw = {
  address?: string
  mapped?: boolean
  hidden?: boolean
  class?: string
  initialClass?: string
  title?: string
  initialTitle?: string
  focusHistoryID?: number
  workspace?: {
    id?: number
  }
}

type HyprActiveWindowRaw = {
  address?: string
  workspace?: {
    id?: number
  }
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
  workspaceMetaById: Record<number, WorkspaceMeta>
}

export type HyprWorkspaceState = {
  lanes: MonitorLaneState[]
  hasError: boolean
}

export type WorkspaceMeta = {
  workspaceId: number
  representativeWindowId: string
  appName: string
  title: string
  empty: boolean
}

type WindowState = {
  id: string
  workspaceId: number
  appName: string
  title: string
  hidden: boolean
  updatedAt: number
  lastFocusedAt: number
}

type WorkspaceWindowModel = {
  windowsById: Record<string, WindowState>
  workspaceToWindowIds: Record<number, string[]>
  workspaceRepresentativeWindowId: Record<number, string>
}

let updateTick = 0
const updatedAtByWindowId = new Map<string, number>()
const windowSignatureById = new Map<string, string>()
const lastFocusedWindowIdByWorkspace = new Map<number, string>()

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function sanitizeWindowText(value: unknown, fallback = ""): string {
  const source = String(value ?? fallback)
  const clean = source.replace(/[\u0000-\u001f\u007f]+/g, " ").trim()
  return clean || fallback
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
  workspaceToWindowIds: Record<number, string[]>,
): number[] {
  const ids = new Set<number>()
  const laneWorkspaceIds = new Set<number>()
  if (activeWorkspaceId > 0) ids.add(activeWorkspaceId)

  for (const ws of workspaces) {
    const id = toPositiveWorkspaceId(ws.id)
    const windows = Number(ws.windows ?? 0)
    if (id > 0) laneWorkspaceIds.add(id)
    if (id > 0 && Number.isFinite(windows) && windows > 0) ids.add(id)
  }

  for (const workspaceKey of Object.keys(workspaceToWindowIds)) {
    const id = toPositiveWorkspaceId(workspaceKey)
    if (!laneWorkspaceIds.has(id)) continue
    if ((workspaceToWindowIds[id]?.length ?? 0) > 0) ids.add(id)
  }

  return [...ids].sort((a, b) => a - b)
}

function windowSignature(
  workspaceId: number,
  appName: string,
  title: string,
  hidden: boolean,
): string {
  return `${workspaceId}|${appName}|${title}|${hidden ? 1 : 0}`
}

function ensureWindowUpdatedAt(windowId: string, signature: string): number {
  const previousSignature = windowSignatureById.get(windowId)
  const previousUpdatedAt = updatedAtByWindowId.get(windowId)
  if (previousSignature === signature && typeof previousUpdatedAt === "number") {
    return previousUpdatedAt
  }

  const next = updateTick + 1
  updateTick = next
  windowSignatureById.set(windowId, signature)
  updatedAtByWindowId.set(windowId, next)
  return next
}

function pruneWindowCaches(activeIds: Set<string>) {
  for (const id of [...updatedAtByWindowId.keys()]) {
    if (!activeIds.has(id)) updatedAtByWindowId.delete(id)
  }
  for (const id of [...windowSignatureById.keys()]) {
    if (!activeIds.has(id)) windowSignatureById.delete(id)
  }
  for (const [workspaceId, windowId] of [...lastFocusedWindowIdByWorkspace]) {
    if (!activeIds.has(windowId)) lastFocusedWindowIdByWorkspace.delete(workspaceId)
  }
}

function workspaceRepresentativeId(
  workspaceId: number,
  lane: Pick<MonitorLaneState, "focused" | "activeWorkspaceId">,
  workspaceToWindowIds: Record<number, string[]>,
  windowsById: Record<string, WindowState>,
  activeWindowId: string,
): string {
  const windowIds = workspaceToWindowIds[workspaceId] ?? []
  if (!windowIds.length) return ""

  if (
    lane.focused &&
    lane.activeWorkspaceId === workspaceId &&
    activeWindowId &&
    windowIds.includes(activeWindowId)
  ) {
    return activeWindowId
  }

  const lastFocusedWindowId = lastFocusedWindowIdByWorkspace.get(workspaceId) ?? ""
  if (lastFocusedWindowId && windowIds.includes(lastFocusedWindowId)) {
    return lastFocusedWindowId
  }

  const sortedByPriority = [...windowIds]
    .map((id) => windowsById[id])
    .filter(Boolean)
    .sort((a, b) => {
      const byUpdated = b.updatedAt - a.updatedAt
      if (byUpdated !== 0) return byUpdated
      return a.id.localeCompare(b.id)
    })

  return sortedByPriority[0]?.id ?? ""
}

function buildWorkspaceWindowModel(
  clients: HyprClientRaw[],
  activeWindowId: string,
): WorkspaceWindowModel {
  const windowsById: Record<string, WindowState> = {}
  const workspaceToWindowIds: Record<number, string[]> = {}
  const liveWindowIds = new Set<string>()

  for (const client of clients) {
    if (!client.mapped) continue
    const windowId = sanitizeWindowText(client.address, "")
    if (!windowId) continue
    const workspaceId = toPositiveWorkspaceId(client.workspace?.id)
    if (workspaceId <= 0) continue
    const appName = sanitizeWindowText(client.class ?? client.initialClass, "Desktop")
    const title = sanitizeWindowText(client.title ?? client.initialTitle, "")
    const hidden = Boolean(client.hidden)
    const signature = windowSignature(workspaceId, appName, title, hidden)
    const updatedAt = ensureWindowUpdatedAt(windowId, signature)

    liveWindowIds.add(windowId)

    windowsById[windowId] = {
      id: windowId,
      workspaceId,
      appName,
      title,
      hidden,
      updatedAt,
      lastFocusedAt: 0,
    }

    const ids = workspaceToWindowIds[workspaceId] ?? []
    ids.push(windowId)
    workspaceToWindowIds[workspaceId] = ids
  }

  const activeWorkspaceId = toPositiveWorkspaceId(
    windowsById[activeWindowId]?.workspaceId,
  )
  if (activeWindowId && liveWindowIds.has(activeWindowId) && activeWorkspaceId > 0) {
    const idsInWorkspace = workspaceToWindowIds[activeWorkspaceId] ?? []
    if (idsInWorkspace.includes(activeWindowId)) {
      lastFocusedWindowIdByWorkspace.set(activeWorkspaceId, activeWindowId)
    }
  }

  for (const [workspaceIdRaw, ids] of Object.entries(workspaceToWindowIds)) {
    const workspaceId = toPositiveWorkspaceId(workspaceIdRaw)
    workspaceToWindowIds[workspaceId] = [...ids].sort((a, b) => {
      const aWindow = windowsById[a]
      const bWindow = windowsById[b]
      if (!aWindow || !bWindow) return a.localeCompare(b)
      if (aWindow.hidden !== bWindow.hidden) return aWindow.hidden ? 1 : -1
      const byUpdated = bWindow.updatedAt - aWindow.updatedAt
      if (byUpdated !== 0) return byUpdated
      return a.localeCompare(b)
    })
  }

  pruneWindowCaches(liveWindowIds)

  return {
    windowsById,
    workspaceToWindowIds,
    workspaceRepresentativeWindowId: {},
  }
}

function workspaceMetaForId(
  workspaceId: number,
  representativeWindowId: string,
  windowsById: Record<string, WindowState>,
): WorkspaceMeta {
  const representative = representativeWindowId
    ? windowsById[representativeWindowId]
    : null

  if (!representative) {
    return {
      workspaceId,
      representativeWindowId: "",
      appName: "Desktop",
      title: "",
      empty: true,
    }
  }

  return {
    workspaceId,
    representativeWindowId: representative.id,
    appName: representative.appName,
    title: representative.title,
    empty: false,
  }
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

export async function readHyprWorkspaceState(): Promise<HyprWorkspaceState> {
  try {
    const [monitorsRaw, workspacesRaw, clientsRaw, activeRaw] =
      await Promise.all([
        execAsync(`bash -lc "hyprctl -j monitors"`),
        execAsync(`bash -lc "hyprctl -j workspaces"`),
        execAsync(`bash -lc "hyprctl -j clients"`),
        execAsync(`bash -lc "hyprctl -j activewindow"`),
      ])

    const monitors = safeJsonParse<HyprMonitorRaw[]>(monitorsRaw) ?? []
    const workspaces = safeJsonParse<HyprWorkspaceRaw[]>(workspacesRaw) ?? []
    const clients = safeJsonParse<HyprClientRaw[]>(clientsRaw) ?? []
    const activeWindow = safeJsonParse<HyprActiveWindowRaw>(activeRaw) ?? {}
    const activeWindowId = sanitizeWindowText(activeWindow.address, "")
    const model = buildWorkspaceWindowModel(clients, activeWindowId)

    const lanes = monitors
      .filter((monitor) => !!monitor.name)
      .sort((a, b) => Number(a.id ?? 0) - Number(b.id ?? 0))
      .map((monitor) => {
        const monitorName = String(monitor.name ?? "")
        const focused = Boolean(monitor.focused)
        const activeWorkspaceId = toPositiveWorkspaceId(
          monitor.activeWorkspace?.id,
        )
        const laneWorkspaces = workspaces.filter(
          (workspace) => workspace.monitor === monitorName,
        )
        const workspaceIds = workspaceIdsForLane(
          activeWorkspaceId,
          laneWorkspaces,
          model.workspaceToWindowIds,
        )
        const resolvedWorkspaceIds =
          workspaceIds.length > 0
            ? workspaceIds
            : activeWorkspaceId > 0
              ? [activeWorkspaceId]
              : []
        const workspaceMetaById: Record<number, WorkspaceMeta> = {}

        for (const workspaceId of resolvedWorkspaceIds) {
          const representativeWindowId = workspaceRepresentativeId(
            workspaceId,
            { focused, activeWorkspaceId },
            model.workspaceToWindowIds,
            model.windowsById,
            activeWindowId,
          )
          model.workspaceRepresentativeWindowId[workspaceId] =
            representativeWindowId
          workspaceMetaById[workspaceId] = workspaceMetaForId(
            workspaceId,
            representativeWindowId,
            model.windowsById,
          )
        }

        return {
          monitorName,
          monitorLabel: monitorName,
          focused,
          activeWorkspaceId,
          workspaceIds: resolvedWorkspaceIds,
          workspaceMetaById,
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
