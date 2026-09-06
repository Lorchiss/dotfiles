import { Gtk } from "ags/gtk4"
import { createPoll } from "ags/time"
import {
  applyAutomaticDisplayLayout,
  applyDisplayLayout,
  createEmptyDisplayState,
  readDisplayState,
  restoreDailyWorkspaceLayout,
  type DisplayLayoutMode,
  type DisplayMonitorState,
  type DisplayState,
} from "../../lib/displays"
import { safeText } from "../../lib/text"
import {
  controlCenterInlineMessageClass,
  controlCenterInlineMessageLabel,
} from "../../lib/uiFeedback"

type DisplaySectionProps = {
  isActive: () => boolean
}

type DisplayUiState = DisplayState & {
  busy: boolean
  message: string
  messageIsError: boolean
}

const DISPLAY_POLL_MS = 3000
const DISPLAY_MODULE = "CC_DISPLAYS"

function displayText(value: unknown, fallback: string, field: string): string {
  return safeText(value, fallback, DISPLAY_MODULE, field)
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return displayText(error.message, "No se pudo aplicar pantallas", "error")
  }
  if (typeof error === "string" && error) {
    return displayText(error, "No se pudo aplicar pantallas", "error-string")
  }
  return "No se pudo aplicar pantallas"
}

function clearChildren(container: any) {
  let child = container.get_first_child?.()
  while (child) {
    const next = child.get_next_sibling?.()
    container.remove(child)
    child = next
  }
}

function setClasses(widget: any, classes: string) {
  widget.set_css_classes?.(classes.split(" ").filter(Boolean))
}

function monitorDetails(monitor: DisplayMonitorState): string {
  const refreshRate = Math.round(monitor.refreshRate)
  const scale = Math.round(monitor.scale * 100)
  return `${monitor.width} × ${monitor.height} · ${refreshRate} Hz · ${scale}%`
}

function layoutSummary(snapshot: DisplayState): string {
  if (!snapshot.available || snapshot.monitors.length === 0) {
    return snapshot.reason || "Sin pantallas activas"
  }
  if (snapshot.monitors.length === 1) return "1 pantalla activa"

  const [first, second] = snapshot.monitors
  const orientation = first.y === second.y ? "horizontal" : "vertical"
  return `${snapshot.monitors.length} pantallas · escritorio ${orientation}`
}

function renderMonitors(container: any, snapshot: DisplayState) {
  clearChildren(container)

  if (!snapshot.monitors.length) {
    const empty = new Gtk.Label({
      label: displayText(
        snapshot.reason,
        "No se detectaron pantallas activas",
        "empty-monitors",
      ),
    })
    setClasses(empty, "cc-empty-state")
    empty.set_xalign(0)
    container.append(empty)
    return
  }

  for (const monitor of snapshot.monitors) {
    const card = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 5,
    })
    setClasses(
      card,
      monitor.focused
        ? "cc-display-monitor cc-display-monitor-active"
        : "cc-display-monitor",
    )
    card.set_hexpand(true)

    const heading = new Gtk.Box({ spacing: 8 })
    const name = new Gtk.Label({
      label: displayText(monitor.label, monitor.name, "monitor-label"),
    })
    setClasses(name, "cc-display-monitor-title")
    name.set_xalign(0)
    name.set_hexpand(true)
    heading.append(name)

    if (monitor.focused) {
      const focused = new Gtk.Label({ label: "EN FOCO" })
      setClasses(focused, "cc-display-monitor-badge")
      heading.append(focused)
    }

    const details = new Gtk.Label({
      label: displayText(
        monitorDetails(monitor),
        "Resolución no disponible",
        "monitor-details",
      ),
    })
    setClasses(details, "cc-display-monitor-details")
    details.set_xalign(0)

    const position = new Gtk.Label({
      label: displayText(
        `${monitor.name} · posición ${monitor.x}, ${monitor.y}`,
        monitor.name,
        "monitor-position",
      ),
    })
    setClasses(position, "cc-display-monitor-position")
    position.set_xalign(0)

    card.append(heading)
    card.append(details)
    card.append(position)
    container.append(card)
  }
}

