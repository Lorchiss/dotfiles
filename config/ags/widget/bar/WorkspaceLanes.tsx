import { Gtk } from "ags/gtk4"
import { createPoll } from "ags/time"
import {
  type HyprWorkspaceState,
  type MonitorLaneState,
  readHyprWorkspaceState,
  switchWorkspaceOnMonitor,
  workspaceChipState,
} from "../../lib/hypr"

const HYPR_POLL_MS = 600

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

function laneWidget(lane: MonitorLaneState) {
  const laneBox = new Gtk.Box({
    spacing: 6,
    valign: Gtk.Align.CENTER,
  })
  setClasses(laneBox, "workspace-monitor-lane")

  const badge = new Gtk.Label({ label: String(lane.monitorLabel) })
  setClasses(badge, "workspace-monitor-badge")

  const chipsBox = new Gtk.Box({
    spacing: 4,
    valign: Gtk.Align.CENTER,
  })

  for (const workspaceId of lane.workspaceIds) {
    const button = new Gtk.Button()
    setClasses(button, chipClassFor(lane, workspaceId))
    button.set_tooltip_text(
      `Monitor ${lane.monitorLabel} · Workspace ${workspaceId}`,
    )
    button.connect("clicked", () => {
      void switchWorkspaceOnMonitor(lane.monitorName, workspaceId).catch(
        () => {},
      )
    })

    const label = new Gtk.Label({ label: `${workspaceId}` })
    button.set_child(label)
    chipsBox.append(button)
  }

  laneBox.append(badge)
  laneBox.append(chipsBox)
  return laneBox
}

export default function WorkspaceLanes() {
  const lanes = createPoll<HyprWorkspaceState>(
    { lanes: [], hasError: false },
    HYPR_POLL_MS,
    async () => readHyprWorkspaceState(),
  )

  return (
    <box
      class="workspace-lanes"
      spacing={8}
      valign={Gtk.Align.CENTER}
      $={(self: any) => {
        const source = lanes as any

        const render = () => {
          const snapshot = readSnapshot(source)
          clearChildren(self)

          if (!snapshot.lanes.length) {
            self.append(fallbackWidget(snapshot.hasError))
            return
          }

          for (const lane of snapshot.lanes) {
            self.append(laneWidget(lane))
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
