import { Gtk } from "ags/gtk4"
import { createPoll } from "ags/time"
import {
  executeSessionAction,
  sessionActionLabel,
  type SessionAction,
} from "../../lib/session"

type SessionUiState = {
  confirmAction: SessionAction | null
  confirmSecondsLeft: number
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

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === "string" && error) return error
  return "No se pudo completar la acción de sesión"
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
      confirmSecondsLeft: 0,
      busy: false,
      message: "",
      messageIsError: false,
    },
    350,
    () => {
      let confirmSecondsLeft = 0

      if (
        confirmAction &&
        confirmStartedAt > 0 &&
        Date.now() - confirmStartedAt > SESSION_CONFIRM_TIMEOUT_MS
      ) {
        confirmAction = null
        confirmStartedAt = 0
      } else if (confirmAction && confirmStartedAt > 0) {
        const remainingMs =
          SESSION_CONFIRM_TIMEOUT_MS - (Date.now() - confirmStartedAt)
        confirmSecondsLeft = Math.max(0, Math.ceil(remainingMs / 1000))
      }

      return {
        confirmAction,
        confirmSecondsLeft,
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
    message = `Listo para ${sessionActionLabel(action)}`
    messageIsError = isDangerousAction(action)
  }

  const cancelConfirmation = () => {
    confirmAction = null
    confirmStartedAt = 0
    message = "Acción cancelada"
    messageIsError = false
  }

  const executeConfirmedAction = async () => {
    if (!confirmAction || busy) return
    const action = confirmAction

    busy = true
    message = `Ejecutando ${sessionActionLabel(action)}...`
    messageIsError = false

    try {
      await executeSessionAction(action)
      message = `${sessionActionLabel(action)} ejecutado`
      messageIsError = false
      confirmAction = null
      confirmStartedAt = 0
    } catch (error) {
      message = `${sessionActionLabel(action)}: ${errorMessage(error)}`
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
    >
      <label class="cc-section-title" label="Sesión" xalign={0} />
      <label
        class="cc-section-subtle"
        label="Accesos rápidos de energía y salida"
        xalign={0}
      />

      <box
        class="cc-session-grid"
        orientation={Gtk.Orientation.VERTICAL}
        spacing={8}
      >
        <box spacing={8}>
          {SESSION_ACTIONS.filter((item) => !item.dangerous).map((item) => (
            <button
              class="cc-action-btn cc-session-action"
              sensitive={state((snapshot) => !snapshot.busy)}
              onClicked={() => requestConfirmation(item.action)}
            >
              <box
                orientation={Gtk.Orientation.VERTICAL}
                spacing={2}
                vexpand
                valign={Gtk.Align.CENTER}
              >
                <label class="cc-session-action-icon" label={item.icon} />
                <label
                  class="cc-session-action-title"
                  label={sessionActionLabel(item.action)}
                />
                <label class="cc-session-action-hint" label={item.hint} />
              </box>
            </button>
          ))}
        </box>

        <box spacing={8}>
          {SESSION_ACTIONS.filter((item) => item.dangerous).map((item) => (
            <button
              class="cc-action-btn cc-danger-btn cc-session-action cc-session-action-danger"
              sensitive={state((snapshot) => !snapshot.busy)}
              onClicked={() => requestConfirmation(item.action)}
            >
              <box
                orientation={Gtk.Orientation.VERTICAL}
                spacing={2}
                vexpand
                valign={Gtk.Align.CENTER}
              >
                <label class="cc-session-action-icon" label={item.icon} />
                <label
                  class="cc-session-action-title"
                  label={sessionActionLabel(item.action)}
                />
                <label class="cc-session-action-hint" label={item.hint} />
              </box>
            </button>
          ))}
        </box>
      </box>

      <box
        class="cc-confirm-box cc-session-confirm-box"
        orientation={Gtk.Orientation.VERTICAL}
        spacing={8}
        visible={state((snapshot) => snapshot.confirmAction !== null)}
      >
        <label
          class="cc-list-subtitle cc-session-confirm-title"
          xalign={0}
          label={state((snapshot) => {
            if (!snapshot.confirmAction) return ""
            if (isDangerousAction(snapshot.confirmAction)) {
              return `Confirmación doble requerida: ${sessionActionLabel(snapshot.confirmAction)}`
            }
            return `Confirmar ${sessionActionLabel(snapshot.confirmAction)}`
          })}
        />
        <label
          class="cc-section-subtle cc-session-confirm-timer"
          xalign={0}
          label={state((snapshot) =>
            snapshot.confirmAction
              ? `Expira en ${snapshot.confirmSecondsLeft}s`
              : "",
          )}
        />
        <box spacing={8}>
          <button
            class="cc-action-btn cc-danger-btn"
            sensitive={state((snapshot) => !snapshot.busy)}
            onClicked={() => void executeConfirmedAction()}
          >
            <label label="Confirmar" />
          </button>
          <button
            class="cc-action-btn"
            sensitive={state((snapshot) => !snapshot.busy)}
            onClicked={cancelConfirmation}
          >
            <label label="Cancelar" />
          </button>
        </box>
      </box>

      <label
        class={state((snapshot) =>
          snapshot.messageIsError
            ? "cc-inline-message cc-inline-message-error"
            : "cc-inline-message cc-inline-message-success",
        )}
        label={state((snapshot) =>
          snapshot.busy ? `⏳ ${snapshot.message}` : snapshot.message,
        )}
        visible={state((snapshot) => Boolean(snapshot.message))}
        xalign={0}
      />
    </box>
  )
}
