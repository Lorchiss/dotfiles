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
import { safeText } from "../../lib/text"
import {
  controlCenterInlineMessageClass,
  controlCenterInlineMessageLabel,
} from "../../lib/uiFeedback"

type BluetoothSectionProps = {
  isActive: () => boolean
}

type BluetoothUiState = BluetoothState & {
  busy: boolean
  message: string
  messageIsError: boolean
}

const BLUETOOTH_POLL_MS = 2000
const BLUETOOTH_INACTIVE_SKIP_TICKS = 15
const BLUETOOTH_MODULE = "CC_BLUETOOTH"

function bluetoothText(
  value: unknown,
  fallback: string,
  field: string,
): string {
  return safeText(value, fallback, BLUETOOTH_MODULE, field)
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message)
    return bluetoothText(
      error.message,
      "No se pudo completar la operación Bluetooth",
      "error",
    )
  if (typeof error === "string" && error)
    return bluetoothText(
      error,
      "No se pudo completar la operación Bluetooth",
      "error",
    )
  return bluetoothText(
    "No se pudo completar la operación Bluetooth",
    "No se pudo completar la operación Bluetooth",
    "error-fallback",
  )
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
  let pollTick = 0

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
    async (prev) => {
      pollTick += 1
      const shouldRefresh =
        forceRefresh > 0 ||
        isActive() ||
        prev.devices.length === 0 ||
        pollTick % BLUETOOTH_INACTIVE_SKIP_TICKS === 0
      if (!shouldRefresh) {
        return {
          ...prev,
          busy: actionInFlight,
          message,
          messageIsError,
        }
      }

      const bluetoothState = await readBluetoothState()

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
    message = bluetoothText(
      `${label}...`,
      "Procesando acción Bluetooth...",
      "run-action-start",
    )
    messageIsError = false
    forceRefresh = 1

    try {
      await action()
      message = bluetoothText(
        `${label}: OK`,
        "Acción Bluetooth: OK",
        "run-action-ok",
      )
      messageIsError = false
    } catch (error) {
      message = bluetoothText(
        `${label}: ${errorMessage(error)}`,
        "No se pudo completar la acción Bluetooth",
        "run-action-error",
      )
      messageIsError = true
    } finally {
      actionInFlight = false
      forceRefresh = 2
    }
  }

  const togglePower = async () => {
    const current = readState()
    await runAction(
      bluetoothText(
        current.powered ? "Apagar Bluetooth" : "Encender Bluetooth",
        "Bluetooth",
        "toggle-power",
      ),
      () => setBluetoothPower(!current.powered),
    )
  }

  const toggleScan = async () => {
    const current = readState()
    await runAction(
      bluetoothText(
        current.discovering ? "Detener escaneo" : "Iniciar escaneo",
        "Escaneo Bluetooth",
        "toggle-scan",
      ),
      () => setBluetoothScan(!current.discovering),
    )
  }

  const pairDevice = async (device: BluetoothDevice) =>
    runAction(
      bluetoothText(
        `Emparejar ${device.name}`,
        "Emparejar dispositivo",
        "pair-device",
      ),
      () => pairAndTrustDevice(device.mac),
    )

  const connectDevice = async (device: BluetoothDevice) =>
    runAction(
      bluetoothText(
        `Conectar ${device.name}`,
        "Conectar dispositivo",
        "connect-device",
      ),
      () => connectBluetoothDevice(device.mac),
    )

  const disconnectDevice = async (device: BluetoothDevice) =>
    runAction(
      bluetoothText(
        `Desconectar ${device.name}`,
        "Desconectar dispositivo",
        "disconnect-device",
      ),
      () => disconnectBluetoothDevice(device.mac),
    )

  const removeDevice = async (device: BluetoothDevice) =>
    runAction(
      bluetoothText(
        `Eliminar ${device.name}`,
        "Eliminar dispositivo",
        "remove-device",
      ),
      () => removeBluetoothDevice(device.mac),
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

      const deviceName = bluetoothText(device.name, "Bluetooth", "device-name")
      const title = new Gtk.Label({ label: deviceName })
      setClasses(title, "cc-list-title")
      title.set_xalign(0)

      const subtitle = new Gtk.Label({
        label: bluetoothText(
          `${device.mac} · ${device.connected ? "Conectado" : device.paired ? "Emparejado" : "Disponible"}`,
          "Sin estado",
          "device-subtitle",
        ),
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
      pairButton.set_child(
        new Gtk.Label({
          label: bluetoothText("Pair+Trust", "Pair+Trust", "pair-label"),
        }),
      )

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
      connectButton.set_child(
        new Gtk.Label({
          label: bluetoothText("Conectar", "Conectar", "connect-label"),
        }),
      )

      const disconnectButton = new Gtk.Button()
      setClasses(disconnectButton, "cc-action-btn")
      disconnectButton.set_sensitive(
        !snapshot.busy && snapshot.powered && device.connected,
      )
      disconnectButton.connect("clicked", () => {
        void disconnectDevice(device)
      })
      disconnectButton.set_child(
        new Gtk.Label({
          label: bluetoothText(
            "Desconectar",
            "Desconectar",
            "disconnect-label",
          ),
        }),
      )

      const removeButton = new Gtk.Button()
      setClasses(removeButton, "cc-action-btn cc-danger-btn")
      removeButton.set_sensitive(!snapshot.busy && device.paired)
      removeButton.connect("clicked", () => {
        void removeDevice(device)
      })
      removeButton.set_child(
        new Gtk.Label({
          label: bluetoothText("Eliminar", "Eliminar", "remove-label"),
        }),
      )

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
            bluetoothText(
              snapshot.controllerName
                ? `${snapshot.controllerName} · ${snapshot.powered ? "Activo" : "Apagado"}`
                : snapshot.powered
                  ? "Activo"
                  : "Apagado",
              "Bluetooth",
              "controller-subtitle",
            ),
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
              bluetoothText(
                snapshot.powered ? "Apagar Bluetooth" : "Encender Bluetooth",
                "Bluetooth",
                "power-label",
              ),
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
              bluetoothText(
                snapshot.discovering ? "Detener escaneo" : "Escanear",
                "Escanear",
                "scan-label",
              ),
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
          controlCenterInlineMessageClass(snapshot.messageIsError),
        )}
        label={state((snapshot) =>
          controlCenterInlineMessageLabel(
            snapshot.message,
            snapshot.busy,
            BLUETOOTH_MODULE,
            "inline-message",
          ),
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
