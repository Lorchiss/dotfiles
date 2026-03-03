import { Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { BAR_UI } from "../../lib/uiTokens"
import { barLog } from "../../lib/barObservability"

const LAUNCHER_COMMAND = `bash -lc '
if command -v rofi >/dev/null 2>&1; then
  rofi -show drun
elif command -v wofi >/dev/null 2>&1; then
  wofi --show drun
elif command -v fuzzel >/dev/null 2>&1; then
  fuzzel
else
  ags toggle command-palette
fi
'`

export default function LauncherButton() {
  barLog("WS", "mounting LauncherButton")

  return (
    <button
      class="launcher-chip"
      tooltipText="Launcher"
      valign={Gtk.Align.CENTER}
      onClicked={() => execAsync(LAUNCHER_COMMAND).catch(() => {})}
    >
      <box spacing={BAR_UI.spacing.tight}>
        <label class="launcher-icon" label="󰣇" />
        <label class="launcher-label" label="Apps" />
      </box>
    </button>
  )
}
