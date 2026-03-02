import app from "ags/gtk4/app"
import { Astal, Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import SpotifyButton from "./bar/SpotifyButton"
import ClockMenu from "./bar/ClockMenu"
import WorkspaceLanes from "./bar/WorkspaceLanes"
import VolumeControl from "./bar/VolumeControl"
import ActiveWindowChip from "./bar/ActiveWindowChip"
import CriticalAlertChip from "./bar/CriticalAlertChip"
import ModeChip from "./bar/ModeChip"
import ObservabilityHub from "./bar/ObservabilityHub"

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
          spacing={10}
          valign={Gtk.Align.CENTER}
          hexpand
          halign={Gtk.Align.START}
        >
          <WorkspaceLanes />
          <ActiveWindowChip />
          <CriticalAlertChip />
        </box>

        <box
          $type="center"
          class="bar-section-center"
          spacing={10}
          valign={Gtk.Align.CENTER}
          hexpand
          halign={Gtk.Align.CENTER}
        >
          <SpotifyButton />
        </box>

        <box
          $type="end"
          class="bar-section-end"
          spacing={10}
          valign={Gtk.Align.CENTER}
          hexpand
          halign={Gtk.Align.END}
        >
          <ModeChip />
          <VolumeControl />
          <button
            class="connectivity-chip"
            onClicked={() =>
              execAsync("ags toggle control-center").catch(() => {})
            }
            tooltipText="Abrir Control Center (SUPER+C)"
          >
            <box spacing={6}>
              <label label="󰖩" />
              <label label="Centro" />
            </box>
          </button>
          <ObservabilityHub />
          <ClockMenu />
        </box>
      </centerbox>
    </window>
  )
}
