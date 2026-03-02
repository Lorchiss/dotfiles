import { Gtk } from "ags/gtk4"
import {
  barComputeStateBinding,
  barSystemStateBinding,
} from "../../lib/barSignals"
import { createMusicAccentClassState } from "../../lib/musicAccent"

function profileLabel(powerProfile: string): string {
  if (powerProfile === "power-saver") return "ECO"
  if (powerProfile === "balanced") return "WORK"
  if (powerProfile === "performance") return "BOOST"
  return "--"
}

export default function ObservabilityHub() {
  const accentClass = createMusicAccentClassState()
  const system = barSystemStateBinding()
  const compute = barComputeStateBinding()

  return (
    <menubutton
      class={system((s) =>
        [
          "observability-chip",
          s.archNewsUnreadCount > 0 ||
          (s.updatesCount !== null && s.updatesCount > 0) ||
          (s.maxTemperatureC !== null && s.maxTemperatureC >= 86)
            ? "obs-warn"
            : "obs-ok",
        ].join(" "),
      )}
    >
      <box spacing={7}>
        <label label="◉" />
        <label
          class="observability-inline"
          label={compute(
            (c) =>
              `C${c.cpu ?? "--"} R${c.ram ?? "--"} T${system().maxTemperatureC !== null ? system().maxTemperatureC?.toFixed(0) : "--"}`,
          )}
        />
        <label
          class="observability-badge"
          label={system((s) =>
            s.archNewsUnreadCount > 0
              ? `N${Math.min(9, s.archNewsUnreadCount)}+`
              : `U${s.updatesCount ?? "--"}`,
          )}
        />
      </box>

      <popover class="obs-popover-shell" hasArrow={false}>
        <box
          orientation={Gtk.Orientation.VERTICAL}
          spacing={8}
          class={accentClass(
            (accent) => `obs-popover-card popup-accent-surface ${accent}`,
          )}
        >
          <label
            class="obs-popover-heading"
            label="Observabilidad"
            xalign={0}
          />

          <box class="obs-popover-row" spacing={8}>
            <label class="obs-popover-key" label="Compute" xalign={0} hexpand />
            <label
              class="obs-popover-value"
              label={compute(
                (c) => `CPU ${c.cpu ?? "--"}% · RAM ${c.ram ?? "--"}%`,
              )}
            />
          </box>

          <box class="obs-popover-row" spacing={8}>
            <label class="obs-popover-key" label="Thermal" xalign={0} hexpand />
            <label
              class="obs-popover-value"
              label={system(
                (s) =>
                  `TEMP ${s.maxTemperatureC !== null ? s.maxTemperatureC.toFixed(1) : "--"}°C`,
              )}
            />
          </box>

          <box class="obs-popover-row" spacing={8}>
            <label class="obs-popover-key" label="Updates" xalign={0} hexpand />
            <label
              class="obs-popover-value"
              label={system(
                (s) =>
                  `Total ${s.updatesCount ?? "--"} · AUR ${s.updatesAurCount ?? "--"}`,
              )}
            />
          </box>

          <box class="obs-popover-row" spacing={8}>
            <label
              class="obs-popover-key"
              label="Arch News"
              xalign={0}
              hexpand
            />
            <label
              class="obs-popover-value"
              label={system((s) => `${s.archNewsUnreadCount} unread`)}
            />
          </box>

          <box class="obs-popover-row" spacing={8}>
            <label class="obs-popover-key" label="Mode" xalign={0} hexpand />
            <label
              class="obs-popover-value"
              label={system((s) => profileLabel(s.powerProfile))}
            />
          </box>
        </box>
      </popover>
    </menubutton>
  )
}
