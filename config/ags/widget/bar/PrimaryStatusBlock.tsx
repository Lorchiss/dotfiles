import { execAsync } from "ags/process"
import { barSystemStateBinding } from "../../lib/barSignals"
import SpotifyButton from "./SpotifyButton"
import { safeText } from "../../lib/text"
import { barLog } from "../../lib/barObservability"

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

type PrimaryStatusBlockProps = {
  spotifyEnabled?: boolean
}

export default function PrimaryStatusBlock({
  spotifyEnabled = true,
}: PrimaryStatusBlockProps) {
  const system = barSystemStateBinding()

  return system((s) => {
    const alertLabel = resolveAlertLabel(
      s.batteryAvailable,
      s.batteryPercent,
      s.batteryStatus,
      s.maxTemperatureC,
    )

    if (alertLabel) {
      barLog("SPOTIFY", "critical alert active; rendering alert block")
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
            <label
              label={safeText(
                alertLabel,
                "ALERTA",
                "SPOTIFY",
                "primary-alert-label",
              )}
            />
          </box>
        </button>
      )
    }

    if (!spotifyEnabled) {
      barLog("SPOTIFY", "spotify module disabled; skipping SpotifyButton")
      return null
    }

    barLog("SPOTIFY", "rendering SpotifyButton")
    return <SpotifyButton />
  })
}
