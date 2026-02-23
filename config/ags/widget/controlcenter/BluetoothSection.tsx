import { Gtk } from "ags/gtk4"
import { createPoll } from "ags/time"
import {
  connectBluetoothDevice,
  disconnectBluetoothDevice,
  openBluemanFallback,
  pairAndTrustDevice,
  readBluetoothState,
  removeBluetoothDevice,
  setBluetoothPower,
  setBluetoothScan,
  type BluetoothDevice,
  type BluetoothState,
} from "../../lib/bluetooth"

type BluetoothSectionProps = {
  isActive: () => boolean
}

type BluetoothUiState = BluetoothState & {
  busy: boolean
  message: string
  messageIsError: boolean
}

const BLUETOOTH_POLL_MS = 2000

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === "string" && error) return error
  return "No se pudo completar la operación Bluetooth"
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

export default function BluetoothSection({ isActive }: BluetoothSectionProps) {
  let actionInFlight = false
  let message = ""
  let messageIsError = false
  let forceRefresh = 2

  const state = createPoll<BluetoothUiState>(
    {
      controllerName: "",
      powered: false,
      discovering: false,
      devices: [],
      busy: false,
      message: "",
      messageIsError: false,
    },
    BLUETOOTH_POLL_MS,
    async () => {
      const bluetoothState = await readBluetoothState()

      if (!isActive() && forceRefresh <= 0) {
        return {
          ...bluetoothState,
          busy: actionInFlight,
          message,
          messageIsError,
        }
      }

      if (forceRefresh > 0) forceRefresh -= 1

      return {
        ...bluetoothState,
        busy: actionInFlight,
        message,
        messageIsError,
      }
    },
  )

  const readState = () => {
    const source = state as any
    if (typeof source.peek === "function")
      return source.peek() as BluetoothUiState
    if (typeof source === "function") return source() as BluetoothUiState
    return {
      controllerName: "",
      powered: false,
      discovering: false,
      devices: [],
      busy: false,
      message: "",
      messageIsError: false,
    } satisfies BluetoothUiState
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

  const togglePower = async () => {
    const current = readState()
    await runAction(
      current.powered ? "Apagar Bluetooth" : "Encender Bluetooth",
      () => setBluetoothPower(!current.powered),
    )
  }

  const toggleScan = async () => {
    const current = readState()
    await runAction(
      current.discovering ? "Detener escaneo" : "Iniciar escaneo",
      () => setBluetoothScan(!current.discovering),
    )
  }

  const pairDevice = async (device: BluetoothDevice) =>
    runAction(`Emparejar ${device.name}`, () => pairAndTrustDevice(device.mac))

  const connectDevice = async (device: BluetoothDevice) =>
    runAction(`Conectar ${device.name}`, () =>
      connectBluetoothDevice(device.mac),
    )

  const disconnectDevice = async (device: BluetoothDevice) =>
    runAction(`Desconectar ${device.name}`, () =>
      disconnectBluetoothDevice(device.mac),
    )

  const removeDevice = async (device: BluetoothDevice) =>
    runAction(`Eliminar ${device.name}`, () =>
      removeBluetoothDevice(device.mac),
    )

  const renderDevices = (container: any, snapshot: BluetoothUiState) => {
    clearChildren(container)

    if (!snapshot.devices.length) {
      const empty = new Gtk.Label({
        label: "No hay dispositivos Bluetooth detectados",
      })
      setClasses(empty, "cc-empty-state")
      empty.set_xalign(0)
      container.append(empty)
      return
    }

    for (const device of snapshot.devices) {
      const row = new Gtk.Box({ spacing: 8 })
      setClasses(row, "cc-list-row")

      const left = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
      })
      left.set_hexpand(true)

      const title = new Gtk.Label({ label: device.name })
      setClasses(title, "cc-list-title")
      title.set_xalign(0)

      const subtitle = new Gtk.Label({
        label: `${device.mac} · ${device.connected ? "Conectado" : device.paired ? "Emparejado" : "Disponible"}`,
      })
      setClasses(subtitle, "cc-list-subtitle")
      subtitle.set_xalign(0)

      left.append(title)
      left.append(subtitle)

      const actions = new Gtk.Box({ spacing: 6 })

      const pairButton = new Gtk.Button()
      setClasses(pairButton, "cc-action-btn")
      pairButton.set_sensitive(
        !snapshot.busy && snapshot.powered && !device.paired,
      )
      pairButton.connect("clicked", () => {
        void pairDevice(device)
      })
      pairButton.set_child(new Gtk.Label({ label: "Pair+Trust" }))

      const connectButton = new Gtk.Button()
      setClasses(connectButton, "cc-action-btn")
      connectButton.set_sensitive(
        !snapshot.busy &&
          snapshot.powered &&
          device.paired &&
          !device.connected,
      )
      connectButton.connect("clicked", () => {
        void connectDevice(device)
      })
      connectButton.set_child(new Gtk.Label({ label: "Conectar" }))

      const disconnectButton = new Gtk.Button()
      setClasses(disconnectButton, "cc-action-btn")
      disconnectButton.set_sensitive(
        !snapshot.busy && snapshot.powered && device.connected,
      )
      disconnectButton.connect("clicked", () => {
        void disconnectDevice(device)
      })
      disconnectButton.set_child(new Gtk.Label({ label: "Desconectar" }))

      const removeButton = new Gtk.Button()
      setClasses(removeButton, "cc-action-btn cc-danger-btn")
      removeButton.set_sensitive(!snapshot.busy && device.paired)
      removeButton.connect("clicked", () => {
        void removeDevice(device)
      })
      removeButton.set_child(new Gtk.Label({ label: "Eliminar" }))

      actions.append(pairButton)
      actions.append(connectButton)
      actions.append(disconnectButton)
      actions.append(removeButton)

      row.append(left)
      row.append(actions)
      container.append(row)
    }
  }

  return (
    <box
      class="cc-section cc-bluetooth-section"
      orientation={Gtk.Orientation.VERTICAL}
      spacing={10}
    >
      <box spacing={8}>
        <label class="cc-section-title" label="Bluetooth" xalign={0} hexpand />
        <label
          class="cc-section-subtle"
          label={state((snapshot) =>
            snapshot.controllerName
              ? `${snapshot.controllerName} · ${snapshot.powered ? "Activo" : "Apagado"}`
              : snapshot.powered
                ? "Activo"
                : "Apagado",
          )}
        />
      </box>

      <box spacing={8}>
        <button
          class="cc-action-btn"
          sensitive={state((snapshot) => !snapshot.busy)}
          onClicked={() => void togglePower()}
        >
          <label
            label={state((snapshot) =>
              snapshot.powered ? "Apagar Bluetooth" : "Encender Bluetooth",
            )}
          />
        </button>

        <button
          class="cc-action-btn"
          sensitive={state((snapshot) => !snapshot.busy && snapshot.powered)}
          onClicked={() => void toggleScan()}
        >
          <label
            label={state((snapshot) =>
              snapshot.discovering ? "Detener escaneo" : "Escanear",
            )}
          />
        </button>

        <button
          class="cc-action-btn"
          sensitive={state((snapshot) => !snapshot.busy)}
          onClicked={() =>
            void runAction("Abrir blueman-manager", () => openBluemanFallback())
          }
        >
          <label label="Abrir blueman" />
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

      <box
        class="cc-device-list"
        orientation={Gtk.Orientation.VERTICAL}
        spacing={6}
        $={(self: any) => {
          const source = state as any

          const render = () => {
            renderDevices(self, readState())
          }

          render()
          const unsubscribe = source.subscribe?.(render)
          if (typeof unsubscribe === "function") {
            self.connect("destroy", () => unsubscribe())
          }
        }}
      />
    </box>
  )
}
