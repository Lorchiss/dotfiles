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

export default function WorkspaceLanes() {
  const lanes = createPoll<HyprWorkspaceState>(
    { lanes: [], hasError: false },
    HYPR_POLL_MS,
    async () => readHyprWorkspaceState(),
  )

  return (
    <box class="workspace-lanes" spacing={8} valign={Gtk.Align.CENTER}>
      {lanes((snapshot) => {
        if (!snapshot.lanes.length) {
          return (
            <label
              class="workspace-chip workspace-fallback"
              label={snapshot.hasError ? "WS --" : "WS"}
            />
          )
        }

        return snapshot.lanes.map((lane) => (
          <box class="workspace-monitor-lane" spacing={6} valign={Gtk.Align.CENTER}>
            <label class="workspace-monitor-badge" label={lane.monitorLabel} />
            <box spacing={4} valign={Gtk.Align.CENTER}>
              {lane.workspaceIds.map((workspaceId) => (
                <button
                  class={chipClassFor(lane, workspaceId)}
                  tooltipText={`Monitor ${lane.monitorLabel} · Workspace ${workspaceId}`}
                  onClicked={() =>
                    void switchWorkspaceOnMonitor(
                      lane.monitorName,
                      workspaceId,
                    ).catch(() => {})
                  }
                >
                  <label label={`${workspaceId}`} />
                </button>
              ))}
            </box>
          </box>
        ))
      })}
    </box>
  )
}
