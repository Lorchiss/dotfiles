import { Gtk } from "ags/gtk4"
import { createPoll } from "ags/time"
import {
  createEmptySystemState,
  markLatestArchNewsRead,
  openArchNewsLatest,
  openRollbackTerminal,
  openUpdateTerminal,
  readSystemState,
  refreshSystemUpdatesCache,
  setPowerProfile,
  type PowerProfile,
  type SystemState,
} from "../../lib/system"

type SystemSectionProps = {
  isActive: () => boolean
}

type SystemUiState = SystemState & {
  busy: boolean
  message: string
  messageIsError: boolean
}

const SYSTEM_POLL_MS = 4000
const SYSTEM_INACTIVE_SKIP_TICKS = 8

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

function batteryStatusLabel(status: SystemState["batteryStatus"]): string {
  if (status === "charging") return "Cargando"
  if (status === "discharging") return "Descargando"
  if (status === "full") return "Completa"
  return "No disponible"
}

function formatCount(value: number | null): string {
  return value === null ? "--" : `${value}`
}

function shortTitle(title: string): string {
  const clean = title.trim()
  if (!clean) return "Arch News: sin datos"
  if (clean.length <= 64) return `Arch News: ${clean}`
  return `Arch News: ${clean.slice(0, 61)}...`
}

