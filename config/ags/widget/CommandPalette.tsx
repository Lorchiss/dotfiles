import app from "ags/gtk4/app"
import { Astal, Gdk, Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { runCommand } from "../lib/command"
import { createMusicAccentClassState } from "../lib/musicAccent"
import {
  monitorFromLayout,
  onOverlayVisibilityChanged,
  overlayLayoutBinding,
  registerOverlayWindow,
} from "../lib/overlayOrchestrator"
import { openInTerminal } from "../lib/terminal"
import { COMMAND_PALETTE_UI } from "../lib/uiTokens"

type PaletteAction = {
  id: string
  title: string
  subtitle: string
  keywords: string[]
  category: "Apps" | "Sistema" | "Mantenimiento"
  priority: number
  run: () => Promise<void>
  searchText?: string
}

const SYSTEM_UPDATE_SCRIPT = `${SRC}/scripts/system_update.sh`
const SMOKE_SCRIPT_CANDIDATES = [
  `${SRC}/../../bootstrap/ags-smoke.sh`,
  `${SRC}/../bootstrap/ags-smoke.sh`,
  "$HOME/.dotfiles/bootstrap/ags-smoke.sh",
  "$HOME/Desktop/dev/dotfiles/bootstrap/ags-smoke.sh",
]

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
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

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim())
    return error.message.trim()
  if (typeof error === "string" && error.trim()) return error.trim()
  return "No se pudo completar la acción"
}

async function notify(title: string, body: string, urgency = "normal") {
  const cleanTitle = title.trim() || "Command Palette"
  const cleanBody = body.trim()
  if (!cleanBody) return

  const command = `notify-send -u ${shellQuote(urgency)} ${shellQuote(cleanTitle)} ${shellQuote(cleanBody)}`
  await execAsync(`bash -lc ${shellQuote(command)}`).catch(() => {})
}

async function openBrowserAction() {
  await runCommand(
    `
if [ -n "$BROWSER" ] && command -v "$BROWSER" >/dev/null 2>&1; then
  nohup "$BROWSER" >/dev/null 2>&1 &
elif command -v firefox >/dev/null 2>&1; then
  nohup firefox >/dev/null 2>&1 &
elif command -v brave >/dev/null 2>&1; then
  nohup brave >/dev/null 2>&1 &
elif command -v chromium >/dev/null 2>&1; then
  nohup chromium >/dev/null 2>&1 &
elif command -v google-chrome-stable >/dev/null 2>&1; then
  nohup google-chrome-stable >/dev/null 2>&1 &
elif command -v xdg-open >/dev/null 2>&1; then
  nohup xdg-open https://duckduckgo.com >/dev/null 2>&1 &
else
  echo "No se encontró navegador compatible"
  exit 1
fi
`,
    { timeoutMs: 3000 },
  )
}

async function openEditorAction() {
  await runCommand(
    `
if command -v obsidian >/dev/null 2>&1; then
  nohup obsidian >/dev/null 2>&1 &
elif command -v code >/dev/null 2>&1; then
  nohup code >/dev/null 2>&1 &
elif command -v codium >/dev/null 2>&1; then
  nohup codium >/dev/null 2>&1 &
elif command -v zed >/dev/null 2>&1; then
  nohup zed >/dev/null 2>&1 &
elif command -v xdg-open >/dev/null 2>&1; then
  nohup xdg-open obsidian://open >/dev/null 2>&1 &
else
  echo "No se encontró Obsidian/editor compatible"
  exit 1
fi
`,
    { timeoutMs: 3000 },
  )
}

async function lockScreenAction() {
  await runCommand(
    `
if command -v hyprlock >/dev/null 2>&1; then
  nohup hyprlock >/dev/null 2>&1 &
elif command -v loginctl >/dev/null 2>&1; then
  loginctl lock-session
elif command -v swaylock >/dev/null 2>&1; then
  nohup swaylock -f >/dev/null 2>&1 &
else
  echo "No se encontró bloqueador de pantalla"
  exit 1
fi
`,
    { timeoutMs: 3500 },
  )
}

