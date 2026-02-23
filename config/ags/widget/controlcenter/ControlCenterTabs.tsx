import { Gtk } from "ags/gtk4"

export type ControlCenterTab =
  | "wifi"
  | "bluetooth"
  | "audio"
  | "system"
  | "session"

type ControlCenterTabsProps = {
  initialTab?: ControlCenterTab
  onSelect: (tab: ControlCenterTab) => void
}

function tabButtonClasses(isActive: boolean): string[] {
  return isActive ? ["cc-tab-btn", "cc-tab-btn-active"] : ["cc-tab-btn"]
}

export default function ControlCenterTabs({
  initialTab = "wifi",
  onSelect,
}: ControlCenterTabsProps) {
  let activeTab: ControlCenterTab = initialTab
  const buttonRefs: Partial<Record<ControlCenterTab, any>> = {}

  const syncButtonClasses = () => {
    for (const [tab, button] of Object.entries(buttonRefs)) {
      if (!button) continue
      button.set_css_classes?.(
        tabButtonClasses(tab === activeTab) as unknown as string[],
      )
    }
  }

  const selectTab = (tab: ControlCenterTab) => {
    activeTab = tab
    syncButtonClasses()
    onSelect(tab)
  }

  const registerButton = (tab: ControlCenterTab) => (button: any) => {
    buttonRefs[tab] = button
    syncButtonClasses()
  }

  return (
    <box class="cc-tabbar" spacing={8} hexpand valign={Gtk.Align.CENTER}>
      <button $={registerButton("wifi")} onClicked={() => selectTab("wifi")}>
        <label label="Wi-Fi" />
      </button>
      <button
        $={registerButton("bluetooth")}
        onClicked={() => selectTab("bluetooth")}
      >
        <label label="Bluetooth" />
      </button>
      <button $={registerButton("audio")} onClicked={() => selectTab("audio")}>
        <label label="Audio" />
      </button>
      <button
        $={registerButton("system")}
        onClicked={() => selectTab("system")}
      >
        <label label="Sistema" />
      </button>
      <button
        $={registerButton("session")}
        onClicked={() => selectTab("session")}
      >
        <label label="Sesión" />
      </button>
    </box>
  )
}
