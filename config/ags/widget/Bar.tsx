import app from "ags/gtk4/app"
import { Astal, Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { createPoll } from "ags/time"
import SpotifyButton from "./bar/SpotifyButton"
import SystemMetrics from "./bar/SystemMetrics"
import ClockMenu from "./bar/ClockMenu"
import WorkspaceLanes from "./bar/WorkspaceLanes"
import SystemTray from "./bar/SystemTray"

export default function Bar(gdkmonitor: any) {
  const { TOP, LEFT, RIGHT } = Astal.WindowAnchor

  const activeWindowTitle = createPoll("", 1200, async () => {
    try {
      const out = await execAsync(
        `bash -lc "hyprctl activewindow 2>/dev/null | sed -n 's/^\s*title:\s*//p' | head -n1"`,
      )
      return out.trim()
    } catch {
      return ""
    }
  })

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
          <label
            class="window-title-chip"
            label={activeWindowTitle((title) => (title ? title : " "))}
            maxWidthChars={46}
            ellipsize={3}
          />
        </box>

        <box $type="end" spacing={12} hexpand halign={Gtk.Align.END}>
          <button
            class="connectivity-chip"
            onClicked={() => execAsync("ags toggle control-center").catch(() => {})}
            tooltipText="Abrir Control Center"
          >
            <box spacing={6}>
              <label label="󰖩" />
              <label label="Centro" />
            </box>
          </button>
          <SpotifyButton />
          <SystemTray />
          <SystemMetrics />
          <ClockMenu />
        </box>
      </centerbox>
    </window>
  )
}
