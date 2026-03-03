import { Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { createPoll } from "ags/time"
import { BAR_UI } from "../../lib/uiTokens"
import { safeText } from "../../lib/text"
import { barLog } from "../../lib/barObservability"

type NetworkState = {
  mode: "offline" | "wifi" | "ethernet"
  label: string
  detail: string
  iconName: string
}

function isConnectedState(state: string): boolean {
  const normalized = state.trim().toLowerCase()
  return (
    normalized.includes("connected") && !normalized.includes("disconnected")
  )
}

function resolveNetworkState(
  radioRaw: string,
  deviceStatusRaw: string,
): NetworkState {
  const radioEnabled = radioRaw.trim().toLowerCase() === "enabled"
  const rows = deviceStatusRaw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(":"))
    .filter((parts) => parts.length >= 3)
    .map(([type = "", state = "", connection = ""]) => ({
      type: type.trim().toLowerCase(),
      state: state.trim().toLowerCase(),
      connection: connection.trim(),
    }))

  const connected = rows.find((row) => isConnectedState(row.state))
  if (connected?.type === "wifi") {
    const networkName = safeText(
      connected.connection,
      "Wi-Fi",
      "NETWORK",
      "wifi-connection",
    )
    return {
      mode: "wifi",
      label: networkName,
      detail: safeText(
        `Wi-Fi conectado · ${networkName}`,
        "Wi-Fi conectado",
        "NETWORK",
        "wifi-detail",
      ),
      iconName: "network-wireless-signal-excellent-symbolic",
    }
  }

  if (connected?.type === "ethernet") {
    return {
      mode: "ethernet",
      label: "Ethernet",
      detail: "Ethernet conectado",
      iconName: "network-wired-symbolic",
    }
  }

  if (!radioEnabled) {
    return {
      mode: "offline",
      label: "Sin red",
      detail: "Wi-Fi desactivado",
      iconName: "network-wireless-disabled-symbolic",
    }
  }

  return {
    mode: "offline",
    label: "Sin red",
    detail: "Sin conexión de red",
    iconName: "network-offline-symbolic",
  }
}

export default function NetworkChip({ compact = false }: { compact?: boolean } = {}) {
  barLog("CONNECTIVITY", "mounting NetworkChip")
  const state = createPoll<NetworkState>(
    {
      mode: "offline",
      label: "Sin red",
      detail: "Sin conexión de red",
      iconName: "network-offline-symbolic",
    },
    BAR_UI.timing.networkPollMs,
    async (prev) => {
      try {
        const [radioRaw, deviceStatusRaw] = await Promise.all([
          execAsync(
            `bash -lc "LC_ALL=C nmcli -t -f WIFI g 2>/dev/null || echo disabled"`,
          ),
          execAsync(
            `bash -lc "LC_ALL=C nmcli -t -f TYPE,STATE,CONNECTION device status 2>/dev/null || true"`,
          ),
        ])
        return resolveNetworkState(radioRaw, deviceStatusRaw)
      } catch {
        return prev
      }
    },
  )

  return (
    <button
      class={state((s) =>
        compact
          ? `network-chip network-chip-compact network-${s.mode}`
          : `network-chip network-${s.mode}`
      )}
      tooltipText={state((s) =>
        safeText(s.detail, "Sin conexión de red", "NETWORK", "chip-tooltip"),
      )}
      valign={Gtk.Align.CENTER}
      onClicked={() => execAsync("ags toggle control-center").catch(() => {})}
    >
      <box spacing={BAR_UI.spacing.tight}>
        <image
          class="network-chip-icon"
          iconName={state((s) => s.iconName)}
          pixelSize={BAR_UI.size.networkIcon}
        />
        {!compact ? (
          <label
            class="network-chip-label"
            label={state((s) =>
              safeText(s.label, "Sin red", "NETWORK", "chip-label"),
            )}
            maxWidthChars={BAR_UI.text.networkLabelChars}
            singleLineMode
          />
        ) : null}
      </box>
    </button>
  )
}
