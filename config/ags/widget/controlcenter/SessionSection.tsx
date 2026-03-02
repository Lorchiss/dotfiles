import { Gtk } from "ags/gtk4"
import { createPoll } from "ags/time"
import {
  executeSessionAction,
  sessionActionLabel,
  type SessionAction,
} from "../../lib/session"
import { safeText } from "../../lib/text"
import {
  controlCenterInlineMessageClass,
  controlCenterInlineMessageLabel,
} from "../../lib/uiFeedback"

type SessionUiState = {
  confirmAction: SessionAction | null
  busy: boolean
  message: string
  messageIsError: boolean
}

const SESSION_CONFIRM_TIMEOUT_MS = 12000
const SESSION_ACTIONS: Array<{
  action: SessionAction
  icon: string
  hint: string
  dangerous: boolean
}> = [
  {
    action: "logout",
    icon: "↩",
    hint: "Cierra la sesión actual",
    dangerous: false,
  },
  {
    action: "suspend",
    icon: "⏾",
    hint: "Pausa el equipo",
    dangerous: false,
  },
  {
    action: "reboot",
    icon: "↻",
    hint: "Reinicia el sistema",
    dangerous: true,
  },
  {
    action: "shutdown",
    icon: "⏻",
    hint: "Apaga el equipo",
    dangerous: true,
  },
]
const SESSION_ACTION_ROWS = [
  SESSION_ACTIONS.slice(0, 2),
  SESSION_ACTIONS.slice(2, 4),
]
const SESSION_MODULE = "CC_SESSION"

function sessionText(value: unknown, fallback: string, field: string): string {
  return safeText(value, fallback, SESSION_MODULE, field)
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message)
    return sessionText(
      error.message,
      "No se pudo completar la acción de sesión",
      "error",
    )
  if (typeof error === "string" && error)
    return sessionText(
      error,
      "No se pudo completar la acción de sesión",
      "error",
    )
  return sessionText(
    "No se pudo completar la acción de sesión",
    "No se pudo completar la acción de sesión",
    "error-fallback",
  )
}

function isDangerousAction(action: SessionAction): boolean {
  return action === "reboot" || action === "shutdown"
}

export default function SessionSection() {
  let confirmAction: SessionAction | null = null
  let confirmStartedAt = 0
  let busy = false
  let message = ""
  let messageIsError = false

  const state = createPoll<SessionUiState>(
    {
      confirmAction: null,
      busy: false,
      message: "",
      messageIsError: false,
    },
    350,
    () => {
      if (
        confirmAction &&
        confirmStartedAt > 0 &&
        Date.now() - confirmStartedAt > SESSION_CONFIRM_TIMEOUT_MS
      ) {
        confirmAction = null
        confirmStartedAt = 0
      }

      return {
        confirmAction,
        busy,
        message,
        messageIsError,
      }
    },
  )

  const requestConfirmation = (action: SessionAction) => {
    if (busy) return
    confirmAction = action
    confirmStartedAt = Date.now()
    message = ""
    messageIsError = isDangerousAction(action)
  }

  const handleActionClick = (action: SessionAction) => {
    if (busy) return
    if (confirmAction === action) {
      void executeConfirmedAction()
      return
    }
    requestConfirmation(action)
  }

  const executeConfirmedAction = async () => {
    if (!confirmAction || busy) return
    const action = confirmAction
    const actionLabel = sessionText(
      sessionActionLabel(action),
      "acción",
      "action-label",
    )

    busy = true
    message = sessionText(
      `Ejecutando ${actionLabel}...`,
      "Ejecutando acción...",
      "execute-start",
    )
    messageIsError = false

    try {
      await executeSessionAction(action)
      message = sessionText(
        `${actionLabel} ejecutado`,
        "Acción ejecutada",
        "execute-ok",
      )
      messageIsError = false
      confirmAction = null
      confirmStartedAt = 0
    } catch (error) {
      message = sessionText(
        `${actionLabel}: ${errorMessage(error)}`,
        "No se pudo completar la acción de sesión",
        "execute-error",
      )
      messageIsError = true
    } finally {
      busy = false
    }
  }

  return (
    <box
      class="cc-section cc-session-section"
      orientation={Gtk.Orientation.VERTICAL}
      spacing={10}
      hexpand
    >
      <label class="cc-section-title" label="Sesión" xalign={0} />
      <label
        class="cc-section-subtle"
        label="Accesos rápidos de energía y salida"
        xalign={0}
      />

      <box
        class="cc-session-actions"
        orientation={Gtk.Orientation.VERTICAL}
        spacing={8}
      >
        {SESSION_ACTION_ROWS.map((row) => (
          <box class="cc-session-grid-row" spacing={8} homogeneous>
            {row.map((item) => (
              <button
                class={state((snapshot) =>
                  [
                    "cc-action-btn",
                    "cc-session-tile",
                    item.dangerous ? "cc-session-tile-danger" : "",
                    snapshot.confirmAction === item.action
                      ? "cc-session-tile-pending"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" "),
                )}
                sensitive={state((snapshot) => !snapshot.busy)}
                hexpand
                vexpand
                halign={Gtk.Align.FILL}
                valign={Gtk.Align.FILL}
                onClicked={() => handleActionClick(item.action)}
              >
                <box
                  class="cc-session-tile-content"
                  orientation={Gtk.Orientation.VERTICAL}
                  spacing={4}
                  valign={Gtk.Align.CENTER}
                  halign={Gtk.Align.CENTER}
                  vexpand
                >
                  <label
                    class={state((snapshot) =>
                      [
                        "cc-session-tile-icon",
                        item.dangerous ? "cc-session-tile-icon-danger" : "",
                        snapshot.confirmAction === item.action
                          ? "cc-session-tile-icon-armed"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" "),
                    )}
                    label={item.icon}
                    xalign={0.5}
                  />
                  <label
                    class="cc-session-tile-title"
                    label={sessionText(
                      sessionActionLabel(item.action),
                      "Acción",
                      `tile-title-${item.action}`,
                    )}
                    xalign={0.5}
                    visible={state(
                      (snapshot) => snapshot.confirmAction !== item.action,
                    )}
                  />
                  <label
                    class="cc-session-tile-hint"
                    label={item.hint}
                    xalign={0.5}
                    visible={state(
                      (snapshot) => snapshot.confirmAction !== item.action,
                    )}
                  />
                </box>
              </button>
            ))}
          </box>
        ))}
      </box>

      <label
        class={state((snapshot) =>
          controlCenterInlineMessageClass(snapshot.messageIsError),
        )}
        label={state((snapshot) =>
          controlCenterInlineMessageLabel(
            snapshot.message,
            snapshot.busy,
            SESSION_MODULE,
            "inline-message",
          ),
        )}
        visible={state((snapshot) => Boolean(snapshot.message))}
        xalign={0}
      />
    </box>
  )
}
