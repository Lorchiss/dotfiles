import { Gtk } from "ags/gtk4"
import { createPoll } from "ags/time"
import {
  openUpdateTerminal,
  readSystemState,
  setPowerProfile,
  type PowerProfile,
  type SystemState,
} from "../../lib/system"

type SystemUiState = SystemState & {
  busy: boolean
  message: string
  messageIsError: boolean
}

const SYSTEM_POLL_MS = 4000

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === "string" && error) return error
  return "No se pudo completar la acción de sistema"
}

function profileLabel(profile: PowerProfile): string {
  if (profile === "power-saver") return "Ahorro"
  if (profile === "balanced") return "Balanceado"
  if (profile === "performance") return "Rendimiento"
  return "No disponible"
}

export default function SystemSection() {
  let busy = false
  let message = ""
  let messageIsError = false
  let forceRefresh = 2

  const state = createPoll<SystemUiState>(
    {
      updatesCount: null,
      maxTemperatureC: null,
      powerProfile: "unknown",
      powerProfileAvailable: false,
      busy: false,
      message: "",
      messageIsError: false,
    },
    SYSTEM_POLL_MS,
    async () => {
      const system = await readSystemState()
      if (forceRefresh > 0) forceRefresh -= 1
      return {
        ...system,
        busy,
        message,
        messageIsError,
      }
    },
  )

  const runAction = async (label: string, action: () => Promise<void>) => {
    if (busy) return
    busy = true
    message = `${label}...`
    messageIsError = false
    forceRefresh = 1

    try {
      await action()
      message = `${label}: OK`
      messageIsError = false
    } catch (error) {
      message = `${label}: ${errorMessage(error)}`
      messageIsError = true
    } finally {
      busy = false
      forceRefresh = 2
    }
  }

  return (
    <box
      class="cc-section cc-system-section"
      orientation={Gtk.Orientation.VERTICAL}
      spacing={10}
    >
      <label class="cc-section-title" label="Sistema" xalign={0} />

      <box class="cc-list-row" spacing={8}>
        <label class="cc-list-title" label="Actualizaciones pendientes" hexpand xalign={0} />
        <label
          class="cc-list-subtitle"
          label={state((snapshot) =>
            snapshot.updatesCount === null ? "--" : `${snapshot.updatesCount}`,
          )}
        />
        <button
          class="cc-action-btn"
          sensitive={state((snapshot) => !snapshot.busy)}
          onClicked={() =>
            void runAction("Abrir actualización manual", () => openUpdateTerminal())
          }
        >
          <label label="Actualizar" />
        </button>
      </box>

      <box class="cc-list-row" spacing={8}>
        <label class="cc-list-title" label="Temperatura máxima" hexpand xalign={0} />
        <label
          class="cc-list-subtitle"
          label={state((snapshot) =>
            snapshot.maxTemperatureC === null
              ? "--"
              : `${snapshot.maxTemperatureC.toFixed(1)}°C`,
          )}
        />
      </box>

      <box class="cc-list-row" orientation={Gtk.Orientation.VERTICAL} spacing={6}>
        <label class="cc-list-title" label="Perfil de energía" xalign={0} />
        <label
          class="cc-list-subtitle"
          label={state((snapshot) =>
            snapshot.powerProfileAvailable
              ? `Actual: ${profileLabel(snapshot.powerProfile)}`
              : "powerprofilesctl no disponible",
          )}
          xalign={0}
        />

        <box spacing={8}>
          <button
            class="cc-action-btn"
            sensitive={state(
              (snapshot) => !snapshot.busy && snapshot.powerProfileAvailable,
            )}
            onClicked={() =>
              void runAction("Perfil ahorro", () => setPowerProfile("power-saver"))
            }
          >
            <label label="Ahorro" />
          </button>
          <button
            class="cc-action-btn"
            sensitive={state(
              (snapshot) => !snapshot.busy && snapshot.powerProfileAvailable,
            )}
            onClicked={() =>
              void runAction("Perfil balanceado", () => setPowerProfile("balanced"))
            }
          >
            <label label="Balanceado" />
          </button>
          <button
            class="cc-action-btn"
            sensitive={state(
              (snapshot) => !snapshot.busy && snapshot.powerProfileAvailable,
            )}
            onClicked={() =>
              void runAction("Perfil rendimiento", () =>
                setPowerProfile("performance"),
              )
            }
          >
            <label label="Rendimiento" />
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
