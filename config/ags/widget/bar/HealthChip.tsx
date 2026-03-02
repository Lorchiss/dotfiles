import { Gtk } from "ags/gtk4"
import {
  barComputeStateBinding,
  barSystemStateBinding,
} from "../../lib/barSignals"
import { createMusicAccentClassState } from "../../lib/musicAccent"

type HealthState = {
  level: "ok" | "warn" | "critical"
  label: string
  detail: string
}

function resolveHealthState(
  cpu: number | null,
  ram: number | null,
  temp: number | null,
): HealthState {
  const safeCpu = cpu ?? 0
  const safeRam = ram ?? 0
  const safeTemp = temp ?? 0

  const critical = safeCpu >= 92 || safeRam >= 92 || safeTemp >= 88
  const warning = safeCpu >= 76 || safeRam >= 80 || safeTemp >= 79

  if (critical) {
    return {
      level: "critical",
      label: "●",
      detail: `CPU ${cpu ?? "--"}% · RAM ${ram ?? "--"}% · TEMP ${temp !== null ? temp.toFixed(1) : "--"}°C`,
    }
  }

  if (warning) {
    return {
      level: "warn",
      label: "●",
      detail: `CPU ${cpu ?? "--"}% · RAM ${ram ?? "--"}% · TEMP ${temp !== null ? temp.toFixed(1) : "--"}°C`,
    }
  }

  return {
    level: "ok",
    label: "●",
    detail: `CPU ${cpu ?? "--"}% · RAM ${ram ?? "--"}% · TEMP ${temp !== null ? temp.toFixed(1) : "--"}°C`,
  }
}

export default function HealthChip() {
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
      tooltipText={compute(
        (c) =>
          resolveHealthState(c.cpu, c.ram, system().maxTemperatureC).detail,
      )}
    >
      <box spacing={6}>
        <label
          class={compute((c) => {
            const health = resolveHealthState(
              c.cpu,
              c.ram,
              system().maxTemperatureC,
            )
            return `health-dot health-dot-${health.level}`
          })}
          label={compute(
            (c) =>
              resolveHealthState(c.cpu, c.ram, system().maxTemperatureC).label,
          )}
        />
        <label
          class="health-inline"
          label={compute(
            (c) =>
              `H ${c.cpu ?? "--"}/${c.ram ?? "--"}/${system().maxTemperatureC !== null ? system().maxTemperatureC?.toFixed(0) : "--"}`,
          )}
        />
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
              label={compute((c) => `${c.cpu ?? "--"}%`)}
            />
          </box>

          <box class="health-popover-row" spacing={8}>
            <label class="health-popover-key" label="RAM" xalign={0} hexpand />
            <label
              class="health-popover-value"
              label={compute((c) => `${c.ram ?? "--"}%`)}
            />
          </box>

          <box class="health-popover-row" spacing={8}>
            <label class="health-popover-key" label="TEMP" xalign={0} hexpand />
            <label
              class="health-popover-value"
              label={system(
                (s) =>
                  `${s.maxTemperatureC !== null ? s.maxTemperatureC.toFixed(1) : "--"}°C`,
              )}
            />
          </box>
        </box>
      </popover>
    </menubutton>
  )
}
