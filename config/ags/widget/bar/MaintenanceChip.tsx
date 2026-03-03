import { Gtk } from "ags/gtk4"
import { barSystemStateBinding } from "../../lib/barSignals"
import { createMusicAccentClassState } from "../../lib/musicAccent"
import { barLog } from "../../lib/barObservability"

const COUNTER_FALLBACK = "—"
const FORBIDDEN_LABEL_SNIPPETS = [
  "[object",
  "accessor",
  "gtk.",
  "instance wrapper",
  "null",
  "undefined",
]

function maintenanceStatus(updates: number | null, news: number | null) {
  if (news !== null && news > 0) return "warn"
  if (updates !== null && updates > 0) return "warn"
  return "ok"
}

function safeLogValue(value: unknown): string {
  let preview = ""

  if (typeof value === "string" || typeof value === "number") {
    preview = String(value)
  } else if (typeof value === "function") {
    preview = `[function ${value.name || "anonymous"}]`
  } else if (value === null) {
    preview = "null"
  } else if (value === undefined) {
    preview = "undefined"
  } else if (typeof value === "object") {
    const ctorName =
      (value as { constructor?: { name?: string } }).constructor?.name ||
      "unknown"
    preview = `[object ${ctorName}]`
  } else {
    preview = String(value)
  }

  return preview.replace(/\s+/g, " ").trim().slice(0, 80)
}

function toSafeLabel(value: unknown, fallback = COUNTER_FALLBACK): string {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return fallback
    return String(value)
  }

  if (typeof value !== "string") return fallback

  const label = value.replace(/\s+/g, " ").trim()
  if (!label) return fallback

  const normalized = label.toLowerCase()
  if (FORBIDDEN_LABEL_SNIPPETS.some((token) => normalized.includes(token))) {
    return fallback
  }

  return label
}

function counterValue(value: unknown, fieldName: string): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  barLog(
    "MAINTENANCE",
    `WARN invalid counter field=${fieldName} raw=${safeLogValue(value)} fallback=${COUNTER_FALLBACK}`,
  )
  return null
}

function counterLabel(value: unknown, fieldName: string): string {
  const parsed = counterValue(value, fieldName)
  if (parsed === null) return COUNTER_FALLBACK
  return toSafeLabel(String(parsed), COUNTER_FALLBACK)
}

export default function MaintenanceChip() {
  barLog("MAINTENANCE", "mounting MaintenanceChip")
  const accentClass = createMusicAccentClassState()
  const system = barSystemStateBinding()

  return (
    <menubutton
      class={system((s) => {
        const updates = counterValue(s.updatesCount, "updates-count-status")
        const news = counterValue(s.archNewsUnreadCount, "news-count-status")
        return `maintenance-chip maintenance-${maintenanceStatus(updates, news)}`
      })}
      tooltipText={system((s) => {
        const updates = counterLabel(s.updatesCount, "updates-count-tooltip")
        const aur = counterLabel(s.updatesAurCount, "aur-count-tooltip")
        const news = counterLabel(s.archNewsUnreadCount, "news-count-tooltip")
        return toSafeLabel(
          `Updates ${updates} · AUR ${aur} · News ${news}`,
          `Updates ${COUNTER_FALLBACK} · AUR ${COUNTER_FALLBACK} · News ${COUNTER_FALLBACK}`,
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
              const updates = counterLabel(
                s.updatesCount,
                "updates-count-inline",
              )
              const aur = counterLabel(s.updatesAurCount, "aur-count-inline")
              const news = counterLabel(
                s.archNewsUnreadCount,
                "news-count-inline",
              )
              return toSafeLabel(
                `U${updates} A${aur} N${news}`,
                `U${COUNTER_FALLBACK} A${COUNTER_FALLBACK} N${COUNTER_FALLBACK}`,
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
              label={system((s) =>
                toSafeLabel(
                  counterLabel(s.updatesCount, "updates-count-popover"),
                  COUNTER_FALLBACK,
                ),
              )}
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
              label={system((s) =>
                toSafeLabel(
                  counterLabel(s.updatesAurCount, "aur-count-popover"),
                  COUNTER_FALLBACK,
                ),
              )}
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
              label={system((s) =>
                toSafeLabel(
                  counterLabel(s.archNewsUnreadCount, "news-count-popover"),
                  COUNTER_FALLBACK,
                ),
              )}
            />
          </box>
        </box>
      </popover>
    </menubutton>
  )
}
