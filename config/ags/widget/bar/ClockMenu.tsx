import { Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { createPoll } from "ags/time"
import { createMusicAccentClassState } from "../../lib/musicAccent"

export default function ClockMenu() {
  const accentClass = createMusicAccentClassState()
  const clock = createPoll("", 1000, () =>
    execAsync(`date "+%H:%M  %d-%m-%Y"`).then((s) => s.trim()),
  )

  return (
    <menubutton class="clock-chip" tooltipText="Calendario">
      <label label={clock} />
      <popover class="clock-popover-shell" hasArrow={false}>
        <box
          orientation={Gtk.Orientation.VERTICAL}
          spacing={8}
          class={accentClass(
            (accent) => `clock-popover-card popup-accent-surface ${accent}`,
          )}
        >
          <label class="clock-popover-heading" label="Calendario" xalign={0} />
          <Gtk.Calendar class="clock-popover-calendar" />
        </box>
      </popover>
    </menubutton>
  )
}
