import { Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { createPoll } from "ags/time"
import { createMusicAccentClassState } from "../../lib/musicAccent"
import { BAR_UI } from "../../lib/uiTokens"
import { safeText } from "../../lib/text"
import { BAR_SIMULATE_INVALID_TEXT, barLog } from "../../lib/barObservability"

type ClockState = {
  time: string
  detail: string
}

export default function ClockMenu() {
  barLog("CLOCK", "mounting ClockMenu")
  const accentClass = createMusicAccentClassState()
  const clock = createPoll<ClockState>(
    { time: "--:--", detail: "Calendario" },
    1000,
    async (prev) => {
      try {
        const raw = await execAsync(`date "+%H:%M|%A, %d %b %Y"`)
        const [timeRaw = "", detailRaw = ""] = raw.trim().split("|")
        const time = safeText(
          BAR_SIMULATE_INVALID_TEXT
            ? "[object instance wrapper Gtk.Calendar]"
            : timeRaw,
          prev.time || "--:--",
          "CLOCK",
          "clock-time",
        )
        const detail = safeText(
          detailRaw,
          prev.detail || "Calendario",
          "CLOCK",
          "clock-detail",
        )
        return { time, detail }
      } catch {
        return prev
      }
    },
  )

  return (
    <menubutton
      class="clock-chip"
      tooltipText={clock((value) =>
        safeText(
          `${value.time} · ${value.detail}`,
          "Calendario",
          "CLOCK",
          "clock-tooltip",
        ),
      )}
    >
      <box spacing={BAR_UI.spacing.tight} halign={Gtk.Align.CENTER}>
        <image class="clock-chip-icon" iconName="preferences-system-time-symbolic" pixelSize={14} />
        <label
          class="clock-chip-time"
          label={clock((value) =>
            safeText(value.time, "--:--", "CLOCK", "chip-time"),
          )}
        />
      </box>
      <popover class="clock-popover-shell" hasArrow={false}>
        <box
          orientation={Gtk.Orientation.VERTICAL}
          spacing={BAR_UI.spacing.popover}
          class={accentClass(
            (accent) => `clock-popover-card popup-accent-surface ${accent}`,
          )}
        >
          <label
            class="clock-popover-heading"
            label={clock((value) =>
              safeText(value.detail, "Calendario", "CLOCK", "popover-heading"),
            )}
            xalign={0}
          />
          <Gtk.Calendar class="clock-popover-calendar" />
        </box>
      </popover>
    </menubutton>
  )
}
