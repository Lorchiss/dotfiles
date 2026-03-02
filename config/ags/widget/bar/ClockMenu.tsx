import { Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { createPoll } from "ags/time"
import { createMusicAccentClassState } from "../../lib/musicAccent"
import { safeText } from "../../lib/text"
import { BAR_SIMULATE_INVALID_TEXT, barLog } from "../../lib/barObservability"

export default function ClockMenu() {
  barLog("CLOCK", "mounting ClockMenu")
  const accentClass = createMusicAccentClassState()
  const clock = createPoll("", 1000, () =>
    execAsync(`date "+%H:%M  %d-%m-%Y"`).then((s) =>
      safeText(
        BAR_SIMULATE_INVALID_TEXT
          ? "[object instance wrapper Gtk.Calendar]"
          : s,
        "",
        "CLOCK",
        "clock-poll",
      ),
    ),
  )

  return (
    <menubutton class="clock-chip" tooltipText="Calendario">
      <label
        label={clock((value) =>
          safeText(value, "--:--", "CLOCK", "clock-label"),
        )}
      />
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