async function screenshotAction() {
  await runCommand(
    `
mkdir -p "$HOME/Pictures/Screenshots"
file="$HOME/Pictures/Screenshots/ss-$(date +%F_%H-%M-%S).png"

if command -v grim >/dev/null 2>&1 && command -v slurp >/dev/null 2>&1; then
  pgrep -x slurp >/dev/null 2>&1 && exit 0
  grim -g "$(slurp)" "$file"
elif command -v gnome-screenshot >/dev/null 2>&1; then
  gnome-screenshot -a -f "$file"
else
  echo "No se encontró backend de screenshot (grim+slurp o gnome-screenshot)"
  exit 1
fi

echo "$file"
`,
    { timeoutMs: 20_000 },
  )
}

async function openUpdateDryRunAction() {
  await openInTerminal(
    `
script_path=${shellQuote(SYSTEM_UPDATE_SCRIPT)}
if [ ! -f "$script_path" ]; then
  script_path="$HOME/.config/ags/scripts/system_update.sh"
fi

if [ ! -f "$script_path" ]; then
  echo "No se encontró system_update.sh"
  echo "$script_path"
  echo
  read -r -p "Enter para cerrar" _
  exit 1
fi

[ -x "$script_path" ] || chmod +x "$script_path" >/dev/null 2>&1 || true

bash "$script_path" --dry-run
status=$?
echo
if [ "$status" -eq 0 ]; then
  echo "[command-palette] dry-run completado"
else
  echo "[command-palette] dry-run falló ($status)"
fi
read -r -p "Enter para cerrar" _
exit "$status"
`,
  )
}

async function openAgsLogsAction() {
  await openInTerminal(`journalctl --user -u ags.service -f -n 200`)
}

async function runSmokeTestAction() {
  const candidateLines = [
    `  ${shellQuote(SMOKE_SCRIPT_CANDIDATES[0])}`,
    `  ${shellQuote(SMOKE_SCRIPT_CANDIDATES[1])}`,
    `  "${SMOKE_SCRIPT_CANDIDATES[2]}"`,
    `  "${SMOKE_SCRIPT_CANDIDATES[3]}"`,
  ].join("\n")

  await openInTerminal(
    `
script_path=""
candidates=(
${candidateLines}
)

for candidate in "\${candidates[@]}"; do
  if [ -f "$candidate" ]; then
    script_path="$candidate"
    break
  fi
done

if [ -z "$script_path" ]; then
  echo "No se encontró bootstrap/ags-smoke.sh en rutas conocidas"
  echo
  read -r -p "Enter para cerrar" _
  exit 1
fi

[ -x "$script_path" ] || chmod +x "$script_path" >/dev/null 2>&1 || true

bash "$script_path"
status=$?
echo
if [ "$status" -eq 0 ]; then
  echo "[command-palette] smoke test PASS"
else
  echo "[command-palette] smoke test FAIL ($status)"
fi
read -r -p "Enter para cerrar" _
exit "$status"
`,
  )
}

