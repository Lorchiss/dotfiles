import { Gtk } from "ags/gtk4"
import { createPoll } from "ags/time"
import {
  openPavucontrol,
  readAudioState,
  setDefaultSink,
  setDefaultSource,
  type AudioNode,
  type AudioState,
} from "../../lib/audio"

type AudioSectionProps = {
  isActive: () => boolean
}

type AudioUiState = AudioState & {
  busy: boolean
  message: string
  messageIsError: boolean
}

const AUDIO_POLL_MS = 2000

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === "string" && error) return error
  return "No se pudo completar la operación de audio"
}

function shortNodeName(node: AudioNode): string {
  const parts = node.name.split(".")
  return parts[parts.length - 1] || node.name
}

export default function AudioSection({ isActive }: AudioSectionProps) {
  let actionInFlight = false
  let message = ""
  let messageIsError = false
  let forceRefresh = 2

  const state = createPoll<AudioUiState>(
    {
      defaultSink: "",
      defaultSource: "",
      sinks: [],
      sources: [],
      busy: false,
      message: "",
      messageIsError: false,
    },
    AUDIO_POLL_MS,
    async () => {
      const audioState = await readAudioState()

      if (!isActive() && forceRefresh <= 0) {
        return {
          ...audioState,
          busy: actionInFlight,
          message,
          messageIsError,
        }
      }

      if (forceRefresh > 0) forceRefresh -= 1

      return {
        ...audioState,
        busy: actionInFlight,
        message,
        messageIsError,
      }
    },
  )

  const runAction = async (label: string, action: () => Promise<void>) => {
    if (actionInFlight) return
    actionInFlight = true
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
      actionInFlight = false
      forceRefresh = 2
    }
  }

  return (
    <box
      class="cc-section cc-audio-section"
      orientation={Gtk.Orientation.VERTICAL}
      spacing={10}
    >
      <box spacing={8}>
        <label class="cc-section-title" label="Audio" xalign={0} hexpand />
        <button
          class="cc-action-btn"
          sensitive={state((snapshot) => !snapshot.busy)}
          onClicked={() =>
            void runAction("Abrir pavucontrol", () => openPavucontrol())
          }
        >
          <label label="Abrir pavucontrol" />
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

      <box orientation={Gtk.Orientation.VERTICAL} spacing={6}>
        <label class="cc-section-subtitle" label="Salidas" xalign={0} />
        {state((snapshot) => {
          if (!snapshot.sinks.length) {
            return (
              <label
                class="cc-empty-state"
                label="No hay salidas de audio disponibles"
                xalign={0}
              />
            )
          }

          return snapshot.sinks.map((sink) => (
            <box class="cc-list-row" spacing={8}>
              <box orientation={Gtk.Orientation.VERTICAL} hexpand>
                <label class="cc-list-title" label={shortNodeName(sink)} xalign={0} />
                <label
                  class="cc-list-subtitle"
                  label={`${sink.state || "desconocido"}${sink.isDefault ? " · Predeterminada" : ""}`}
                  xalign={0}
                />
              </box>
              <button
                class="cc-action-btn"
                sensitive={state((ui) => !ui.busy && !sink.isDefault)}
                onClicked={() =>
                  void runAction(`Cambiar salida a ${shortNodeName(sink)}`, () =>
                    setDefaultSink(sink.name),
                  )
                }
              >
                <label label={sink.isDefault ? "Activa" : "Usar"} />
              </button>
            </box>
          ))
        })}
      </box>

      <box orientation={Gtk.Orientation.VERTICAL} spacing={6}>
        <label class="cc-section-subtitle" label="Entradas" xalign={0} />
        {state((snapshot) => {
          if (!snapshot.sources.length) {
            return (
              <label
                class="cc-empty-state"
                label="No hay entradas de audio disponibles"
                xalign={0}
              />
            )
          }

          return snapshot.sources.map((source) => (
            <box class="cc-list-row" spacing={8}>
              <box orientation={Gtk.Orientation.VERTICAL} hexpand>
                <label
                  class="cc-list-title"
                  label={shortNodeName(source)}
                  xalign={0}
                />
                <label
                  class="cc-list-subtitle"
                  label={`${source.state || "desconocido"}${source.isDefault ? " · Predeterminada" : ""}`}
                  xalign={0}
                />
              </box>
              <button
                class="cc-action-btn"
                sensitive={state((ui) => !ui.busy && !source.isDefault)}
                onClicked={() =>
                  void runAction(
                    `Cambiar entrada a ${shortNodeName(source)}`,
                    () => setDefaultSource(source.name),
                  )
                }
              >
                <label label={source.isDefault ? "Activa" : "Usar"} />
              </button>
            </box>
          ))
        })}
      </box>
    </box>
  )
}