export default function DisplaySection({ isActive }: DisplaySectionProps) {
  let busy = false
  let message = ""
  let messageIsError = false
  let forceRefresh = 2

  const state = createPoll<DisplayUiState>(
    {
      ...createEmptyDisplayState(),
      busy: false,
      message: "",
      messageIsError: false,
    },
    DISPLAY_POLL_MS,
    async (prev) => {
      if (!isActive() && forceRefresh <= 0) {
        return {
          ...prev,
          busy,
          message,
          messageIsError,
        }
      }

      const displays = await readDisplayState()
      if (forceRefresh > 0) forceRefresh -= 1
      return {
        ...displays,
        busy,
        message,
        messageIsError,
      }
    },
  )

  const runLayoutAction = async (
    label: string,
    action: () => Promise<void>,
  ) => {
    if (busy) return
    busy = true
    message = displayText(`${label}...`, "Aplicando pantallas...", "start")
    messageIsError = false
    forceRefresh = 1

    try {
      await action()
      message = displayText(`${label}: OK`, "Pantallas: OK", "ok")
      messageIsError = false
    } catch (error) {
      message = displayText(
        `${label}: ${errorMessage(error)}`,
        "No se pudo aplicar pantallas",
        "error-result",
      )
      messageIsError = true
    } finally {
      busy = false
      forceRefresh = 2
    }
  }

  const applyLayout = (label: string, mode: DisplayLayoutMode) => {
    void runLayoutAction(label, () => applyDisplayLayout(mode))
  }

  const readState = () => {
    const source = state as any
    if (typeof source.peek === "function")
      return source.peek() as DisplayUiState
    if (typeof source === "function") return source() as DisplayUiState
    return {
      ...createEmptyDisplayState(),
      busy,
      message,
      messageIsError,
    } satisfies DisplayUiState
  }

  return (
    <box
      class="cc-section cc-display-section"
      orientation={Gtk.Orientation.VERTICAL}
      spacing={10}
    >
      <box class="cc-display-heading" spacing={8}>
        <label class="cc-section-title" label="Pantallas" xalign={0} hexpand />
        <label
          class="cc-section-subtle"
          label={state((snapshot) =>
            displayText(layoutSummary(snapshot), "Sin datos", "layout-summary"),
          )}
        />
      </box>

      <box
        class="cc-display-monitors"
        spacing={8}
        $={(self: any) => {
          const source = state as any
          const render = () => renderMonitors(self, readState())

          render()
          const unsubscribe = source.subscribe?.(render)
          if (typeof unsubscribe === "function") {
            self.connect("destroy", () => unsubscribe())
          }
        }}
      />

      <box
        class="cc-display-layouts"
        orientation={Gtk.Orientation.VERTICAL}
        spacing={8}
      >
        <box spacing={8}>
          <label
            class="cc-list-title"
            label="Organizar escritorio"
            xalign={0}
            hexpand
          />
          <label class="cc-section-subtle" label="Se aplica inmediatamente" />
        </box>

        <box class="cc-action-row cc-display-action-row" spacing={8}>
          <button
            class="cc-display-preset cc-display-preset-primary"
            sensitive={state((snapshot) => !snapshot.busy)}
            hexpand
            onClicked={() =>
              void runLayoutAction("Detectar y extender", () =>
                applyAutomaticDisplayLayout(),
              )
            }
          >
            <box spacing={10}>
              <image iconName="view-grid-symbolic" pixelSize={18} />
              <box orientation={Gtk.Orientation.VERTICAL} spacing={2} hexpand>
                <label
                  class="cc-display-preset-title"
                  label="Automática"
                  xalign={0}
                />
                <label
                  class="cc-display-preset-subtitle"
                  label="Detectar y extender"
                  xalign={0}
                />
              </box>
            </box>
          </button>
          <button
            class="cc-display-preset"
            sensitive={state((snapshot) => !snapshot.busy)}
            hexpand
            onClicked={() =>
              applyLayout("Extender HDMI derecha", "secondary-right")
            }
          >
            <box spacing={10}>
              <image iconName="go-next-symbolic" pixelSize={18} />
              <box orientation={Gtk.Orientation.VERTICAL} spacing={2} hexpand>
                <label
                  class="cc-display-preset-title"
                  label="A la derecha"
                  xalign={0}
                />
                <label
                  class="cc-display-preset-subtitle"
                  label="HDMI junto a DP"
                  xalign={0}
                />
              </box>
            </box>
          </button>
        </box>

        <box class="cc-action-row cc-display-action-row" spacing={8}>
          <button
            class="cc-display-preset"
            sensitive={state((snapshot) => !snapshot.busy)}
            hexpand
            onClicked={() =>
              applyLayout("Extender HDMI izquierda", "secondary-left")
            }
          >
            <box spacing={10}>
              <image iconName="go-previous-symbolic" pixelSize={18} />
              <box orientation={Gtk.Orientation.VERTICAL} spacing={2} hexpand>
                <label
                  class="cc-display-preset-title"
                  label="A la izquierda"
                  xalign={0}
                />
                <label
                  class="cc-display-preset-subtitle"
                  label="HDMI antes de DP"
                  xalign={0}
                />
              </box>
            </box>
          </button>
          <button
            class="cc-display-preset"
            sensitive={state((snapshot) => !snapshot.busy)}
            hexpand
            onClicked={() => applyLayout("Apilar HDMI abajo", "stacked")}
          >
            <box spacing={10}>
              <image iconName="go-down-symbolic" pixelSize={18} />
              <box orientation={Gtk.Orientation.VERTICAL} spacing={2} hexpand>
                <label
                  class="cc-display-preset-title"
                  label="Debajo"
                  xalign={0}
                />
                <label
                  class="cc-display-preset-subtitle"
                  label="HDMI bajo DP"
                  xalign={0}
                />
              </box>
            </box>
          </button>
        </box>
      </box>

      <box
        class="cc-display-utilities"
        orientation={Gtk.Orientation.VERTICAL}
        spacing={8}
      >
        <label class="cc-list-title" label="Acciones rápidas" xalign={0} />
        <box class="cc-action-row cc-display-action-row" spacing={8}>
          <button
            class="cc-action-btn cc-display-single-btn"
            sensitive={state((snapshot) => !snapshot.busy)}
            hexpand
            onClicked={() => applyLayout("Solo DP", "primary-only")}
          >
            <label label="Usar solo DP" />
          </button>
          <button
            class="cc-action-btn cc-display-single-btn"
            sensitive={state((snapshot) => !snapshot.busy)}
            hexpand
            onClicked={() => applyLayout("Solo HDMI", "secondary-only")}
          >
            <label label="Usar solo HDMI" />
          </button>
          <button
            class="cc-action-btn cc-action-quiet cc-display-workspaces-btn"
            sensitive={state((snapshot) => !snapshot.busy)}
            hexpand
            onClicked={() =>
              void runLayoutAction("Reubicar workspaces", () =>
                restoreDailyWorkspaceLayout(),
              )
            }
          >
            <label label="Reubicar workspaces" />
          </button>
        </box>
        <label
          class="cc-display-warning"
          label="Los modos de una sola pantalla desactivan temporalmente la otra salida."
          xalign={0}
        />
      </box>

      <label
        class={state((snapshot) =>
          controlCenterInlineMessageClass(snapshot.messageIsError),
        )}
        label={state((snapshot) =>
          controlCenterInlineMessageLabel(
            snapshot.message,
            snapshot.busy,
            DISPLAY_MODULE,
            "inline-message",
          ),
        )}
        visible={state((snapshot) => Boolean(snapshot.message))}
        xalign={0}
      />
    </box>
  )
}
