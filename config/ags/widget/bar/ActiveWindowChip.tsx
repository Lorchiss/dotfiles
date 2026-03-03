import { Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { createPoll } from "ags/time"
import {
  DESKTOP_APP_ICON,
  FALLBACK_APP_ICON,
  resolveAppIcon,
} from "../../lib/appIcon"
import { BAR_UI } from "../../lib/uiTokens"
import { safeText } from "../../lib/text"
import { barLog } from "../../lib/barObservability"

type ActiveWindowState = {
  iconName: string
  app: string
  title: string
  displayTitle: string
  tooltip: string
}

function resolveDisplayTitle(
  theme: any,
  appRaw: unknown,
  initialClassRaw: unknown,
  titleRaw: unknown,
): {
  iconName: string
  app: string
  title: string
  displayTitle: string
  tooltip: string
} {
  const app = safeText(appRaw, "", "ACTIVE_WINDOW", "window-class")
  const initialClass = safeText(
    initialClassRaw,
    "",
    "ACTIVE_WINDOW",
    "window-initial-class",
  )
  const title = safeText(titleRaw, "", "ACTIVE_WINDOW", "window-title")
  const identity = safeText(
    app || initialClass,
    "Desktop",
    "ACTIVE_WINDOW",
    "window-identity",
  )
  const iconName = resolveAppIcon(theme, identity)
  const displayTitle = safeText(
    title || identity,
    "Desktop",
    "ACTIVE_WINDOW",
    "display-title",
  )
  const tooltip = safeText(
    title ? `${identity} · ${title}` : identity,
    "Desktop",
    "ACTIVE_WINDOW",
    "tooltip",
  )
  return {
    iconName,
    app: identity,
    title,
    displayTitle,
    tooltip,
  }
}

function fallbackState(): ActiveWindowState {
  return {
    iconName: DESKTOP_APP_ICON,
    app: "Desktop",
    title: "",
    displayTitle: "Desktop",
    tooltip: "Desktop",
  }
}

export default function ActiveWindowChip() {
  barLog("ACTIVE_WINDOW", "mounting ActiveWindowChip")
  let iconTheme: any = null

  const state = createPoll<ActiveWindowState>(
    fallbackState(),
    BAR_UI.timing.activeWindowPollMs,
    async (prev) => {
      try {
        const raw = await execAsync(
          `bash -lc "hyprctl -j activewindow 2>/dev/null || echo '{}'"`,
        )
        const parsed = JSON.parse(raw) as {
          title?: unknown
          class?: unknown
          initialClass?: unknown
        }
        const hasWindowIdentity =
          typeof parsed.class === "string" ||
          typeof parsed.initialClass === "string" ||
          typeof parsed.title === "string"
        if (!hasWindowIdentity) return fallbackState()
        const next = resolveDisplayTitle(
          iconTheme,
          parsed.class ?? "",
          parsed.initialClass ?? "",
          parsed.title ?? "",
        )
        if (
          next.iconName === prev.iconName &&
          next.app === prev.app &&
          next.title === prev.title &&
          next.displayTitle === prev.displayTitle &&
          next.tooltip === prev.tooltip
        ) {
          return prev
        }
        return next
      } catch {
        return prev
      }
    },
  )

  return (
    <box
      class="active-window-chip"
      spacing={BAR_UI.spacing.inline}
      valign={Gtk.Align.CENTER}
      $={(self: any) => {
        try {
          const display = self.get_display?.()
          if (display && typeof Gtk.IconTheme.get_for_display === "function") {
            iconTheme = Gtk.IconTheme.get_for_display(display)
          }
        } catch {
          iconTheme = null
        }
      }}
    >
      <image
        class="active-window-icon"
        iconName={state((s) =>
          safeText(s.iconName, FALLBACK_APP_ICON, "ACTIVE_WINDOW", "icon-name"),
        )}
        pixelSize={BAR_UI.size.activeWindowIcon}
      />
      <label
        class="active-window-title"
        label={state((s) =>
          safeText(s.displayTitle, "Desktop", "ACTIVE_WINDOW", "title-label"),
        )}
        tooltipText={state((s) =>
          safeText(s.tooltip, "Desktop", "ACTIVE_WINDOW", "title-tooltip"),
        )}
        widthChars={BAR_UI.text.activeWindowMinChars}
        maxWidthChars={BAR_UI.text.activeWindowMaxChars}
        singleLineMode
        xalign={0}
      />
    </box>
  )
}
