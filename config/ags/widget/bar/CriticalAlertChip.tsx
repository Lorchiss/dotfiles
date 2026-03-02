import { execAsync } from "ags/process"
import { barSystemStateBinding } from "../../lib/barSignals"
import type { SystemState } from "../../lib/system"

type AlertView = {
  level: "none" | "warn" | "critical"
  label: string
  detail: string
}

function resolveAlert(snapshot: SystemState): AlertView {
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

  return {
    level: "none",
    label: "",
    detail: "",
  }
}

export default function CriticalAlertChip() {
  const state = barSystemStateBinding()

  const openControlCenter = () => {
    execAsync("ags toggle control-center").catch(() => {})
  }

  return (
    <button
      visible={state((s) => resolveAlert(s).level !== "none")}
      class={state((s) => {
        const alert = resolveAlert(s)
        return alert.level === "critical"
          ? "critical-alert-chip critical-alert-critical"
          : "critical-alert-chip critical-alert-warn"
      })}
      tooltipText={state((s) => resolveAlert(s).detail)}
      onClicked={openControlCenter}
    >
      <box spacing={6}>
        <label label="⚠" />
        <label label={state((s) => resolveAlert(s).label)} />
      </box>
    </button>
  )
}
