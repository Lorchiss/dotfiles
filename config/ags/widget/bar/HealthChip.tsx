import { execAsync } from "ags/process"
import { Gtk } from "ags/gtk4"
import {
  barComputeStateBinding,
  barSystemStateBinding,
} from "../../lib/barSignals"
import { createMusicAccentClassState } from "../../lib/musicAccent"
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

function meterText(value: unknown, width = 10): string {
  const p = percentValue(value)
  if (p === null) return "--"
  const filled = Math.round((p / 100) * width)
  const empty = Math.max(0, width - filled)
  return `${"█".repeat(filled)}${"░".repeat(empty)}`
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

  const critical = safeCpu >= 92 || safeRam >= 92 || safeGpu >= 96 || safeTemp >= 88
  const warning = safeCpu >= 76 || safeRam >= 80 || safeGpu >= 86 || safeTemp >= 79

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
  const accentClass = createMusicAccentClassState()
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
          resolveHealthState(c.cpu, c.ram, c.gpu, system().maxTemperatureC).detail,
          "CPU --% · RAM --% · GPU --% · TEMP --°C",
          "HEALTH",
          "chip-tooltip",
        ),
      )}
    >
      <box class="health-content" spacing={BAR_UI.spacing.tight} valign={Gtk.Align.CENTER}>
        <image
          class={compute((c) => {
            const health = resolveHealthState(
              c.cpu,
              c.ram,
              c.gpu,
              system().maxTemperatureC,
            )
            return `health-icon health-dot-${health.level}`
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
          pixelSize={14}
          valign={Gtk.Align.CENTER}
        />
        <box class="health-metric-group" spacing={4} valign={Gtk.Align.CENTER}>
          <image
            class="health-metric-icon"
            iconName="utilities-system-monitor-symbolic"
            pixelSize={11}
            valign={Gtk.Align.CENTER}
          />
          <label
            class="health-metric health-metric-value"
            label={compute((c) =>
              safeText(
                `${metricText(c.cpu)}%`,
                "--%",
                "HEALTH",
                "chip-cpu-inline",
              ),
            )}
            xalign={0}
            valign={Gtk.Align.CENTER}
          />
        </box>
        <box class="health-metric-group" spacing={4} valign={Gtk.Align.CENTER}>
          <image
            class="health-metric-icon"
            iconName="drive-harddisk-symbolic"
            pixelSize={12}
            valign={Gtk.Align.CENTER}
          />
          <label
            class="health-metric health-metric-value"
            label={compute((c) =>
              safeText(
                `${metricText(c.ram)}%`,
                "--%",
                "HEALTH",
                "chip-ram-inline",
              ),
            )}
            xalign={0}
            valign={Gtk.Align.CENTER}
          />
        </box>
        <box class="health-metric-group" spacing={4} valign={Gtk.Align.CENTER}>
          <image
            class="health-metric-icon"
            iconName="video-display-symbolic"
            pixelSize={12}
            valign={Gtk.Align.CENTER}
          />
          <label
            class="health-metric health-metric-value"
            label={compute((c) =>
              safeText(
                `${metricText(c.gpu)}%`,
                "--%",
                "HEALTH",
                "chip-gpu-inline",
              ),
            )}
            xalign={0}
            valign={Gtk.Align.CENTER}
          />
        </box>
        <box class="health-metric-group" spacing={4} valign={Gtk.Align.CENTER}>
          <image
            class="health-metric-icon"
            iconName="weather-clear-symbolic"
            pixelSize={12}
            valign={Gtk.Align.CENTER}
          />
          <label
            class="health-metric health-metric-value"
            label={system((s) =>
              safeText(
                `${temperatureText(s.maxTemperatureC, 0)}°`,
                "--°",
                "HEALTH",
                "chip-temp-inline",
              ),
            )}
            xalign={0}
            valign={Gtk.Align.CENTER}
          />
        </box>
      </box>

      <popover class="health-popover-shell" hasArrow={false}>
        <box
          orientation={Gtk.Orientation.VERTICAL}
          spacing={BAR_UI.spacing.popover}
          class={accentClass(
            (accent) => `health-popover-card popup-accent-surface ${accent}`,
          )}
        >
          <label
            class="health-popover-heading"
            label="Salud del sistema"
            xalign={0}
          />

          <box class="health-popover-row" spacing={BAR_UI.spacing.popover}>
            <label class="health-popover-key" label="CPU" xalign={0} hexpand />
            <label
              class="health-popover-value health-meter-value"
              label={compute((c) =>
                safeText(
                  `${metricText(c.cpu)}%  ${meterText(c.cpu)}`,
                  "--%  --",
                  "HEALTH",
                  "cpu-value",
                ),
              )}
            />
          </box>

          <box class="health-popover-row" spacing={BAR_UI.spacing.popover}>
            <label class="health-popover-key" label="RAM" xalign={0} hexpand />
            <label
              class="health-popover-value health-meter-value"
              label={compute((c) =>
                safeText(
                  `${metricText(c.ram)}%  ${meterText(c.ram)}`,
                  "--%  --",
                  "HEALTH",
                  "ram-value",
                ),
              )}
            />
          </box>

          <box class="health-popover-row" spacing={BAR_UI.spacing.popover}>
            <label class="health-popover-key" label="GPU" xalign={0} hexpand />
            <label
              class="health-popover-value health-meter-value"
              label={compute((c) =>
                safeText(
                  `${metricText(c.gpu)}%  ${meterText(c.gpu)}`,
                  "--%  --",
                  "HEALTH",
                  "gpu-value",
                ),
              )}
            />
          </box>

          <box class="health-popover-row" spacing={BAR_UI.spacing.popover}>
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

          <box class="health-popover-row" spacing={BAR_UI.spacing.popover}>
            <label
              class="health-popover-key"
              label="Actualizaciones"
              xalign={0}
              hexpand
            />
            <label
              class="health-popover-value"
              label={system((s) =>
                safeText(
                  counterLabel(s.updatesCount),
                  "--",
                  "HEALTH",
                  "updates-value",
                ),
              )}
            />
          </box>

          <box class="health-popover-row" spacing={BAR_UI.spacing.popover}>
            <label class="health-popover-key" label="Noticias" xalign={0} hexpand />
            <label
              class="health-popover-value"
              label={system((s) =>
                safeText(
                  counterLabel(s.archNewsUnreadCount),
                  "--",
                  "HEALTH",
                  "news-value",
                ),
              )}
            />
          </box>

          <button
            class="health-open-monitor"
            onClicked={() =>
              execAsync(
                `bash -lc 'if command -v kitty >/dev/null 2>&1; then kitty -e btop || kitty -e htop; elif command -v foot >/dev/null 2>&1; then foot -e btop || foot -e htop; fi'`,
              ).catch(() => {})
            }
          >
            <label label="Abrir monitor CPU/RAM" />
          </button>

          <button
            class="health-open-monitor"
            onClicked={() =>
              execAsync(
                `bash -lc 'if command -v kitty >/dev/null 2>&1; then kitty -e nvtop || kitty -e nvidia-smi -l 1; elif command -v foot >/dev/null 2>&1; then foot -e nvtop || foot -e nvidia-smi -l 1; fi'`,
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
