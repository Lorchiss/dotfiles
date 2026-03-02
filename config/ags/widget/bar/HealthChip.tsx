import { Gtk } from "ags/gtk4"
import {
  barComputeStateBinding,
  barSystemStateBinding,
} from "../../lib/barSignals"
import { createMusicAccentClassState } from "../../lib/musicAccent"
import { safeText } from "../../lib/text"
import { barLog } from "../../lib/barObservability"

type HealthState = {
  level: "ok" | "warn" | "critical"
  label: string
  detail: string
}

function metricText(value: unknown): string {
  return safeText(value, "--", "HEALTH", "metric-value")
}

function temperatureText(value: unknown, decimals = 1): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toFixed(decimals)
  }
  return "--"
}

function resolveHealthState(
  cpu: number | null,
  ram: number | null,
  temp: number | null,
): HealthState {
  const safeCpu = typeof cpu === "number" && Number.isFinite(cpu) ? cpu : 0
  const safeRam = typeof ram === "number" && Number.isFinite(ram) ? ram : 0
  const safeTemp = typeof temp === "number" && Number.isFinite(temp) ? temp : 0
  const cpuLabel = metricText(cpu)
  const ramLabel = metricText(ram)
  const tempLabel = temperatureText(temp, 1)
  const detail = safeText(
    `CPU ${cpuLabel}% · RAM ${ramLabel}% · TEMP ${tempLabel}°C`,
    "CPU --% · RAM --% · TEMP --°C",
    "HEALTH",
    "health-detail",
  )

  const critical = safeCpu >= 92 || safeRam >= 92 || safeTemp >= 88
  const warning = safeCpu >= 76 || safeRam >= 80 || safeTemp >= 79

  if (critical) {
    return {
      level: "critical",
      label: "●",
      detail,
    }
  }

  if (warning) {
    return {
      level: "warn",
      label: "●",
      detail,
    }
  }

  return {
    level: "ok",
    label: "●",
    detail,
  }
}

export default function HealthChip() {
  barLog("HEALTH", "mounting HealthChip")
  const accentClass = createMusicAccentClassState()
  const compute = barComputeStateBinding()
  const system = barSystemStateBinding()

  return (
    <menubutton
      class={compute((c) => {
        const health = resolveHealthState(
          c.cpu,
          c.ram,
          system().maxTemperatureC,
        )
        return `health-chip health-${health.level}`
      })}
      tooltipText={compute((c) =>
        safeText(
          resolveHealthState(c.cpu, c.ram, system().maxTemperatureC).detail,
          "CPU --% · RAM --% · TEMP --°C",
          "HEALTH",
          "chip-tooltip",
        ),
      )}
    >
      <box class="health-content" spacing={6}>
        <label
          class={compute((c) => {
            const health = resolveHealthState(
              c.cpu,
              c.ram,
              system().maxTemperatureC,
            )
            return `health-dot health-dot-${health.level}`
          })}
          label={compute((c) =>
            safeText(
              resolveHealthState(c.cpu, c.ram, system().maxTemperatureC).label,
              "●",
              "HEALTH",
              "chip-dot-label",
            ),
          )}
        />
        <box orientation={Gtk.Orientation.VERTICAL} spacing={0}>
          <label class="chip-caption" label="Health" xalign={0} />
          <label
            class="health-inline"
            label={compute((c) => {
              const cpu = metricText(c.cpu)
              const ram = metricText(c.ram)
              const temp = temperatureText(system().maxTemperatureC, 0)
              return safeText(
                `${cpu}/${ram}/${temp}`,
                "--/--/--",
                "HEALTH",
                "chip-inline",
              )
            })}
            xalign={0}
          />
        </box>
      </box>

      <popover class="health-popover-shell" hasArrow={false}>
        <box
          orientation={Gtk.Orientation.VERTICAL}
          spacing={8}
          class={accentClass(
            (accent) => `health-popover-card popup-accent-surface ${accent}`,
          )}
        >
          <label
            class="health-popover-heading"
            label="System Health"
            xalign={0}
          />

          <box class="health-popover-row" spacing={8}>
            <label class="health-popover-key" label="CPU" xalign={0} hexpand />
            <label
              class="health-popover-value"
              label={compute((c) =>
                safeText(`${metricText(c.cpu)}%`, "--%", "HEALTH", "cpu-value"),
              )}
            />
          </box>

          <box class="health-popover-row" spacing={8}>
            <label class="health-popover-key" label="RAM" xalign={0} hexpand />
            <label
              class="health-popover-value"
              label={compute((c) =>
                safeText(`${metricText(c.ram)}%`, "--%", "HEALTH", "ram-value"),
              )}
            />
          </box>

          <box class="health-popover-row" spacing={8}>
            <label class="health-popover-key" label="TEMP" xalign={0} hexpand />
            <label
              class="health-popover-value"
              label={system((s) =>
                safeText(
                  `${temperatureText(s.maxTemperatureC, 1)}°C`,
                  "--°C",
                  "HEALTH",
                  "temp-value",
                ),
              )}
            />
          </box>
        </box>
      </popover>
    </menubutton>
  )
}
