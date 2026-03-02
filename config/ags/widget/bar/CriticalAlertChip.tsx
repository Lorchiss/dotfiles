import { Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { createPoll } from "ags/time"
import { readSystemState } from "../../lib/system"

type CriticalAlertState = {
  level: "none" | "warn" | "critical"
  label: string
  detail: string
}

const ALERT_POLL_MS = 4200

function defaultState(): CriticalAlertState {
  return {
    level: "none",
    label: "",
    detail: "",
  }
}

export default function CriticalAlertChip() {
  const state = createPoll<CriticalAlertState>(
    defaultState(),
    ALERT_POLL_MS,
    async () => {
      try {
        const snapshot = await readSystemState({ includeUpdates: false })

        if (
          snapshot.batteryAvailable &&
          snapshot.batteryPercent !== null &&
          snapshot.batteryStatus === "discharging" &&
          snapshot.batteryPercent <= 15
        ) {
          return {
            level: "critical",
            label: `BAT ${snapshot.batteryPercent}%`,
            detail: "Batería crítica. Abrir Control Center recomendado.",
          }
        }

        if (
          snapshot.maxTemperatureC !== null &&
          Number.isFinite(snapshot.maxTemperatureC) &&
          snapshot.maxTemperatureC >= 88
        ) {
          return {
            level: "critical",
            label: `TEMP ${snapshot.maxTemperatureC.toFixed(0)}°`,
            detail: "Temperatura alta detectada.",
          }
        }

        if (
          snapshot.batteryAvailable &&
          snapshot.batteryPercent !== null &&
          snapshot.batteryStatus === "discharging" &&
          snapshot.batteryPercent <= 22
        ) {
          return {
            level: "warn",
            label: `BAT ${snapshot.batteryPercent}%`,
            detail: "Batería en nivel bajo.",
          }
        }

        return defaultState()
      } catch {
        return defaultState()
      }
    },
  )

  const openControlCenter = () => {
    execAsync("ags toggle control-center").catch(() => {})
  }

  return (
    <button
      visible={state((s) => s.level !== "none")}
      class={state((s) =>
        s.level === "critical"
          ? "critical-alert-chip critical-alert-critical"
          : "critical-alert-chip critical-alert-warn",
      )}
      tooltipText={state((s) => s.detail)}
      onClicked={openControlCenter}
    >
      <box spacing={6}>
        <label label="⚠" />
        <label label={state((s) => s.label)} />
      </box>
    </button>
  )
}