function formatMinutes(minutes: number | null): string {
  if (minutes === null || minutes <= 0) return "--"

  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60

  if (hours <= 0) return `${mins}m`
  if (mins <= 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

function batteryPrimaryLine(snapshot: SystemUiState): string {
  if (!snapshot.batteryAvailable) return "No disponible (desktop)"

  const percent =
    snapshot.batteryPercent === null ? "--%" : `${snapshot.batteryPercent}%`
  const status = batteryStatusLabel(snapshot.batteryStatus)
  const powerSource =
    snapshot.onAcPower === null
      ? ""
      : snapshot.onAcPower
        ? " · AC"
        : " · Batería"

  return `${percent} · ${status}${powerSource}`
}

function batterySecondaryLine(snapshot: SystemUiState): string {
  if (!snapshot.batteryAvailable) {
    return "No se detectó /sys/class/power_supply/BAT*"
  }

  const health =
    snapshot.batteryHealthPercent === null
      ? "--"
      : `${snapshot.batteryHealthPercent.toFixed(1)}%`

  const power =
    snapshot.powerWatts === null ? "--" : `${snapshot.powerWatts.toFixed(2)}W`

  const eta = formatMinutes(snapshot.timeRemainingMinutes)

  return `Salud: ${health} · Consumo: ${power} · ETA: ${eta}`
}

function updatesSubtitle(snapshot: SystemUiState): string {
  const official = formatCount(snapshot.updatesOfficialCount)
  const aur = snapshot.updatesAurEnabled
    ? formatCount(snapshot.updatesAurCount)
    : "n/d"
  const total = formatCount(snapshot.updatesCount)

  return `Oficial: ${official} · AUR: ${aur} · Total: ${total}`
}

function archNewsSubtitle(snapshot: SystemUiState): string {
  const unread = snapshot.archNewsUnreadCount > 0 ? " · Nuevo" : ""
  return `${shortTitle(snapshot.archNewsTitle)}${unread}`
}

export default function SystemSection({ isActive }: SystemSectionProps) {
  let busy = false
  let message = ""
  let messageIsError = false
  let forceRefresh = 2
  let pollTick = 0

  const state = createPoll<SystemUiState>(
    {
      ...createEmptySystemState(),
      busy: false,
      message: "",
      messageIsError: false,
    },
    SYSTEM_POLL_MS,
    async (prev) => {
      pollTick += 1
      const shouldRefresh =
        forceRefresh > 0 ||
        isActive() ||
        prev.updatesCount === null ||
        pollTick % SYSTEM_INACTIVE_SKIP_TICKS === 0

      if (!shouldRefresh) {
        return {
          ...prev,
          busy,
          message,
          messageIsError,
        }
      }

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

  const runAction = async (
    label: string,
    action: () => Promise<void>,
  ): Promise<boolean> => {
    if (busy) return false
    busy = true
    message = `${label}...`
    messageIsError = false
    forceRefresh = 1

    try {
      await action()
      message = `${label}: OK`
      messageIsError = false
      return true
    } catch (error) {
      message = `${label}: ${errorMessage(error)}`
      messageIsError = true
      return false
    } finally {
      busy = false
      forceRefresh = 2
    }
  }

  const refreshUpdates = async () => {
    if (busy) return
    busy = true
    message = "Refrescar actualizaciones..."
    messageIsError = false
    forceRefresh = 1

    try {
      const updates = await refreshSystemUpdatesCache()
      message =
        updates === null
          ? "Refrescar actualizaciones: sin datos"
          : `Refrescar actualizaciones: total ${updates}`
      messageIsError = false
    } catch (error) {
      message = `Refrescar actualizaciones: ${errorMessage(error)}`
      messageIsError = true
    } finally {
      busy = false
      forceRefresh = 2
    }
  }

  const openNews = async () => {
    const ok = await runAction("Abrir Arch News", async () => {
      await openArchNewsLatest()
      await markLatestArchNewsRead()
    })

    if (ok) forceRefresh = 2
  }

  return (
    <box
      class="cc-section cc-system-section"
      orientation={Gtk.Orientation.VERTICAL}
      spacing={10}
    >
      <label class="cc-section-title" label="Sistema" xalign={0} />

      <box
        class="cc-list-row"
        orientation={Gtk.Orientation.VERTICAL}
        spacing={6}
      >
        <label class="cc-list-title" label="Actualizaciones" xalign={0} />
        <label
          class="cc-list-subtitle"
          label={state((snapshot) => updatesSubtitle(snapshot))}
          xalign={0}
        />
        <label
          class="cc-list-subtitle"
          label={state((snapshot) => archNewsSubtitle(snapshot))}
          xalign={0}
        />

        <box spacing={8}>
          <button
            class="cc-action-btn"
            sensitive={state((snapshot) => !snapshot.busy)}
            onClicked={() => void refreshUpdates()}
          >
            <label label="Refrescar" />
          </button>
          <button
            class="cc-action-btn"
            sensitive={state((snapshot) => !snapshot.busy)}
            onClicked={() =>
              void runAction("Abrir actualización manual", () =>
                openUpdateTerminal(),
              )
            }
          >
            <label label="Actualizar" />
          </button>
          <button
            class="cc-action-btn"
            sensitive={state(
              (snapshot) => !snapshot.busy && Boolean(snapshot.archNewsLink),
            )}
            onClicked={() => void openNews()}
          >
            <label label="Noticias" />
          </button>
        </box>
      </box>

      <box
        class="cc-list-row"
        orientation={Gtk.Orientation.VERTICAL}
        spacing={6}
      >
        <label class="cc-list-title" label="Snapshots" xalign={0} />
        <label
          class="cc-list-subtitle"
          label={state((snapshot) =>
            snapshot.snapperAvailable
              ? "Snapper disponible (config root)"
              : snapshot.snapperStatusReason,
          )}
          xalign={0}
        />
        <box spacing={8}>
          <button
            class="cc-action-btn"
            sensitive={state(
              (snapshot) => !snapshot.busy && snapshot.snapperAvailable,
            )}
            onClicked={() =>
              void runAction("Abrir rollback", () => openRollbackTerminal())
            }
          >
            <label label="Rollback" />
          </button>
        </box>
      </box>

      <box
        class="cc-list-row"
        orientation={Gtk.Orientation.VERTICAL}
        spacing={6}
      >
        <label class="cc-list-title" label="Batería" xalign={0} />
        <label
          class="cc-list-subtitle"
          label={state((snapshot) => batteryPrimaryLine(snapshot))}
          xalign={0}
        />
        <label
          class="cc-list-subtitle"
          label={state((snapshot) => batterySecondaryLine(snapshot))}
          xalign={0}
        />
      </box>

      <box class="cc-list-row" spacing={8}>
        <label
          class="cc-list-title"
          label="Temperatura máxima"
          hexpand
          xalign={0}
        />
        <label
          class="cc-list-subtitle"
          label={state((snapshot) =>
            snapshot.maxTemperatureC === null
              ? "--"
              : `${snapshot.maxTemperatureC.toFixed(1)}°C`,
          )}
        />
      </box>

      <box
        class="cc-list-row"
        orientation={Gtk.Orientation.VERTICAL}
        spacing={6}
      >
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
              void runAction("Perfil ahorro", () =>
                setPowerProfile("power-saver"),
              )
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
              void runAction("Perfil balanceado", () =>
                setPowerProfile("balanced"),
              )
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
