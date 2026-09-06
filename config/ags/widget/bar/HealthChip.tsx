import { execAsync } from "ags/process"
import { Gtk } from "ags/gtk4"
import {
  barComputeStateBinding,
  barSystemStateBinding,
} from "../../lib/barSignals"
import { createPopupSurfaceClassState } from "../../lib/themeSurface"
import { BAR_UI } from "../../lib/uiTokens"
import { safeText } from "../../lib/text"
import { barLog } from "../../lib/barObservability"

type HealthState = {
  level: "ok" | "warn" | "critical"
  detail: string
}

function healthIconName(level: HealthState["level"]): string {
  if (level === "critical") return "dialog-error-symbolic"
  if (level === "warn") return "dialog-warning-symbolic"
  return "emblem-ok-symbolic"
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

function percentValue(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return Math.max(0, Math.min(100, Math.round(value)))
}

function percentFraction(value: unknown): number {
  const p = percentValue(value)
  if (p === null) return 0
  return p / 100
}

function temperatureFraction(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value / 100))
}

function meterClass(
  value: unknown,
  warnAt: number,
  criticalAt: number,
): string {
  if (typeof value !== "number" || !Number.isFinite(value))
    return "health-meter-bar health-meter-unknown"
  if (value >= criticalAt) return "health-meter-bar health-meter-critical"
  if (value >= warnAt) return "health-meter-bar health-meter-warn"
  return "health-meter-bar health-meter-ok"
}

function resolveHealthState(
  cpu: number | null,
  ram: number | null,
  gpu: number | null,
  temp: number | null,
): HealthState {
  const safeCpu = typeof cpu === "number" && Number.isFinite(cpu) ? cpu : 0
  const safeRam = typeof ram === "number" && Number.isFinite(ram) ? ram : 0
  const safeGpu = typeof gpu === "number" && Number.isFinite(gpu) ? gpu : 0
  const safeTemp = typeof temp === "number" && Number.isFinite(temp) ? temp : 0
  const cpuLabel = metricText(cpu)
  const ramLabel = metricText(ram)
  const gpuLabel = metricText(gpu)
  const tempLabel = temperatureText(temp, 1)
  const detail = safeText(
    `CPU ${cpuLabel}% · RAM ${ramLabel}% · GPU ${gpuLabel}% · TEMP ${tempLabel}°C`,
    "CPU --% · RAM --% · GPU --% · TEMP --°C",
    "HEALTH",
    "health-detail",
  )

  const critical =
    safeCpu >= 92 || safeRam >= 92 || safeGpu >= 96 || safeTemp >= 88
  const warning =
    safeCpu >= 76 || safeRam >= 80 || safeGpu >= 86 || safeTemp >= 79

  if (critical) {
    return {
      level: "critical",
      detail,
    }
  }

  if (warning) {
    return {
      level: "warn",
      detail,
    }
  }

  return {
    level: "ok",
    detail,
  }
}

function counterLabel(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return "--"
}

