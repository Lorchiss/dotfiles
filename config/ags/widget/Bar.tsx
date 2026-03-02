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
import { barLog, isBarModuleEnabled } from "../lib/barObservability"

export default function Bar(gdkmonitor: any) {
  const { TOP, LEFT, RIGHT } = Astal.WindowAnchor
  const wsEnabled = isBarModuleEnabled("WS")
  const activeWindowEnabled = isBarModuleEnabled("ACTIVE_WINDOW")
  const spotifyEnabled = isBarModuleEnabled("SPOTIFY")
  const healthEnabled = isBarModuleEnabled("HEALTH")
  const maintenanceEnabled = isBarModuleEnabled("MAINTENANCE")
  const clockEnabled = isBarModuleEnabled("CLOCK")
  const audioEnabled = isBarModuleEnabled("AUDIO")
  const connectivityEnabled = isBarModuleEnabled("CONNECTIVITY")

  barLog("WS", wsEnabled ? "enabled" : "disabled by BAR_WS=0")
  barLog(
    "ACTIVE_WINDOW",
    activeWindowEnabled ? "enabled" : "disabled by BAR_ACTIVE_WINDOW=0",
  )
  barLog("SPOTIFY", spotifyEnabled ? "enabled" : "disabled by BAR_SPOTIFY=0")
  barLog("HEALTH", healthEnabled ? "enabled" : "disabled by BAR_HEALTH=0")
  barLog(
    "MAINTENANCE",
    maintenanceEnabled ? "enabled" : "disabled by BAR_MAINTENANCE=0",
  )
  barLog("CLOCK", clockEnabled ? "enabled" : "disabled by BAR_CLOCK=0")
  barLog("AUDIO", audioEnabled ? "enabled" : "disabled by BAR_AUDIO=0")
  barLog(
    "CONNECTIVITY",
    connectivityEnabled ? "enabled" : "disabled by BAR_CONNECTIVITY=0",
  )

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
            {wsEnabled ? <WorkspaceLanes /> : null}
            {activeWindowEnabled ? <ActiveWindowChip /> : null}
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
          <PrimaryStatusBlock spotifyEnabled={spotifyEnabled} />
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
            {audioEnabled ? <VolumeControl /> : null}
            {connectivityEnabled ? (
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
            ) : null}
          </box>
          {healthEnabled ? <HealthChip /> : null}
          {maintenanceEnabled ? <MaintenanceChip /> : null}
          {clockEnabled ? <ClockMenu /> : null}
        </box>
      </centerbox>
    </window>
  )
}
