import app from "ags/gtk4/app"
import { Astal, Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import SpotifyButton from "./bar/SpotifyButton"
import ClockMenu from "./bar/ClockMenu"
import WorkspaceLanes from "./bar/WorkspaceLanes"

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
        <box $type="start" spacing={10} hexpand halign={Gtk.Align.START}>
          <WorkspaceLanes />
        </box>

        <box $type="center" hexpand halign={Gtk.Align.CENTER}>
          <SpotifyButton />
        </box>

        <box $type="end" spacing={10} hexpand halign={Gtk.Align.END}>
          <button
            class="connectivity-chip"
            onClicked={() =>
              execAsync("ags toggle control-center").catch(() => {})
            }
            tooltipText="Abrir Control Center"
          >
            <box spacing={6}>
              <label label="󰖩" />
              <label label="Centro" />
            </box>
          </button>
          <ClockMenu />
        </box>
      </centerbox>
    </window>
  )
}
