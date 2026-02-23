import app from "ags/gtk4/app"
import { Astal, Gdk, Gtk } from "ags/gtk4"
import ControlCenterTabs, {
  type ControlCenterTab,
} from "./controlcenter/ControlCenterTabs"
import WifiSection from "./controlcenter/WifiSection"
import BluetoothSection from "./controlcenter/BluetoothSection"
import AudioSection from "./controlcenter/AudioSection"
import SessionSection from "./controlcenter/SessionSection"

export default function ControlCenter() {
  let activeTab: ControlCenterTab = "wifi"
  let windowRef: any = null

  const sectionRefs: Partial<Record<ControlCenterTab, any>> = {}

  const syncVisibleSection = () => {
    for (const [tab, widget] of Object.entries(sectionRefs)) {
      if (!widget) continue
      widget.visible = tab === activeTab
    }
  }

  const onSelectTab = (tab: ControlCenterTab) => {
    activeTab = tab
    syncVisibleSection()
  }

  const registerSection = (tab: ControlCenterTab) => (widget: any) => {
    sectionRefs[tab] = widget
    syncVisibleSection()
  }

  const closePanel = () => {
    if (!windowRef) return
    windowRef.visible = false
  }

  return (
    <window
      name="control-center"
      class="ControlCenter cc-window"
      application={app}
      visible={false}
      layer={Astal.Layer.TOP}
      anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.RIGHT}
      marginTop={68}
      marginRight={36}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.ON_DEMAND}
      $={(window: any) => {
        windowRef = window
        const keyController = new Gtk.EventControllerKey()
        keyController.connect("key-pressed", (_: any, keyval: number) => {
          if (keyval === Gdk.KEY_Escape) {
            closePanel()
            return true
          }
          return false
        })
        window.add_controller(keyController)
      }}
    >
      <box
        orientation={Gtk.Orientation.VERTICAL}
        spacing={10}
        cssName="ccCard"
        widthRequest={560}
      >
        <box class="cc-header" spacing={8}>
          <label class="cc-title" label="Control Center" hexpand xalign={0} />
          <button class="cc-close-btn" onClicked={closePanel}>
            <label label="×" />
          </button>
        </box>

        <ControlCenterTabs onSelect={onSelectTab} initialTab="wifi" />

        <box orientation={Gtk.Orientation.VERTICAL} spacing={0}>
          <box $={registerSection("wifi")} visible>
            <WifiSection isActive={() => activeTab === "wifi"} />
          </box>

          <box $={registerSection("bluetooth")} visible={false}>
            <BluetoothSection isActive={() => activeTab === "bluetooth"} />
          </box>

          <box $={registerSection("audio")} visible={false}>
            <AudioSection isActive={() => activeTab === "audio"} />
          </box>

          <box $={registerSection("session")} visible={false}>
            <SessionSection />
          </box>
        </box>
      </box>
    </window>
  )
}
