import { Gtk } from "ags/gtk4"
import { createPoll } from "ags/time"
import {
  openPavucontrol,
  readAudioState,
  setDefaultSink,
  setDefaultSource,
  setSinkVolume,
  toggleSinkMute,
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
const AUDIO_VOLUME_STEP = 5

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === "string" && error) return error
  return "No se pudo completar la operación de audio"
}

function shortNodeName(node: AudioNode): string {
  const parts = node.name.split(".")
  return parts[parts.length - 1] || node.name
}

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
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

export default function AudioSection({ isActive }: AudioSectionProps) {
  let actionInFlight = false
  let message = ""
  let messageIsError = false
  let forceRefresh = 2
  let syncingScale = false
  let ignoreScaleSyncUntil = 0

  const state = createPoll<AudioUiState>(
    {
      defaultSink: "",
      defaultSource: "",
      sinks: [],
      sources: [],
      volume: 0,
      muted: false,
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

  const readState = () => {
    const source = state as any
    if (typeof source.peek === "function") return source.peek() as AudioUiState
    if (typeof source === "function") return source() as AudioUiState
    return {
      defaultSink: "",
      defaultSource: "",
      sinks: [],
      sources: [],
      volume: 0,
      muted: false,
      busy: false,
      message: "",
      messageIsError: false,
    } satisfies AudioUiState
  }

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

  const setVolume = async (value: number) => {
    try {
      await setSinkVolume(clampVolume(value))
    } catch {
      message = "No se pudo ajustar el volumen"
      messageIsError = true
    }
  }

  const renderSinks = (container: any, snapshot: AudioUiState) => {
    clearChildren(container)

    if (!snapshot.sinks.length) {
      const empty = new Gtk.Label({
        label: "No hay salidas de audio disponibles",
      })
      setClasses(empty, "cc-empty-state")
      empty.set_xalign(0)
      container.append(empty)
      return
    }

    for (const sink of snapshot.sinks) {
      const row = new Gtk.Box({ spacing: 8 })
      setClasses(row, "cc-list-row")

      const left = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
      })
      left.set_hexpand(true)

      const title = new Gtk.Label({ label: shortNodeName(sink) })
      setClasses(title, "cc-list-title")
      title.set_xalign(0)

      const subtitle = new Gtk.Label({
        label: `${sink.state || "desconocido"}${sink.isDefault ? " · Predeterminada" : ""}`,
      })
      setClasses(subtitle, "cc-list-subtitle")
      subtitle.set_xalign(0)

      left.append(title)
      left.append(subtitle)

      const action = new Gtk.Button()
      setClasses(action, "cc-action-btn")
      action.set_sensitive(!snapshot.busy && !sink.isDefault)
      action.connect("clicked", () => {
        void runAction(`Cambiar salida a ${shortNodeName(sink)}`, () =>
          setDefaultSink(sink.name),
        )
      })
      action.set_child(
        new Gtk.Label({ label: sink.isDefault ? "Activa" : "Usar" }),
      )

      row.append(left)
      row.append(action)
      container.append(row)
    }
  }

  const renderSources = (container: any, snapshot: AudioUiState) => {
    clearChildren(container)

    if (!snapshot.sources.length) {
      const empty = new Gtk.Label({
        label: "No hay entradas de audio disponibles",
      })
      setClasses(empty, "cc-empty-state")
      empty.set_xalign(0)
      container.append(empty)
      return
    }

    for (const source of snapshot.sources) {
      const row = new Gtk.Box({ spacing: 8 })
      setClasses(row, "cc-list-row")

      const left = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
      })
      left.set_hexpand(true)

      const title = new Gtk.Label({ label: shortNodeName(source) })
      setClasses(title, "cc-list-title")
      title.set_xalign(0)

      const subtitle = new Gtk.Label({
        label: `${source.state || "desconocido"}${source.isDefault ? " · Predeterminada" : ""}`,
      })
      setClasses(subtitle, "cc-list-subtitle")
      subtitle.set_xalign(0)

      left.append(title)
      left.append(subtitle)

      const action = new Gtk.Button()
      setClasses(action, "cc-action-btn")
      action.set_sensitive(!snapshot.busy && !source.isDefault)
      action.connect("clicked", () => {
        void runAction(`Cambiar entrada a ${shortNodeName(source)}`, () =>
          setDefaultSource(source.name),
        )
      })
      action.set_child(
        new Gtk.Label({ label: source.isDefault ? "Activa" : "Usar" }),
      )

      row.append(left)
      row.append(action)
      container.append(row)
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

      <box class="cc-list-row cc-audio-volume-row" spacing={10}>
        <button
          class="cc-action-btn"
          sensitive={state((snapshot) => !snapshot.busy)}
          onClicked={() => {
            const current = readState()
            void runAction(current.muted ? "Activar sonido" : "Silenciar", () =>
              toggleSinkMute(),
            )
          }}
        >
          <label
            label={state((snapshot) =>
              snapshot.muted ? "Activar sonido" : "Silenciar",
            )}
          />
        </button>

        <Gtk.Scale
          class="cc-audio-scale"
          orientation={Gtk.Orientation.HORIZONTAL}
          hexpand
          drawValue={false}
          roundDigits={0}
          $={(self) => {
            self.set_range(0, 100)
            self.set_increments(1, AUDIO_VOLUME_STEP)

            const syncFromState = () => {
              if (Date.now() < ignoreScaleSyncUntil) return
              const next = clampVolume(readState().volume)
              if (Math.round(self.get_value()) !== next) {
                syncingScale = true
                self.set_value(next)
                syncingScale = false
              }
            }

            syncFromState()
            const unsubscribe = (state as any).subscribe?.(syncFromState)
            if (typeof unsubscribe === "function") {
              self.connect("destroy", () => unsubscribe())
            }
          }}
          onValueChanged={(self) => {
            if (syncingScale) return
            ignoreScaleSyncUntil = Date.now() + 500
            void setVolume(self.get_value())
          }}
        />

        <label
          class="cc-section-subtitle cc-audio-volume-label"
          label={state((snapshot) => `${clampVolume(snapshot.volume)}%`)}
        />
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
        <box
          class="cc-device-list"
          orientation={Gtk.Orientation.VERTICAL}
          spacing={6}
          $={(self: any) => {
            const source = state as any

            const render = () => {
              renderSinks(self, readState())
            }

            render()
            const unsubscribe = source.subscribe?.(render)
            if (typeof unsubscribe === "function") {
              self.connect("destroy", () => unsubscribe())
            }
          }}
        />
      </box>

      <box orientation={Gtk.Orientation.VERTICAL} spacing={6}>
        <label class="cc-section-subtitle" label="Entradas" xalign={0} />
        <box
          class="cc-device-list"
          orientation={Gtk.Orientation.VERTICAL}
          spacing={6}
          $={(self: any) => {
            const source = state as any

            const render = () => {
              renderSources(self, readState())
            }

            render()
            const unsubscribe = source.subscribe?.(render)
            if (typeof unsubscribe === "function") {
              self.connect("destroy", () => unsubscribe())
            }
          }}
        />
      </box>
    </box>
  )
}
