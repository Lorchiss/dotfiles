import { Gtk } from "ags/gtk4"
import { BAR_UI } from "../../lib/uiTokens"
import { themeModeBinding, toggleThemeMode } from "../../lib/themeMode"

export default function ThemeToggleChip() {
  const themeMode = themeModeBinding()
  let pending = false

  const onToggle = () => {
    if (pending) return
    pending = true
    void toggleThemeMode().finally(() => {
      pending = false
    })
  }

  return (
    <button
      class={themeMode((mode) => `theme-toggle-chip theme-${mode}`)}
      tooltipText={themeMode((mode) =>
        mode === "dark" ? "Cambiar a claro" : "Cambiar a oscuro",
      )}
      valign={Gtk.Align.CENTER}
      onClicked={onToggle}
    >
      <box spacing={BAR_UI.spacing.tight} halign={Gtk.Align.CENTER}>
        <image
          class="theme-toggle-icon"
          iconName={themeMode((mode) =>
            mode === "dark"
              ? "weather-clear-night-symbolic"
              : "weather-clear-symbolic",
          )}
          pixelSize={14}
        />
      </box>
    </button>
  )
}
