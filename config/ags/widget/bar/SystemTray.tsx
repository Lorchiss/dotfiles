import { Gtk } from "ags/gtk4"
import { createPoll } from "ags/time"
import {
  createEmptySystemState,
  readSystemState,
  type SystemState,
} from "../../lib/system"

const SYSTEM_TRAY_POLL_MS = 5000

function updatesLabel(state: SystemState): string {
  if (state.updatesCount === null) return "UPD --"
  return `UPD ${state.updatesCount}`
}

function aurLabel(state: SystemState): string {
  if (!state.updatesAurEnabled) return "AUR n/d"
  if (state.updatesAurCount === null) return "AUR --"
  return `AUR ${state.updatesAurCount}`
}

function newsLabel(state: SystemState): string {
  if (state.archNewsUnreadCount <= 0) return "NEWS 0"
  if (state.archNewsUnreadCount > 9) return "NEWS 9+"
  return `NEWS ${state.archNewsUnreadCount}`
}

function newsClass(state: SystemState): string {
  if (state.archNewsUnreadCount > 0) {
    return "metric-chip news-chip news-chip-unread"
  }
  return "metric-chip news-chip"
}

function temperatureLabel(state: SystemState): string {
  if (state.maxTemperatureC === null) return "TEMP --"
  return `TEMP ${state.maxTemperatureC.toFixed(0)}°`
}

function profileLabel(state: SystemState): string {
  if (!state.powerProfileAvailable) return "PWR --"
  if (state.powerProfile === "power-saver") return "PWR ECO"
  if (state.powerProfile === "balanced") return "PWR BAL"
  if (state.powerProfile === "performance") return "PWR MAX"
  return "PWR --"
}

export default function SystemTray() {
  const state = createPoll<SystemState>(
    createEmptySystemState(),
    SYSTEM_TRAY_POLL_MS,
    async () => readSystemState(),
  )

  return (
    <box class="system-tray-chip" spacing={8} valign={Gtk.Align.CENTER}>
      <label
        class="metric-chip"
        label={state((snapshot) => updatesLabel(snapshot))}
      />
      <label
        class="metric-chip aur-chip"
        label={state((snapshot) => aurLabel(snapshot))}
      />
      <label
        class={state((snapshot) => newsClass(snapshot))}
        label={state((snapshot) => newsLabel(snapshot))}
      />
      <label
        class="metric-chip"
        label={state((snapshot) => temperatureLabel(snapshot))}
      />
      <label
        class="metric-chip"
        label={state((snapshot) => profileLabel(snapshot))}
      />
    </box>
  )
}
