import { Gtk } from "ags/gtk4"
import { barSystemStateBinding } from "../../lib/barSignals"
import { createMusicAccentClassState } from "../../lib/musicAccent"

function maintenanceStatus(updates: number | null, news: number) {
  if (news > 0) return "warn"
  if (updates !== null && updates > 0) return "warn"
  return "ok"
}

export default function MaintenanceChip() {
  const accentClass = createMusicAccentClassState()
  const system = barSystemStateBinding()

  return (
    <menubutton
      class={system(
        (s) =>
          `maintenance-chip maintenance-${maintenanceStatus(s.updatesCount, s.archNewsUnreadCount)}`,
      )}
      tooltipText={system(
        (s) =>
          `Updates ${s.updatesCount ?? "--"} · AUR ${s.updatesAurCount ?? "--"} · News ${s.archNewsUnreadCount}`,
      )}
    >
      <box class="maintenance-content" spacing={6}>
        <label class="maintenance-label" label="●" />
        <box orientation={Gtk.Orientation.VERTICAL} spacing={0}>
          <label class="chip-caption" label="Maintenance" xalign={0} />
          <label
            class="maintenance-inline"
            label={system(
              (s) =>
                `U${s.updatesCount ?? "--"} A${s.updatesAurCount ?? "--"} N${s.archNewsUnreadCount}`,
            )}
            xalign={0}
          />
        </box>
      </box>

      <popover class="maintenance-popover-shell" hasArrow={false}>
        <box
          orientation={Gtk.Orientation.VERTICAL}
          spacing={8}
          class={accentClass(
            (accent) =>
              `maintenance-popover-card popup-accent-surface ${accent}`,
          )}
        >
          <label
            class="maintenance-popover-heading"
            label="Maintenance"
            xalign={0}
          />

          <box class="maintenance-popover-row" spacing={8}>
            <label
              class="maintenance-popover-key"
              label="Updates"
              xalign={0}
              hexpand
            />
            <label
              class="maintenance-popover-value"
              label={system((s) => `${s.updatesCount ?? "--"}`)}
            />
          </box>

          <box class="maintenance-popover-row" spacing={8}>
            <label
              class="maintenance-popover-key"
              label="AUR"
              xalign={0}
              hexpand
            />
            <label
              class="maintenance-popover-value"
              label={system((s) => `${s.updatesAurCount ?? "--"}`)}
            />
          </box>

          <box class="maintenance-popover-row" spacing={8}>
            <label
              class="maintenance-popover-key"
              label="Arch News"
              xalign={0}
              hexpand
            />
            <label
              class="maintenance-popover-value"
              label={system((s) => `${s.archNewsUnreadCount}`)}
            />
          </box>
        </box>
      </popover>
    </menubutton>
  )
}
