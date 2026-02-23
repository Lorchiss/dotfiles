import { Gtk } from "ags/gtk4"
import { createPoll } from "ags/time"
import {
  executeSessionAction,
  sessionActionLabel,
  type SessionAction,
} from "../../lib/session"

type SessionUiState = {
  confirmAction: SessionAction | null
  busy: boolean
  message: string
  messageIsError: boolean
}

const SESSION_CONFIRM_TIMEOUT_MS = 12000

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
    message = `Confirmar: ${sessionActionLabel(action)}`
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

      <box spacing={8}>
        <button
          class="cc-action-btn"
          sensitive={state((snapshot) => !snapshot.busy)}
          onClicked={() => requestConfirmation("logout")}
        >
          <label label="Cerrar sesión" />
        </button>
        <button
          class="cc-action-btn"
          sensitive={state((snapshot) => !snapshot.busy)}
          onClicked={() => requestConfirmation("suspend")}
        >
          <label label="Suspender" />
        </button>
      </box>

      <box spacing={8}>
        <button
          class="cc-action-btn cc-danger-btn"
          sensitive={state((snapshot) => !snapshot.busy)}
          onClicked={() => requestConfirmation("reboot")}
        >
          <label label="Reiniciar" />
        </button>
        <button
          class="cc-action-btn cc-danger-btn"
          sensitive={state((snapshot) => !snapshot.busy)}
          onClicked={() => requestConfirmation("shutdown")}
        >
          <label label="Apagar" />
        </button>
      </box>

      <box
        class="cc-confirm-box"
        spacing={8}
        visible={state((snapshot) => snapshot.confirmAction !== null)}
      >
        <label
          class="cc-list-subtitle"
          xalign={0}
          hexpand
          label={state((snapshot) =>
            snapshot.confirmAction
              ? isDangerousAction(snapshot.confirmAction)
                ? `Confirmación doble requerida: ${sessionActionLabel(snapshot.confirmAction)}`
                : `Confirmar ${sessionActionLabel(snapshot.confirmAction)}`
              : "",
          )}
        />
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
