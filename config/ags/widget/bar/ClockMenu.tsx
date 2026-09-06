import { Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { createPoll } from "ags/time"
import { createPopupSurfaceClassState } from "../../lib/themeSurface"
import { BAR_UI } from "../../lib/uiTokens"
import { safeText } from "../../lib/text"
import { BAR_SIMULATE_INVALID_TEXT, barLog } from "../../lib/barObservability"

type ClockState = {
  time: string
  shortDate: string
  detail: string
}

function spanishShortDate(raw: string, fallback: string): string {
  const [weekdayRaw = "", day = "", monthRaw = ""] = raw.trim().split(/\s+/)
  const weekday = Number.parseInt(weekdayRaw, 10)
  const month = Number.parseInt(monthRaw, 10)
  const weekdays = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"]
  const months = [
    "ENE",
    "FEB",
    "MAR",
    "ABR",
    "MAY",
    "JUN",
    "JUL",
    "AGO",
    "SEP",
    "OCT",
    "NOV",
    "DIC",
  ]
  const weekdayLabel = weekdays[weekday - 1]
  const monthLabel = months[month - 1]
  if (!weekdayLabel || !day || !monthLabel) return fallback
  return `${weekdayLabel} ${day} ${monthLabel}`
}

export default function ClockMenu() {
  barLog("CLOCK", "mounting ClockMenu")
  const surfaceClass = createPopupSurfaceClassState("clock-popover-card")
  const clock = createPoll<ClockState>(
    { time: "--:--", shortDate: "--- --", detail: "Calendario" },
    1000,
    async (prev) => {
      try {
        const raw = await execAsync(`date "+%H:%M|%u %d %m|%A, %d %b %Y"`)
        const [timeRaw = "", shortDateRaw = "", detailRaw = ""] = raw
          .trim()
          .split("|")
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
        const shortDate = safeText(
          spanishShortDate(shortDateRaw, prev.shortDate || "--- --"),
          prev.shortDate || "--- --",
          "CLOCK",
          "clock-short-date",
        )
        return { time, shortDate, detail }
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
      <box class="clock-chip-content" spacing={7} halign={Gtk.Align.CENTER}>
        <label
          class="clock-chip-date"
          label={clock((value) =>
            safeText(value.shortDate, "--- --", "CLOCK", "chip-date"),
          )}
        />
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
          class={surfaceClass((className) => className)}
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
