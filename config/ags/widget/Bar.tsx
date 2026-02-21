import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import SpotifyButton from "./bar/SpotifyButton"
import SystemMetrics from "./bar/SystemMetrics"
import ClockMenu from "./bar/ClockMenu"

export default function Bar(gdkmonitor: Gdk.Monitor) {
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
          <label label="WS" />
        </box>

        <box $type="center" hexpand halign={Gtk.Align.CENTER}>
          <label label=" " />
        </box>

        <box $type="end" spacing={12} hexpand halign={Gtk.Align.END}>
          <SpotifyButton />
          <SystemMetrics />
          <ClockMenu />
        </box>
      </centerbox>
    </window>
  )
}