const ACTIONS: PaletteAction[] = [
  {
    id: "app-terminal",
    title: "Abrir terminal",
    subtitle: "Lanza una terminal interactiva",
    category: "Apps",
    keywords: ["app", "shell", "kitty", "foot", "terminal"],
    priority: 100,
    run: () => openInTerminal(`exec "\${SHELL:-bash}"`),
  },
  {
    id: "app-browser",
    title: "Abrir navegador",
    subtitle: "Abre Firefox/Chromium o navegador por defecto",
    category: "Apps",
    keywords: ["app", "web", "internet", "firefox", "browser"],
    priority: 80,
    run: openBrowserAction,
  },
  {
    id: "app-editor",
    title: "Abrir editor / Obsidian",
    subtitle: "Prioriza Obsidian y fallback a editor",
    category: "Apps",
    keywords: ["app", "editor", "obsidian", "code", "codium", "zed"],
    priority: 85,
    run: openEditorAction,
  },
  {
    id: "sys-lock",
    title: "Lock screen",
    subtitle: "Bloquea la sesión actual",
    category: "Sistema",
    keywords: ["system", "screen", "lock", "seguridad", "hyprlock"],
    priority: 98,
    run: lockScreenAction,
  },
  {
    id: "sys-screenshot",
    title: "Screenshot",
    subtitle: "Captura área seleccionada",
    category: "Sistema",
    keywords: ["system", "capture", "screenshot", "grim", "slurp"],
    priority: 70,
    run: screenshotAction,
  },
  {
    id: "sys-restart-ags",
    title: "Reiniciar AGS",
    subtitle: "Reinicia ags.service (usuario)",
    category: "Sistema",
    keywords: ["system", "ags", "restart", "service"],
    priority: 75,
    run: async () => {
      await runCommand(
        `systemctl --user restart ags.service && systemctl --user is-active --quiet ags.service`,
        {
          timeoutMs: 9000,
          dedupeKey: "command-palette-restart-ags",
        },
      )
    },
  },
  {
    id: "sys-control-center",
    title: "Abrir control center",
    subtitle: "Toggle del panel de control",
    category: "Sistema",
    keywords: ["system", "control", "center", "wifi", "bluetooth", "audio"],
    priority: 90,
    run: async () => {
      await runCommand(`ags toggle control-center`, { timeoutMs: 2000 })
    },
  },
  {
    id: "sys-spotify-popup",
    title: "Abrir Spotify popup",
    subtitle: "Toggle del panel de Spotify",
    category: "Sistema",
    keywords: ["system", "spotify", "music", "popup", "media"],
    priority: 92,
    run: async () => {
      await runCommand(`ags toggle spotify`, { timeoutMs: 2000 })
    },
  },
  {
    id: "maint-update-dry-run",
    title: "Update dry-run",
    subtitle: "Ejecuta system_update.sh --dry-run en terminal",
    category: "Mantenimiento",
    keywords: ["maintenance", "update", "dry-run", "pacman", "paru"],
    priority: 72,
    run: openUpdateDryRunAction,
  },
  {
    id: "maint-logs",
    title: "Abrir logs AGS",
    subtitle: "Sigue logs de ags.service con journalctl",
    category: "Mantenimiento",
    keywords: ["maintenance", "logs", "journalctl", "debug", "ags"],
    priority: 78,
    run: openAgsLogsAction,
  },
  {
    id: "maint-smoke",
    title: "Correr smoke test",
    subtitle: "Ejecuta bootstrap/ags-smoke.sh",
    category: "Mantenimiento",
    keywords: ["maintenance", "smoke", "test", "qa", "ags-smoke"],
    priority: 76,
    run: runSmokeTestAction,
  },
]

for (const action of ACTIONS) {
  action.searchText = normalizeText(
    `${action.title} ${action.subtitle} ${action.keywords.join(" ")} ${action.category}`,
  )
}

