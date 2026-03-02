import { Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { createPoll } from "ags/time"

type ActiveWindowState = {
  app: string
  title: string
  workspace: number | null
}

const ACTIVE_WINDOW_POLL_MS = 1200
const TITLE_MAX_CHARS = 38

function safeText(value: unknown): string {
  if (typeof value !== "string") return ""
  return value.trim()
}

function parseWorkspaceId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value))
    return Math.trunc(value)
  return null
}

function fallbackState(): ActiveWindowState {
  return {
    app: "Desktop",
    title: "Sin ventana activa",
    workspace: null,
  }
}

export default function ActiveWindowChip() {
  const state = createPoll<ActiveWindowState>(
    fallbackState(),
    ACTIVE_WINDOW_POLL_MS,
    async (prev) => {
      try {
        const raw = await execAsync(
          `bash -lc "hyprctl -j activewindow 2>/dev/null || echo '{}'"`,
        )
        const parsed = JSON.parse(raw) as {
          title?: unknown
          class?: unknown
          workspace?: { id?: unknown }
        }

        const app = safeText(parsed.class) || prev.app || "Desktop"
        const title = safeText(parsed.title) || app || "Sin ventana activa"
        const workspace = parseWorkspaceId(parsed.workspace?.id)

        return {
          app,
          title,
          workspace,
        }
      } catch {
        return prev
      }
    },
  )

  return (
    <box class="active-window-chip" spacing={6} valign={Gtk.Align.CENTER}>
      <label class="active-window-app" label={state((s) => s.app)} />
      <label
        class="active-window-title"
        label={state((s) => s.title)}
        widthChars={TITLE_MAX_CHARS}
        maxWidthChars={TITLE_MAX_CHARS}
        singleLineMode
        xalign={0}
      />
    </box>
  )
}
