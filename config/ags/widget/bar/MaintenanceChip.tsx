import { Gtk } from "ags/gtk4"
import { barSystemStateBinding } from "../../lib/barSignals"
import { createMusicAccentClassState } from "../../lib/musicAccent"
import { safeText } from "../../lib/text"
import { barLog } from "../../lib/barObservability"

function maintenanceStatus(updates: number | null, news: number) {
  if (news > 0) return "warn"
  if (updates !== null && updates > 0) return "warn"
  return "ok"
}

function countText(value: unknown): string {
  return safeText(value, "--", "MAINTENANCE", "counter")
}

export default function MaintenanceChip() {
  barLog("MAINTENANCE", "mounting MaintenanceChip")
  const accentClass = createMusicAccentClassState()
  const system = barSystemStateBinding()

  return (
    <menubutton
      class={system(
        (s) =>
          `maintenance-chip maintenance-${maintenanceStatus(s.updatesCount, s.archNewsUnreadCount)}`,
      )}
      tooltipText={system((s) => {
        const updates = countText(s.updatesCount)
        const aur = countText(s.updatesAurCount)
        const news = countText(s.archNewsUnreadCount)
        return safeText(
          `Updates ${updates} · AUR ${aur} · News ${news}`,
          "Updates -- · AUR -- · News --",
          "MAINTENANCE",
          "chip-tooltip",
        )
      })}
    >
      <box class="maintenance-content" spacing={6}>
        <label class="maintenance-label" label="●" />
        <box orientation={Gtk.Orientation.VERTICAL} spacing={0}>
          <label class="chip-caption" label="Maintenance" xalign={0} />
          <label
            class="maintenance-inline"
            label={system((s) => {
              const updates = countText(s.updatesCount)
              const aur = countText(s.updatesAurCount)
              const news = countText(s.archNewsUnreadCount)
              return safeText(
                `U${updates} A${aur} N${news}`,
                "U-- A-- N--",
                "MAINTENANCE",
                "chip-inline",
              )
            })}
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
              label={system((s) => countText(s.updatesCount))}
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
              label={system((s) => countText(s.updatesAurCount))}
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
              label={system((s) => countText(s.archNewsUnreadCount))}
            />
          </box>
        </box>
      </popover>
    </menubutton>
  )
}