function filterActions(query: string): PaletteAction[] {
  const normalized = normalizeText(query)
  const terms = normalized.split(" ").filter(Boolean)

  const scoreAction = (action: PaletteAction): number => {
    if (!terms.length) return action.priority

    const title = normalizeText(action.title)
    const subtitle = normalizeText(action.subtitle)
    const category = normalizeText(action.category)
    const searchText = action.searchText ?? ""

    let score = action.priority
    for (const term of terms) {
      if (!searchText.includes(term)) return -1

      if (title.startsWith(term)) score += 80
      else if (title.includes(term)) score += 46
      else if (subtitle.includes(term)) score += 24
      else if (category.includes(term)) score += 18
      else score += 10
    }

    return score
  }

  return ACTIONS.map((action) => ({ action, score: scoreAction(action) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.action)
}

export default function CommandPalette() {
  let windowRef: any = null
  let inputRef: any = null
  let listRef: any = null
  let statusRef: any = null
  let query = ""
  let selectedIndex = 0
  let filteredActions: PaletteAction[] = [...ACTIONS]
  const itemRefs: any[] = []
  const accentClass = createMusicAccentClassState()
  const overlayLayout = overlayLayoutBinding()

  const closePalette = () => {
    if (!windowRef) return
    windowRef.visible = false
  }

  const setStatus = (message: string, isError: boolean) => {
    if (!statusRef) return
    statusRef.set_label?.(message)
    setClasses(
      statusRef,
      isError
        ? "command-palette-status command-palette-status-error"
        : "command-palette-status",
    )
  }

  const syncActiveItemClasses = () => {
    for (let i = 0; i < itemRefs.length; i++) {
      const classes =
        i === selectedIndex
          ? "command-palette-item command-palette-item-active"
          : "command-palette-item"
      setClasses(itemRefs[i], classes)
    }
  }

  const renderList = () => {
    if (!listRef) return
    clearChildren(listRef)
    itemRefs.length = 0

    if (!filteredActions.length) {
      const empty = new Gtk.Label({ label: "Sin resultados para tu búsqueda" })
      empty.set_xalign(0)
      setClasses(empty, "command-palette-empty")
      listRef.append(empty)
      return
    }

    for (let i = 0; i < filteredActions.length; i++) {
      const action = filteredActions[i]
      const button = new Gtk.Button({
        halign: Gtk.Align.FILL,
        hexpand: true,
      })
      setClasses(button, "command-palette-item")

      const row = new Gtk.Box({ spacing: 10 })

      const left = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 2,
      })
      left.set_hexpand(true)

      const title = new Gtk.Label({ label: action.title })
      title.set_xalign(0)
      setClasses(title, "command-palette-item-title")

      const subtitle = new Gtk.Label({ label: action.subtitle })
      subtitle.set_xalign(0)
      setClasses(subtitle, "command-palette-item-subtitle")

      left.append(title)
      left.append(subtitle)

      const category = new Gtk.Label({ label: action.category })
      setClasses(category, "command-palette-item-category")

      row.append(left)
      row.append(category)
      button.set_child(row)

      button.connect("clicked", () => {
        selectedIndex = i
        syncActiveItemClasses()
        void executeSelectedAction()
      })

      itemRefs.push(button)
      listRef.append(button)
    }

    syncActiveItemClasses()
  }

  const refreshFilter = () => {
    filteredActions = filterActions(query)
    if (!filteredActions.length) {
      selectedIndex = -1
    } else if (selectedIndex < 0 || selectedIndex >= filteredActions.length) {
      selectedIndex = 0
    }
    renderList()
  }

  const moveSelection = (delta: number) => {
    if (!filteredActions.length) return
    const total = filteredActions.length
    const base = selectedIndex < 0 ? 0 : selectedIndex
    selectedIndex = (base + delta + total) % total
    syncActiveItemClasses()
  }

  const executeSelectedAction = async () => {
    if (selectedIndex < 0 || selectedIndex >= filteredActions.length) return

    const action = filteredActions[selectedIndex]
    closePalette()
    try {
      await action.run()
    } catch (error) {
      const detail = normalizeErrorMessage(error)
      await notify("Command Palette", `${action.title}: ${detail}`, "critical")
    }
  }

  const resetAndFocus = () => {
    query = ""
    selectedIndex = 0
    filteredActions = [...ACTIONS]
    setStatus(
      "Filtra por nombre o keyword (ej: logs, screenshot, update).",
      false,
    )
    renderList()

    if (inputRef) {
      inputRef.set_text?.("")
      inputRef.grab_focus?.()
      inputRef.set_position?.(-1)
    }
  }

  const handleKeyPress = (
    _: any,
    keyval: number,
    _keycode: number,
    state: number,
  ) => {
    const hasCtrl = Boolean(state & Gdk.ModifierType.CONTROL_MASK)
    const hasShift = Boolean(state & Gdk.ModifierType.SHIFT_MASK)

    if (keyval === Gdk.KEY_Escape) {
      closePalette()
      return true
    }

    if (keyval === Gdk.KEY_Return || keyval === Gdk.KEY_KP_Enter) {
      void executeSelectedAction()
      return true
    }

    if (keyval === Gdk.KEY_Down || keyval === Gdk.KEY_KP_Down) {
      moveSelection(1)
      return true
    }

    if (keyval === Gdk.KEY_Up || keyval === Gdk.KEY_KP_Up) {
      moveSelection(-1)
      return true
    }

    if (
      keyval === Gdk.KEY_Tab ||
      keyval === Gdk.KEY_ISO_Left_Tab ||
      (hasCtrl && (keyval === Gdk.KEY_j || keyval === Gdk.KEY_J)) ||
      (hasCtrl && (keyval === Gdk.KEY_k || keyval === Gdk.KEY_K))
    ) {
      if (keyval === Gdk.KEY_ISO_Left_Tab || hasShift || keyval === Gdk.KEY_k)
        moveSelection(-1)
      else moveSelection(1)
      return true
    }

    if (keyval === Gdk.KEY_Home) {
      selectedIndex = 0
      syncActiveItemClasses()
      return true
    }

    if (keyval === Gdk.KEY_End && filteredActions.length > 0) {
      selectedIndex = filteredActions.length - 1
      syncActiveItemClasses()
      return true
    }

    return false
  }

  return (
    <window
      name="command-palette"
      class={overlayLayout((layout) =>
        [
          "CommandPalette",
          `overlay-layout-${layout.mode}`,
          layout.focus === "command-palette"
            ? "overlay-focused"
            : layout.focus
              ? "overlay-muted"
              : "",
        ]
          .filter(Boolean)
          .join(" "),
      )}
      application={app}
      visible={false}
      layer={Astal.Layer.OVERLAY}
      gdkmonitor={overlayLayout((layout) => monitorFromLayout(layout))}
      anchor={
        Astal.WindowAnchor.TOP |
        Astal.WindowAnchor.LEFT |
        Astal.WindowAnchor.RIGHT
      }
      marginTop={overlayLayout((layout) => layout.commandPalette.marginTop)}
      marginLeft={0}
      marginRight={0}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.ON_DEMAND}
      $={(window: any) => {
        windowRef = window
        registerOverlayWindow("command-palette", window)

        const keyController = new Gtk.EventControllerKey()
        keyController.connect("key-pressed", handleKeyPress)
        window.add_controller(keyController)

        window.connect("notify::visible", () => {
          onOverlayVisibilityChanged("command-palette", Boolean(window.visible))
          if (window.visible) {
            resetAndFocus()
            return
          }
          setStatus("", false)
        })
      }}
    >
      <box class="command-palette-shell" hexpand halign={Gtk.Align.FILL}>
        <box
          class={accentClass(
            (accent) => `command-palette-card popup-accent-surface ${accent}`,
          )}
          orientation={Gtk.Orientation.VERTICAL}
          spacing={10}
          widthRequest={overlayLayout((layout) => layout.commandPalette.width)}
          halign={Gtk.Align.CENTER}
        >
          <box class="command-palette-header" spacing={10}>
            <label
              class="command-palette-title"
              label="Command Palette"
              hexpand
              xalign={0}
            />
            <label
              class="command-palette-hint"
              label="Esc cerrar · Tab navegar"
            />
          </box>

          <Gtk.Entry
            class="command-palette-input"
            $={(entry: any) => {
              inputRef = entry
              entry.set_placeholder_text?.(
                "Buscar acción (terminal, spotify, lock, logs, update, smoke...)",
              )
              entry.connect("changed", () => {
                query = String(entry.get_text?.() ?? "")
                refreshFilter()
              })
              entry.connect("activate", () => {
                void executeSelectedAction()
              })
            }}
          />

          <Gtk.ScrolledWindow
            class="command-palette-scroll"
            vexpand
            $={(scroll: any) => {
              scroll.set_policy?.(
                Gtk.PolicyType.NEVER,
                Gtk.PolicyType.AUTOMATIC,
              )
              scroll.set_min_content_height?.(COMMAND_PALETTE_UI.minListHeight)
            }}
          >
            <box
              class="command-palette-list"
              orientation={Gtk.Orientation.VERTICAL}
              spacing={6}
              $={(list: any) => {
                listRef = list
                refreshFilter()
              }}
            />
          </Gtk.ScrolledWindow>

          <box class="command-palette-footer" spacing={10}>
            <label
              class="command-palette-status"
              label="Filtra por nombre o keyword (ej: logs, screenshot, update)."
              hexpand
              xalign={0}
              $={(label: any) => {
                statusRef = label
              }}
            />
            <label
              class="command-palette-hint"
              label="↑/↓/Tab mover · Enter ejecutar · Ctrl+J/K"
            />
          </box>
        </box>
      </box>
    </window>
  )
}
