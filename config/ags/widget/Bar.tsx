import { onCleanup } from "ags"
import app from "ags/gtk4/app"
import { Astal, Gtk } from "ags/gtk4"
import ClockMenu from "./bar/ClockMenu"
import WorkspaceLanes from "./bar/WorkspaceLanes"
import ActiveWindowChip from "./bar/ActiveWindowChip"
import HealthChip from "./bar/HealthChip"
import LauncherButton from "./bar/LauncherButton"
import QuickStatusBox from "./bar/QuickStatusBox"
import SpotifyButton from "./bar/SpotifyButton"
import { BAR_UI } from "../lib/uiTokens"
import { barLog, isBarModuleEnabled } from "../lib/barObservability"
import { themeModeBinding } from "../lib/themeMode"

type BarProps = {
  barKey?: string
  gdkmonitor: any
  onReady?: (window: any) => void
}

export default function Bar({ barKey, gdkmonitor, onReady }: BarProps) {
  const { TOP, LEFT, RIGHT } = Astal.WindowAnchor
  const connector = String(
    gdkmonitor?.get_connector?.() ?? gdkmonitor?.connector ?? "",
  ).trim()
  const themeMode = themeModeBinding()
  const isPrimary = connector === "DP-1" || !connector
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
  barLog("WS", connector ? `bar monitor=${connector}` : "bar monitor=unknown")

  return (
    <window
      visible
      name={barKey ? `bar-${barKey}` : connector ? `bar-${connector}` : "bar"}
      class={themeMode(
        (mode) =>
          `Bar bar-theme-${mode} ${isPrimary ? "bar-primary" : "bar-secondary"}`,
      )}
      gdkmonitor={gdkmonitor}
      layer={Astal.Layer.TOP}
      exclusivity={Astal.Exclusivity.EXCLUSIVE}
      anchor={TOP | LEFT | RIGHT}
      application={app}
      $={(window: any) => {
        onReady?.(window)
        onCleanup(() => window.destroy?.())
      }}
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
            {wsEnabled ? <WorkspaceLanes monitorName={connector} /> : null}
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
          {spotifyEnabled && isPrimary ? <SpotifyButton compact /> : null}
          {isPrimary ? (
            <QuickStatusBox
              audioEnabled={audioEnabled}
              connectivityEnabled={connectivityEnabled}
            />
          ) : null}
          {healthEnabled && isPrimary ? <HealthChip /> : null}
          {clockEnabled ? <ClockMenu /> : null}
        </box>
      </centerbox>
    </window>
  )
}
