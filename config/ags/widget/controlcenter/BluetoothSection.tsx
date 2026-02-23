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
    if (typeof source.peek === "function") return source.peek() as BluetoothUiState
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
    runAction(`Conectar ${device.name}`, () => connectBluetoothDevice(device.mac))

  const disconnectDevice = async (device: BluetoothDevice) =>
    runAction(`Desconectar ${device.name}`, () =>
      disconnectBluetoothDevice(device.mac),
    )

  const removeDevice = async (device: BluetoothDevice) =>
    runAction(`Eliminar ${device.name}`, () => removeBluetoothDevice(device.mac))

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
      >
        {state((snapshot) => {
          if (!snapshot.devices.length) {
            return (
              <label
                class="cc-empty-state"
                label="No hay dispositivos Bluetooth detectados"
                xalign={0}
              />
            )
          }

          return snapshot.devices.map((device) => (
            <box class="cc-list-row" spacing={8}>
              <box orientation={Gtk.Orientation.VERTICAL} hexpand>
                <label class="cc-list-title" label={device.name} xalign={0} />
                <label
                  class="cc-list-subtitle"
                  label={`${device.mac} · ${device.connected ? "Conectado" : device.paired ? "Emparejado" : "Disponible"}`}
                  xalign={0}
                />
              </box>

              <box spacing={6}>
                <button
                  class="cc-action-btn"
                  sensitive={state(
                    (ui) => !ui.busy && ui.powered && !device.paired,
                  )}
                  onClicked={() => void pairDevice(device)}
                >
                  <label label="Pair+Trust" />
                </button>

                <button
                  class="cc-action-btn"
                  sensitive={state(
                    (ui) => !ui.busy && ui.powered && device.paired && !device.connected,
                  )}
                  onClicked={() => void connectDevice(device)}
                >
                  <label label="Conectar" />
                </button>

                <button
                  class="cc-action-btn"
                  sensitive={state(
                    (ui) => !ui.busy && ui.powered && device.connected,
                  )}
                  onClicked={() => void disconnectDevice(device)}
                >
                  <label label="Desconectar" />
                </button>

                <button
                  class="cc-action-btn cc-danger-btn"
                  sensitive={state((ui) => !ui.busy && device.paired)}
                  onClicked={() => void removeDevice(device)}
                >
                  <label label="Eliminar" />
                </button>
              </box>
            </box>
          ))
        })}
      </box>
    </box>
  )
}
