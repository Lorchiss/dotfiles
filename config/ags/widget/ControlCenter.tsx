import app from "ags/gtk4/app"
import { Astal, Gdk, Gtk } from "ags/gtk4"
import ControlCenterTabs, {
  type ControlCenterTab,
} from "./controlcenter/ControlCenterTabs"
import WifiSection from "./controlcenter/WifiSection"
import BluetoothSection from "./controlcenter/BluetoothSection"
import AudioSection from "./controlcenter/AudioSection"
import SystemSection from "./controlcenter/SystemSection"
import SessionSection from "./controlcenter/SessionSection"
import { createMusicAccentClassState } from "../lib/musicAccent"
import {
  readLastControlCenterTab,
  writeLastControlCenterTab,
  type PersistedControlCenterTab,
} from "../lib/controlCenterState"

export default function ControlCenter() {
  let activeTab: ControlCenterTab = "wifi"
  let windowRef: any = null
  let sectionsScrollRef: any = null
  let tabsApi: { setActiveTab: (tab: ControlCenterTab) => void } | null = null
  let pendingStoredTab: ControlCenterTab | null = null
  const accentClass = createMusicAccentClassState()
  const CONTROL_CENTER_WIDTH = 560
  const CONTROL_CENTER_CONTENT_HEIGHT = 410

  const sectionRefs: Partial<Record<ControlCenterTab, any>> = {}

  const resetSectionsScroll = () => {
    if (!sectionsScrollRef) return
    const adjustment = sectionsScrollRef.get_vadjustment?.()
    adjustment?.set_value?.(0)
  }

  const syncVisibleSection = () => {
    for (const [tab, widget] of Object.entries(sectionRefs)) {
      if (!widget) continue
      widget.visible = tab === activeTab
    }
  }

  const onSelectTab = (tab: ControlCenterTab) => {
    activeTab = tab
    syncVisibleSection()
    resetSectionsScroll()
    void writeLastControlCenterTab(tab as PersistedControlCenterTab)
  }

  const registerSection = (tab: ControlCenterTab) => (widget: any) => {
    sectionRefs[tab] = widget
    syncVisibleSection()
  }

  const closePanel = () => {
    if (!windowRef) return
    windowRef.visible = false
  }

  void readLastControlCenterTab().then((storedTab) => {
    if (!storedTab) return
    activeTab = storedTab
    syncVisibleSection()
    pendingStoredTab = storedTab
    tabsApi?.setActiveTab(storedTab)
  })

  return (
    <window
      name="control-center"
      class={accentClass((accent) => `ControlCenter cc-window ${accent}`)}
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
        class={accentClass(
          (accent) => `cc-card popup-accent-surface ${accent}`,
        )}
        widthRequest={CONTROL_CENTER_WIDTH}
      >
        <box class="cc-header" spacing={8}>
          <label class="cc-title" label="Control Center" hexpand xalign={0} />
          <button class="cc-close-btn" onClicked={closePanel}>
            <label label="×" />
          </button>
        </box>

        <ControlCenterTabs
          onSelect={onSelectTab}
          initialTab="wifi"
          onReady={(controls) => {
            tabsApi = controls
            if (pendingStoredTab) {
              controls.setActiveTab(pendingStoredTab)
              pendingStoredTab = null
            }
          }}
        />

        <Gtk.ScrolledWindow
          class="cc-sections-scroll"
          hexpand
          vexpand
          $={(scroll: any) => {
            sectionsScrollRef = scroll
            scroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
            scroll.set_propagate_natural_height(false)
            scroll.set_min_content_height(CONTROL_CENTER_CONTENT_HEIGHT)
            scroll.set_max_content_height(CONTROL_CENTER_CONTENT_HEIGHT)
          }}
        >
          <box
            class="cc-sections-content"
            orientation={Gtk.Orientation.VERTICAL}
            spacing={0}
            hexpand
          >
            <box class="cc-tab-pane" $={registerSection("wifi")} visible>
              <WifiSection isActive={() => activeTab === "wifi"} />
            </box>

            <box
              class="cc-tab-pane"
              $={registerSection("bluetooth")}
              visible={false}
            >
              <BluetoothSection isActive={() => activeTab === "bluetooth"} />
            </box>

            <box
              class="cc-tab-pane"
              $={registerSection("audio")}
              visible={false}
            >
              <AudioSection isActive={() => activeTab === "audio"} />
            </box>

            <box
              class="cc-tab-pane"
              $={registerSection("system")}
              visible={false}
            >
              <SystemSection isActive={() => activeTab === "system"} />
            </box>

            <box
              class="cc-tab-pane"
              $={registerSection("session")}
              visible={false}
            >
              <SessionSection />
            </box>
          </box>
        </Gtk.ScrolledWindow>
      </box>
    </window>
  )
}
