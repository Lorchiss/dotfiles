import { Gtk } from "ags/gtk4"
import { createPoll } from "ags/time"
import {
  type HyprWorkspaceState,
  type MonitorLaneState,
  type WorkspaceMeta,
  readHyprWorkspaceState,
  switchWorkspaceOnMonitor,
  workspaceChipState,
} from "../../lib/hypr"
import { resolveAppIcon } from "../../lib/appIcon"
import { safeText } from "../../lib/text"
import { BAR_UI } from "../../lib/uiTokens"
import { barLog } from "../../lib/barObservability"

const HYPR_POLL_MS = 250

function chipClassFor(lane: MonitorLaneState, workspaceId: number): string {
  const chipState = workspaceChipState(lane, workspaceId)
  if (chipState === "active-focused") {
    return "workspace-chip workspace-chip-active workspace-chip-focused"
  }
  if (chipState === "active-unfocused") {
    return "workspace-chip workspace-chip-active workspace-chip-unfocused"
  }
  return "workspace-chip workspace-chip-occupied"
}

function clearChildren(container: any) {
  let child = container.get_first_child?.()
  while (child) {
    const next = child.get_next_sibling?.()
    container.remove(child)
    child = next
  }
}

function readSnapshot(source: any): HyprWorkspaceState {
  if (typeof source.peek === "function")
    return source.peek() as HyprWorkspaceState
  if (typeof source === "function") return source() as HyprWorkspaceState
  return { lanes: [], hasError: true }
}

function setClasses(widget: any, classes: string) {
  widget.set_css_classes?.(classes.split(" ").filter(Boolean))
}

function fallbackWidget(hasError: boolean) {
  const label = new Gtk.Label({ label: hasError ? "WS --" : "WS" })
  setClasses(label, "workspace-chip workspace-fallback")
  return label
}

function chipTooltip(workspaceId: number, meta: WorkspaceMeta): string {
  const workspaceText = safeText(
    workspaceId,
    "--",
    "WS",
    `workspace-id-${workspaceId}`,
  )
  const appName = safeText(
    meta.appName,
    meta.empty ? "Empty" : "App",
    "WS",
    `workspace-app-${workspaceId}`,
  )
  const title = safeText(meta.title, "", "WS", `workspace-title-${workspaceId}`)
  if (!title) return `Workspace ${workspaceText} · ${appName}`
  return `Workspace ${workspaceText} · ${title}`
}

function workspaceContent(
  workspaceId: number,
  meta: WorkspaceMeta,
  iconTheme: any,
): any {
  const appName = safeText(
    meta.appName,
    "Desktop",
    "WS",
    `workspace-app-label-${workspaceId}`,
  )
  const iconName = resolveAppIcon(iconTheme, appName)

  const overlay = new Gtk.Overlay()
  const icon = new Gtk.Image({ icon_name: iconName, pixel_size: 14 })
  setClasses(icon, "workspace-chip-icon")
  overlay.set_child(icon)

  const badge = new Gtk.Label({
    label: safeText(workspaceId, "--", "WS", `workspace-badge-${workspaceId}`),
  })
  setClasses(badge, "workspace-chip-badge")
  badge.set_halign(Gtk.Align.END)
  badge.set_valign(Gtk.Align.START)
  overlay.add_overlay(badge)

  return overlay
}

function laneWidget(lane: MonitorLaneState, iconTheme: any) {
  const laneBox = new Gtk.Box({
    spacing: BAR_UI.spacing.tight,
    valign: Gtk.Align.CENTER,
  })
  setClasses(laneBox, "workspace-monitor-lane")

  const chipsBox = new Gtk.Box({
    spacing: BAR_UI.spacing.tight,
    valign: Gtk.Align.CENTER,
  })

  for (const workspaceId of lane.workspaceIds) {
    const meta = lane.workspaceMetaById[workspaceId] ?? {
      workspaceId,
      appName: "Desktop",
      title: "",
      empty: true,
    }
    const button = new Gtk.Button()
    setClasses(button, chipClassFor(lane, workspaceId))
    button.set_tooltip_text(chipTooltip(workspaceId, meta))
    button.connect("clicked", () => {
      void switchWorkspaceOnMonitor(lane.monitorName, workspaceId).catch(
        () => {},
      )
    })
    button.set_child(workspaceContent(workspaceId, meta, iconTheme))
    chipsBox.append(button)
  }

  laneBox.append(chipsBox)
  return laneBox
}

export default function WorkspaceLanes() {
  barLog("WS", "mounting WorkspaceLanes")
  let iconTheme: any = null
  const lanes = createPoll<HyprWorkspaceState>(
    { lanes: [], hasError: false },
    HYPR_POLL_MS,
    async () => readHyprWorkspaceState(),
  )

  return (
    <box
      class="workspace-lanes"
      spacing={BAR_UI.spacing.inline}
      valign={Gtk.Align.CENTER}
      $={(self: any) => {
        try {
          const display = self.get_display?.()
          if (display && typeof Gtk.IconTheme.get_for_display === "function") {
            iconTheme = Gtk.IconTheme.get_for_display(display)
          }
        } catch {
          iconTheme = null
        }

        const source = lanes as any
        let lastRenderKey = ""

        const render = () => {
          const snapshot = readSnapshot(source)
          const renderKey = JSON.stringify(
            snapshot.lanes.map((lane) => ({
              monitorName: lane.monitorName,
              focused: lane.focused,
              activeWorkspaceId: lane.activeWorkspaceId,
              workspaceIds: lane.workspaceIds,
              workspaceMetaById: lane.workspaceMetaById,
            })),
          )
          if (!snapshot.hasError && renderKey === lastRenderKey) return
          lastRenderKey = renderKey

          clearChildren(self)

          if (!snapshot.lanes.length) {
            self.append(fallbackWidget(snapshot.hasError))
            return
          }

          for (const lane of snapshot.lanes) {
            self.append(laneWidget(lane, iconTheme))
          }
        }

        render()

        const unsubscribe = source.subscribe?.(render)
        if (typeof unsubscribe === "function") {
          self.connect("destroy", () => unsubscribe())
        }
      }}
    />
  )
}
