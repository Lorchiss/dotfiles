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
import { safeText } from "../../lib/text"
import {
  controlCenterInlineMessageClass,
  controlCenterInlineMessageLabel,
} from "../../lib/uiFeedback"

type WifiSectionProps = {
  isActive: () => boolean
}

type WifiUiState = WifiState & {
  busy: boolean
  message: string
  messageIsError: boolean
  passwordTarget: string
}

const WIFI_POLL_MS = 1500
const WIFI_INACTIVE_SKIP_TICKS = 16
const WIFI_MODULE = "CC_WIFI"

function wifiText(value: unknown, fallback: string, field: string): string {
  return safeText(value, fallback, WIFI_MODULE, field)
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message)
    return wifiText(
      error.message,
      "No se pudo completar la operación Wi-Fi",
      "error",
    )
  if (typeof error === "string" && error)
    return wifiText(error, "No se pudo completar la operación Wi-Fi", "error")
  return wifiText(
    "No se pudo completar la operación Wi-Fi",
    "No se pudo completar la operación Wi-Fi",
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

export default function WifiSection({ isActive }: WifiSectionProps) {
  let actionInFlight = false
  let message = ""
  let messageIsError = false
  let forceNetworkRefresh = 2
  let pollTick = 0
  let wifiPassword = ""
  let passwordTarget = ""
  let lastNetworkRenderKey = ""

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
      passwordTarget: "",
    },
    WIFI_POLL_MS,
    async (prev) => {
      pollTick += 1
      const shouldRefresh =
        forceNetworkRefresh > 0 ||
        isActive() ||
        prev.networks.length === 0 ||
        pollTick % WIFI_INACTIVE_SKIP_TICKS === 0
      if (!shouldRefresh) {
        return {
          ...prev,
          busy: actionInFlight,
          message,
          messageIsError,
          passwordTarget,
        }
      }

      const editingPassword = Boolean(passwordTarget) && !actionInFlight
      const includeNetworks =
        !editingPassword &&
        (forceNetworkRefresh > 0 ||
          prev.networks.length === 0 ||
          (isActive() ? pollTick % 4 === 0 : pollTick % 10 === 0))

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
        passwordTarget,
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
      passwordTarget: "",
    } satisfies WifiUiState
  }

  const runAction = async (
    label: string,
    action: () => Promise<void>,
  ): Promise<boolean> => {
    if (actionInFlight) return false
    actionInFlight = true
    message = wifiText(
      `${label}...`,
      "Procesando acción Wi-Fi...",
      "run-action-start",
    )
    messageIsError = false
    forceNetworkRefresh = 1

    try {
      await action()
      message = wifiText(`${label}: OK`, "Acción Wi-Fi: OK", "run-action-ok")
      messageIsError = false
      return true
    } catch (error) {
      message = wifiText(
        `${label}: ${errorMessage(error)}`,
        "No se pudo completar la acción Wi-Fi",
        "run-action-error",
      )
      messageIsError = true
      return false
    } finally {
      actionInFlight = false
      forceNetworkRefresh = 2
    }
  }

  const connectToNetwork = async (network: WifiNetwork) => {
    const current = readState()
    const networkName = wifiText(
      network.displayName,
      "Red Wi-Fi",
      "network-name",
    )
    if (network.inUse) {
      message = wifiText(
        `${networkName} ya está conectada`,
        "Red ya conectada",
        "already-connected",
      )
      messageIsError = false
      return
    }
    if (!network.ssid) {
      message = wifiText(
        "Red oculta: usa nmtui para configuración avanzada",
        "Red oculta: usa nmtui",
        "hidden-network",
      )
      messageIsError = true
      return
    }
    if (!current.primaryInterface) {
      message = wifiText(
        "No hay interfaz Wi-Fi disponible",
        "No hay interfaz Wi-Fi disponible",
        "missing-interface",
      )
      messageIsError = true
      return
    }
    if (wifiNeedsPassword(network)) {
      if (passwordTarget !== network.ssid) {
        passwordTarget = network.ssid
        wifiPassword = ""
        message = wifiText(
          `Ingresa la contraseña para ${networkName}`,
          "Ingresa la contraseña de la red",
          "password-required",
        )
        messageIsError = false
        return
      }

      if (!wifiPassword.trim()) {
        message = wifiText(
          `Ingresa la contraseña para ${networkName}`,
          "Ingresa la contraseña de la red",
          "password-empty",
        )
        messageIsError = false
        return
      }
    }

    const success = await runAction(
      wifiText(
        `Conectar ${networkName}`,
        "Conectar red Wi-Fi",
        "connect-network",
      ),
      () =>
        connectWifiNetwork(
          network.ssid,
          current.primaryInterface,
          wifiNeedsPassword(network) ? wifiPassword : undefined,
        ),
    )
    if (success) {
      passwordTarget = ""
      wifiPassword = ""
    }
  }

  const disconnectCurrent = async () => {
    const current = readState()
    if (!current.primaryInterface) return
    passwordTarget = ""
    await runAction("Desconectar", () =>
      disconnectWifiInterface(current.primaryInterface),
    )
  }

  const toggleRadio = async () => {
    const current = readState()
    passwordTarget = ""
    await runAction(
      wifiText(
        current.radioEnabled ? "Apagar Wi-Fi" : "Encender Wi-Fi",
        "Wi-Fi",
        "toggle-radio",
      ),
      () => setWifiRadio(!current.radioEnabled),
    )
  }

  const renderNetworks = (container: any, snapshot: WifiUiState) => {
    const networkRenderKey = JSON.stringify({
      busy: snapshot.busy,
      primaryInterface: snapshot.primaryInterface,
      passwordTarget: snapshot.passwordTarget,
      networks: snapshot.networks.map((network) => ({
        ssid: network.ssid,
        displayName: network.displayName,
        signal: network.signal,
        security: network.security,
        bars: network.bars,
        inUse: network.inUse,
      })),
    })
    if (networkRenderKey === lastNetworkRenderKey) return
    lastNetworkRenderKey = networkRenderKey

    clearChildren(container)

    if (!snapshot.networks.length) {
      const empty = new Gtk.Label({ label: "No hay redes Wi-Fi detectadas" })
      setClasses(empty, "cc-empty-state")
      empty.set_xalign(0)
      container.append(empty)
      return
    }

    for (const network of snapshot.networks) {
      const networkName = wifiText(
        network.displayName,
        "Red Wi-Fi",
        "network-title",
      )
      const networkSecurity = wifiText(
        network.security || "Abierta",
        "Abierta",
        "network-security",
      )
      const networkBars = network.bars
        ? wifiText(network.bars, "", "network-bars")
        : ""
      const row = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 8,
      })
      setClasses(row, "cc-list-row")

      const topRow = new Gtk.Box({ spacing: 8 })

      const left = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
      })
      left.set_hexpand(true)

      const title = new Gtk.Label({ label: networkName })
      setClasses(title, "cc-list-title")
      title.set_xalign(0)

      const subtitle = new Gtk.Label({
        label: wifiText(
          `${network.signal}% · ${networkSecurity} ${networkBars ? `· ${networkBars}` : ""}`,
          "Sin datos de señal",
          "network-subtitle",
        ),
      })
      setClasses(subtitle, "cc-list-subtitle")
      subtitle.set_xalign(0)

      left.append(title)
      left.append(subtitle)

      const action = new Gtk.Button()
      setClasses(action, "cc-action-btn")
      action.set_sensitive(
        !snapshot.busy && !network.inUse && !!snapshot.primaryInterface,
      )
      action.connect("clicked", () => {
        void connectToNetwork(network)
      })
      action.set_child(
        new Gtk.Label({
          label: wifiText(
            network.inUse ? "Conectada" : "Conectar",
            "Conectar",
            "network-action-label",
          ),
        }),
      )

      topRow.append(left)
      topRow.append(action)
      row.append(topRow)

      if (snapshot.passwordTarget && network.ssid === snapshot.passwordTarget) {
        const passwordRow = new Gtk.Box({ spacing: 8 })
        setClasses(passwordRow, "cc-inline-auth-row")

        const passwordEntry = new Gtk.Entry({
          placeholder_text: wifiText(
            `Contraseña para ${networkName}`,
            "Contraseña de la red",
            "password-placeholder",
          ),
          visibility: false,
        })
        passwordEntry.set_text(wifiPassword)
        passwordEntry.set_hexpand(true)
        passwordEntry.set_sensitive(!snapshot.busy)
        passwordEntry.connect("changed", () => {
          const nextText = passwordEntry.get_text?.() ?? ""
          wifiPassword = String(nextText)
        })
        passwordEntry.connect("notify::has-focus", () => {
          const focusAccessor = (passwordEntry as any).has_focus
          const hasFocus =
            typeof focusAccessor === "function"
              ? Boolean(focusAccessor.call(passwordEntry))
              : Boolean(focusAccessor)
          if (hasFocus) return
          if (actionInFlight) return
          if (wifiPassword.trim()) return
          passwordTarget = ""
          message = ""
          messageIsError = false
        })
        passwordEntry.connect("activate", () => {
          const nextText = passwordEntry.get_text?.() ?? ""
          wifiPassword = String(nextText)
          void connectToNetwork(network)
        })

        passwordRow.append(passwordEntry)
        row.append(passwordRow)
      }
      container.append(row)
    }
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
            wifiText(
              snapshot.currentConnection
                ? `Conectado: ${snapshot.currentConnection}`
                : "Sin conexión activa",
              "Sin conexión activa",
              "connection-subtitle",
            ),
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
              wifiText(
                snapshot.radioEnabled ? "Apagar Wi-Fi" : "Encender Wi-Fi",
                "Wi-Fi",
                "radio-label",
              ),
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

      <label
        class={state((snapshot) =>
          controlCenterInlineMessageClass(snapshot.messageIsError),
        )}
        label={state((snapshot) =>
          controlCenterInlineMessageLabel(
            snapshot.message,
            snapshot.busy,
            WIFI_MODULE,
            "inline-message",
          ),
        )}
        visible={state((snapshot) => Boolean(snapshot.message))}
        xalign={0}
      />

      <box
        class="cc-network-list"
        orientation={Gtk.Orientation.VERTICAL}
        spacing={6}
        $={(self: any) => {
          const source = state as any

          const render = () => {
            renderNetworks(self, readState())
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
