import app from "ags/gtk4/app"
import { Astal, Gtk } from "ags/gtk4"
import ClockMenu from "./bar/ClockMenu"
import WorkspaceLanes from "./bar/WorkspaceLanes"
import VolumeControl from "./bar/VolumeControl"
import ActiveWindowChip from "./bar/ActiveWindowChip"
import HealthChip from "./bar/HealthChip"
import LauncherButton from "./bar/LauncherButton"
import NetworkChip from "./bar/NetworkChip"
import SpotifyButton from "./bar/SpotifyButton"
import { BAR_UI } from "../lib/uiTokens"
import { barLog, isBarModuleEnabled } from "../lib/barObservability"

export default function Bar(gdkmonitor: any) {
  const { TOP, LEFT, RIGHT } = Astal.WindowAnchor
  const wsEnabled = isBarModuleEnabled("WS")
  const activeWindowEnabled = isBarModuleEnabled("ACTIVE_WINDOW")
  const spotifyEnabled = isBarModuleEnabled("SPOTIFY")
  const healthEnabled = isBarModuleEnabled("HEALTH")
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
          spacing={BAR_UI.spacing.section}
          valign={Gtk.Align.CENTER}
          hexpand
          halign={Gtk.Align.START}
        >
          <LauncherButton />
          <box class="work-context-block" spacing={BAR_UI.spacing.inline}>
            {wsEnabled ? <WorkspaceLanes /> : null}
          </box>
        </box>

        <box
          $type="center"
          class="bar-section-center primary-status-zone"
          spacing={BAR_UI.spacing.inline}
          valign={Gtk.Align.CENTER}
          hexpand
          halign={Gtk.Align.CENTER}
        >
          {activeWindowEnabled ? (
            <ActiveWindowChip />
          ) : (
            <label class="active-window-fallback" label="Desktop" />
          )}
        </box>

        <box
          $type="end"
          class="bar-section-end right-controls-zone"
          spacing={BAR_UI.spacing.cluster}
          valign={Gtk.Align.CENTER}
          hexpand
          halign={Gtk.Align.END}
        >
          {audioEnabled ? <VolumeControl /> : null}
          {connectivityEnabled ? <NetworkChip /> : null}
          {spotifyEnabled ? <SpotifyButton /> : null}
          {healthEnabled ? <HealthChip /> : null}
          {clockEnabled ? <ClockMenu /> : null}
        </box>
      </centerbox>
    </window>
  )
}
