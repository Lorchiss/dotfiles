import { execAsync } from "ags/process"
import { barSystemStateBinding } from "../../lib/barSignals"
import SpotifyButton from "./SpotifyButton"

function resolveAlertLabel(
  batteryAvailable: boolean,
  batteryPercent: number | null,
  batteryStatus: string,
  maxTemperatureC: number | null,
): string {
  if (
    batteryAvailable &&
    batteryPercent !== null &&
    batteryStatus === "discharging" &&
    batteryPercent <= 15
  ) {
    return `BAT ${batteryPercent}%`
  }

  if (
    maxTemperatureC !== null &&
    Number.isFinite(maxTemperatureC) &&
    maxTemperatureC >= 88
  ) {
    return `TEMP ${maxTemperatureC.toFixed(0)}°`
  }

  return ""
}

export default function PrimaryStatusBlock() {
  const system = barSystemStateBinding()

  return system((s) => {
    const alertLabel = resolveAlertLabel(
      s.batteryAvailable,
      s.batteryPercent,
      s.batteryStatus,
      s.maxTemperatureC,
    )

    if (alertLabel) {
      return (
        <button
          class="primary-status-alert"
          tooltipText="Alerta crítica del sistema"
          onClicked={() =>
            execAsync("ags toggle control-center").catch(() => {})
          }
        >
          <box spacing={6}>
            <label label="⚠" />
            <label label={alertLabel} />
          </box>
        </button>
      )
    }

    return <SpotifyButton />
  })
}