export default function HealthChip() {
  barLog("HEALTH", "mounting HealthChip")
  const surfaceClass = createPopupSurfaceClassState("health-popover-card")
  const compute = barComputeStateBinding()
  const system = barSystemStateBinding()

  return (
    <menubutton
      class={compute((c) => {
        const health = resolveHealthState(
          c.cpu,
          c.ram,
          c.gpu,
          system().maxTemperatureC,
        )
        return `health-chip health-${health.level}`
      })}
      tooltipText={compute((c) =>
        safeText(
          resolveHealthState(c.cpu, c.ram, c.gpu, system().maxTemperatureC)
            .detail,
          "CPU --% · RAM --% · GPU --% · TEMP --°C",
          "HEALTH",
          "chip-tooltip",
        ),
      )}
    >
      <box
        class="health-content health-content-icononly"
        spacing={3}
        valign={Gtk.Align.CENTER}
      >
        <image
          class={compute((c) => {
            const health = resolveHealthState(
              c.cpu,
              c.ram,
              c.gpu,
              system().maxTemperatureC,
            )
            return `health-icon health-state-icon health-dot-${health.level}`
          })}
          iconName={compute((c) => {
            const health = resolveHealthState(
              c.cpu,
              c.ram,
              c.gpu,
              system().maxTemperatureC,
            )
            return healthIconName(health.level)
          })}
          pixelSize={BAR_UI.size.networkIcon}
          valign={Gtk.Align.CENTER}
        />
      </box>

      <popover class="health-popover-shell" hasArrow={false}>
        <box
          orientation={Gtk.Orientation.VERTICAL}
          spacing={BAR_UI.spacing.popover}
          class={surfaceClass((className) => className)}
        >
          <label
            class="health-popover-heading"
            label="Salud del sistema"
            xalign={0}
          />

          <box
            class="health-visual-grid"
            orientation={Gtk.Orientation.VERTICAL}
            spacing={8}
          >
            <box
              class="health-popover-row health-visual-row"
              orientation={Gtk.Orientation.VERTICAL}
              spacing={5}
            >
              <box class="health-visual-row-header" spacing={8}>
                <label
                  class="health-popover-key"
                  label="CPU"
                  xalign={0}
                  hexpand
                />
                <label
                  class="health-popover-value health-meter-value"
                  label={compute((c) =>
                    safeText(
                      `${metricText(c.cpu)}%`,
                      "--%",
                      "HEALTH",
                      "cpu-value",
                    ),
                  )}
                />
              </box>
              <Gtk.ProgressBar
                class={compute((c) => meterClass(c.cpu, 76, 92))}
                fraction={compute((c) => percentFraction(c.cpu))}
                hexpand
              />
            </box>

            <box
              class="health-popover-row health-visual-row"
              orientation={Gtk.Orientation.VERTICAL}
              spacing={5}
            >
              <box class="health-visual-row-header" spacing={8}>
                <label
                  class="health-popover-key"
                  label="RAM"
                  xalign={0}
                  hexpand
                />
                <label
                  class="health-popover-value health-meter-value"
                  label={compute((c) =>
                    safeText(
                      `${metricText(c.ram)}%`,
                      "--%",
                      "HEALTH",
                      "ram-value",
                    ),
                  )}
                />
              </box>
              <Gtk.ProgressBar
                class={compute((c) => meterClass(c.ram, 80, 92))}
                fraction={compute((c) => percentFraction(c.ram))}
                hexpand
              />
            </box>

            <box
              class="health-popover-row health-visual-row"
              orientation={Gtk.Orientation.VERTICAL}
              spacing={5}
            >
              <box class="health-visual-row-header" spacing={8}>
                <label
                  class="health-popover-key"
                  label="GPU"
                  xalign={0}
                  hexpand
                />
                <label
                  class="health-popover-value health-meter-value"
                  label={compute((c) =>
                    safeText(
                      `${metricText(c.gpu)}%`,
                      "--%",
                      "HEALTH",
                      "gpu-value",
                    ),
                  )}
                />
              </box>
              <Gtk.ProgressBar
                class={compute((c) => meterClass(c.gpu, 86, 96))}
                fraction={compute((c) => percentFraction(c.gpu))}
                hexpand
              />
            </box>

            <box
              class="health-popover-row health-visual-row"
              orientation={Gtk.Orientation.VERTICAL}
              spacing={5}
            >
              <box class="health-visual-row-header" spacing={8}>
                <label
                  class="health-popover-key"
                  label="TEMP"
                  xalign={0}
                  hexpand
                />
                <label
                  class="health-popover-value health-meter-value"
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
              <Gtk.ProgressBar
                class={system((s) => meterClass(s.maxTemperatureC, 79, 88))}
                fraction={system((s) => temperatureFraction(s.maxTemperatureC))}
                hexpand
              />
            </box>
          </box>

          <box class="health-counter-grid" spacing={8}>
            <box
              class="health-counter-card"
              orientation={Gtk.Orientation.VERTICAL}
              spacing={2}
              hexpand
            >
              <label
                class="health-popover-key"
                label="Actualizaciones"
                xalign={0}
              />
              <label
                class="health-counter-value"
                label={system((s) =>
                  safeText(
                    counterLabel(s.updatesCount),
                    "--",
                    "HEALTH",
                    "updates-value",
                  ),
                )}
                xalign={0}
              />
            </box>

            <box
              class="health-counter-card"
              orientation={Gtk.Orientation.VERTICAL}
              spacing={2}
              hexpand
            >
              <label class="health-popover-key" label="Noticias" xalign={0} />
              <label
                class="health-counter-value"
                label={system((s) =>
                  safeText(
                    counterLabel(s.archNewsUnreadCount),
                    "--",
                    "HEALTH",
                    "news-value",
                  ),
                )}
                xalign={0}
              />
            </box>
          </box>

          <button
            class="health-open-monitor"
            onClicked={() =>
              execAsync(
                `bash -c 'if command -v kitty >/dev/null 2>&1; then kitty -e btop || kitty -e htop; elif command -v foot >/dev/null 2>&1; then foot -e btop || foot -e htop; fi'`,
              ).catch(() => {})
            }
          >
            <label label="Abrir monitor CPU/RAM" />
          </button>

          <button
            class="health-open-monitor"
            onClicked={() =>
              execAsync(
                `bash -c 'if command -v kitty >/dev/null 2>&1; then kitty -e nvtop || kitty -e nvidia-smi -l 1; elif command -v foot >/dev/null 2>&1; then foot -e nvtop || foot -e nvidia-smi -l 1; fi'`,
              ).catch(() => {})
            }
          >
            <label label="Abrir monitor GPU" />
          </button>
        </box>
      </popover>
    </menubutton>
  )
}
