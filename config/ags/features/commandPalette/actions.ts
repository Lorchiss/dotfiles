import { execAsync } from "ags/process"
import { runCommand } from "../../lib/command"
import { openControlCenterTab } from "../../lib/controlCenterState"
import { toggleOverlay } from "../../lib/overlayOrchestrator"
import { openInTerminal } from "../../lib/terminal"

export type PaletteAction = {
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

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
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

export const COMMAND_PALETTE_ACTIONS: PaletteAction[] = [
  {
    id: "app-terminal",
    title: "Abrir terminal",
    subtitle: "Lanza una terminal interactiva",
    category: "Apps",
    keywords: ["app", "shell", "kitty", "foot", "terminal", "term", "cli"],
    priority: 100,
    run: () => openInTerminal(`exec "\${SHELL:-bash}"`),
  },
  {
    id: "app-browser",
    title: "Abrir navegador",
    subtitle: "Abre Firefox/Chromium o navegador por defecto",
    category: "Apps",
    keywords: ["app", "web", "internet", "firefox", "browser", "navegador"],
    priority: 80,
    run: openBrowserAction,
  },
  {
    id: "app-editor",
    title: "Abrir editor / Obsidian",
    subtitle: "Prioriza Obsidian y fallback a editor",
    category: "Apps",
    keywords: ["app", "editor", "obsidian", "code", "codium", "zed", "notas"],
    priority: 85,
    run: openEditorAction,
  },
  {
    id: "sys-lock",
    title: "Lock screen",
    subtitle: "Bloquea la sesión actual",
    category: "Sistema",
    keywords: ["system", "screen", "lock", "seguridad", "hyprlock", "bloquear"],
    priority: 98,
    run: lockScreenAction,
  },
  {
    id: "sys-screenshot",
    title: "Screenshot",
    subtitle: "Captura área seleccionada",
    category: "Sistema",
    keywords: ["system", "capture", "screenshot", "grim", "slurp", "captura"],
    priority: 70,
    run: screenshotAction,
  },
  {
    id: "sys-restart-ags",
    title: "Reiniciar AGS",
    subtitle: "Reinicia ags.service (usuario)",
    category: "Sistema",
    keywords: ["system", "ags", "restart", "service", "reload", "reiniciar"],
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
    keywords: [
      "system",
      "control",
      "center",
      "wifi",
      "bluetooth",
      "audio",
      "panel",
    ],
    priority: 90,
    run: async () => toggleOverlay("control-center"),
  },
  {
    id: "sys-control-displays",
    title: "Abrir pantallas",
    subtitle: "Control Center directo a layouts de monitor",
    category: "Sistema",
    keywords: [
      "system",
      "control",
      "center",
      "display",
      "displays",
      "pantalla",
      "pantallas",
      "monitor",
      "monitores",
      "hdmi",
      "dp",
      "layout",
    ],
    priority: 96,
    run: () => openControlCenterTab("displays"),
  },
  {
    id: "sys-control-audio",
    title: "Abrir audio",
    subtitle: "Control Center directo a salidas y volumen",
    category: "Sistema",
    keywords: [
      "system",
      "control",
      "center",
      "audio",
      "sound",
      "sonido",
      "volumen",
      "sink",
      "microfono",
    ],
    priority: 94,
    run: () => openControlCenterTab("audio"),
  },
  {
    id: "sys-control-system",
    title: "Abrir sistema",
    subtitle: "Control Center directo a updates, batería y energía",
    category: "Sistema",
    keywords: [
      "system",
      "control",
      "center",
      "sistema",
      "updates",
      "actualizaciones",
      "battery",
      "bateria",
      "energia",
      "snapper",
    ],
    priority: 88,
    run: () => openControlCenterTab("system"),
  },
  {
    id: "sys-spotify-popup",
    title: "Abrir Spotify popup",
    subtitle: "Toggle del panel de Spotify",
    category: "Sistema",
    keywords: ["system", "spotify", "music", "popup", "media", "musica"],
    priority: 92,
    run: async () => toggleOverlay("spotify"),
  },
  {
    id: "maint-update-dry-run",
    title: "Update dry-run",
    subtitle: "Ejecuta system_update.sh --dry-run en terminal",
    category: "Mantenimiento",
    keywords: [
      "maintenance",
      "update",
      "dry-run",
      "pacman",
      "paru",
      "actualizar",
    ],
    priority: 72,
    run: openUpdateDryRunAction,
  },
  {
    id: "maint-logs",
    title: "Abrir logs AGS",
    subtitle: "Sigue logs de ags.service con journalctl",
    category: "Mantenimiento",
    keywords: ["maintenance", "logs", "journalctl", "debug", "ags", "errores"],
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
