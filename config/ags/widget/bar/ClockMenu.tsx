import { Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { createPoll } from "ags/time"

export default function ClockMenu() {
  const clock = createPoll("", 1000, () =>
    execAsync(`date "+%H:%M  %d-%m-%Y"`).then((s) => s.trim()),
  )

  return (
    <menubutton class="clock-chip" tooltipText="Calendario">
      <label label={clock} />
      <popover>
        <Gtk.Calendar />
      </popover>
    </menubutton>
  )
}
