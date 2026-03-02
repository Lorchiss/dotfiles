import app from "ags/gtk4/app"
import { Astal, Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import ClockMenu from "./bar/ClockMenu"
import WorkspaceLanes from "./bar/WorkspaceLanes"
import VolumeControl from "./bar/VolumeControl"
import ActiveWindowChip from "./bar/ActiveWindowChip"
import HealthChip from "./bar/HealthChip"
import MaintenanceChip from "./bar/MaintenanceChip"
import PrimaryStatusBlock from "./bar/PrimaryStatusBlock"

export default function Bar(gdkmonitor: any) {
  const { TOP, LEFT, RIGHT } = Astal.WindowAnchor

  return (
    <window
      visible
      name="bar"
      class="Bar"
      gdkmonitor={gdkmonitor}
      layer={Astal.Layer.TOP}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      anchor={TOP | LEFT | RIGHT}
      application={app}
    >
      <centerbox cssName="centerbox">
        <box
          $type="start"
          class="bar-section-start"
          spacing={8}
          valign={Gtk.Align.CENTER}
          hexpand
          halign={Gtk.Align.START}
        >
          <box class="work-context-block" spacing={8}>
            <WorkspaceLanes />
            <ActiveWindowChip />
          </box>
        </box>

        <box
          $type="center"
          class="bar-section-center primary-status-zone"
          spacing={8}
          valign={Gtk.Align.CENTER}
          hexpand
          halign={Gtk.Align.CENTER}
        >
          <PrimaryStatusBlock />
        </box>

        <box
          $type="end"
          class="bar-section-end right-controls-zone"
          spacing={8}
          valign={Gtk.Align.CENTER}
          hexpand
          halign={Gtk.Align.END}
        >
          <box class="quick-controls-cluster" spacing={6}>
            <VolumeControl />
            <button
              class="connectivity-chip compact-cc-chip"
              onClicked={() =>
                execAsync("ags toggle control-center").catch(() => {})
              }
              tooltipText="Abrir Control Center (SUPER+C)"
            >
              <box spacing={4}>
                <label label="󰖩" />
                <label label="CC" />
              </box>
            </button>
          </box>
          <HealthChip />
          <MaintenanceChip />
          <ClockMenu />
        </box>
      </centerbox>
    </window>
  )
}
