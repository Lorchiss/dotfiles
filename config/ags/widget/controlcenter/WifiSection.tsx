import { Gtk } from "ags/gtk4"
import { createPoll } from "ags/time"
import {
  connectWifiNetwork,
  disconnectWifiInterface,
  openNmtuiFallback,
  readWifiState,
  setWifiRadio,
  type WifiNetwork,
  type WifiState,
  wifiNeedsPassword,
} from "../../lib/network"

type WifiSectionProps = {
  isActive: () => boolean
}

type WifiUiState = WifiState & {
  busy: boolean
  message: string
  messageIsError: boolean
}

const WIFI_POLL_MS = 1500

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === "string" && error) return error
  return "No se pudo completar la operación Wi-Fi"
}

export default function WifiSection({ isActive }: WifiSectionProps) {
  let actionInFlight = false
  let message = ""
  let messageIsError = false
  let forceNetworkRefresh = 2
  let pollTick = 0
  let wifiPassword = ""

  const state = createPoll<WifiUiState>(
    {
      radioEnabled: false,
      interfaces: [],
      primaryInterface: "",
      currentConnection: "",
      networks: [],
      busy: false,
      message: "",
      messageIsError: false,
    },
    WIFI_POLL_MS,
    async (prev) => {
      pollTick += 1
      const includeNetworks =
        forceNetworkRefresh > 0 ||
        prev.networks.length === 0 ||
        (isActive() ? pollTick % 4 === 0 : pollTick % 10 === 0)

      if (forceNetworkRefresh > 0) forceNetworkRefresh -= 1

      const wifiState = await readWifiState({
        includeNetworks,
        previousNetworks: prev.networks,
      })

      return {
        ...wifiState,
        busy: actionInFlight,
        message,
        messageIsError,
      }
    },
  )

  const readState = () => {
    const source = state as any
    if (typeof source.peek === "function") return source.peek() as WifiUiState
    if (typeof source === "function") return source() as WifiUiState
    return {
      radioEnabled: false,
      interfaces: [],
      primaryInterface: "",
      currentConnection: "",
      networks: [],
      busy: false,
      message: "",
      messageIsError: false,
    } satisfies WifiUiState
  }

  const runAction = async (label: string, action: () => Promise<void>) => {
    if (actionInFlight) return
    actionInFlight = true
    message = `${label}...`
    messageIsError = false
    forceNetworkRefresh = 1

    try {
      await action()
      message = `${label}: OK`
      messageIsError = false
    } catch (error) {
      message = `${label}: ${errorMessage(error)}`
      messageIsError = true
    } finally {
      actionInFlight = false
      forceNetworkRefresh = 2
    }
  }

  const connectToNetwork = async (network: WifiNetwork) => {
    const current = readState()
    if (network.inUse) {
      message = `${network.displayName} ya está conectada`
      messageIsError = false
      return
    }
    if (!network.ssid) {
      message = "Red oculta: usa nmtui para configuración avanzada"
      messageIsError = true
      return
    }
    if (!current.primaryInterface) {
      message = "No hay interfaz Wi-Fi disponible"
      messageIsError = true
      return
    }
    if (wifiNeedsPassword(network) && !wifiPassword.trim()) {
      message = `La red ${network.displayName} requiere contraseña`
      messageIsError = true
      return
    }

    await runAction(`Conectar ${network.displayName}`, () =>
      connectWifiNetwork(
        network.ssid,
        current.primaryInterface,
        wifiNeedsPassword(network) ? wifiPassword : undefined,
      ),
    )
  }

  const disconnectCurrent = async () => {
    const current = readState()
    if (!current.primaryInterface) return
    await runAction("Desconectar", () =>
      disconnectWifiInterface(current.primaryInterface),
    )
  }

  const toggleRadio = async () => {
    const current = readState()
    await runAction(current.radioEnabled ? "Apagar Wi-Fi" : "Encender Wi-Fi", () =>
      setWifiRadio(!current.radioEnabled),
    )
  }

  return (
    <box
      class="cc-section cc-wifi-section"
      orientation={Gtk.Orientation.VERTICAL}
      spacing={10}
    >
      <box spacing={8}>
        <label class="cc-section-title" label="Wi-Fi" xalign={0} hexpand />
        <label
          class="cc-section-subtle"
          label={state((snapshot) =>
            snapshot.currentConnection
              ? `Conectado: ${snapshot.currentConnection}`
              : "Sin conexión activa",
          )}
        />
      </box>

      <box spacing={8}>
        <button
          class="cc-action-btn"
          sensitive={state((snapshot) => !snapshot.busy)}
          onClicked={() => void toggleRadio()}
        >
          <label
            label={state((snapshot) =>
              snapshot.radioEnabled ? "Apagar Wi-Fi" : "Encender Wi-Fi",
            )}
          />
        </button>

        <button
          class="cc-action-btn"
          sensitive={state(
            (snapshot) =>
              !snapshot.busy &&
              !!snapshot.primaryInterface &&
              !!snapshot.currentConnection,
          )}
          onClicked={() => void disconnectCurrent()}
        >
          <label label="Desconectar" />
        </button>

        <button
          class="cc-action-btn"
          sensitive={state((snapshot) => !snapshot.busy)}
          onClicked={() =>
            void runAction("Abrir nmtui", () => openNmtuiFallback())
          }
        >
          <label label="Abrir nmtui" />
        </button>
      </box>

      <entry
        class="cc-password-entry"
        placeholderText="Contraseña Wi-Fi (si la red lo requiere)"
        visibility={false}
        onChanged={(entry: any) => {
          const nextText = entry.get_text?.() ?? entry.text ?? ""
          wifiPassword = String(nextText)
        }}
      />

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
        class="cc-network-list"
        orientation={Gtk.Orientation.VERTICAL}
        spacing={6}
      >
        {state((snapshot) => {
          if (!snapshot.networks.length) {
            return (
              <label
                class="cc-empty-state"
                label="No hay redes Wi-Fi detectadas"
                xalign={0}
              />
            )
          }

          return snapshot.networks.map((network) => (
            <box class="cc-list-row" spacing={8}>
              <box orientation={Gtk.Orientation.VERTICAL} hexpand>
                <label class="cc-list-title" label={network.displayName} xalign={0} />
                <label
                  class="cc-list-subtitle"
                  label={`${network.signal}% · ${network.security || "Abierta"} ${network.bars ? `· ${network.bars}` : ""}`}
                  xalign={0}
                />
              </box>

              <button
                class="cc-action-btn"
                sensitive={state(
                  (ui) => !ui.busy && !network.inUse && !!ui.primaryInterface,
                )}
                onClicked={() => void connectToNetwork(network)}
              >
                <label label={network.inUse ? "Conectada" : "Conectar"} />
              </button>
            </box>
          ))
        })}
      </box>
    </box>
  )
}
