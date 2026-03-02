import app from "ags/gtk4/app"
import { Astal, Gdk, Gtk } from "ags/gtk4"
import ControlCenterTabs, {
  CONTROL_CENTER_TAB_ORDER,
  type ControlCenterTab,
} from "./controlcenter/ControlCenterTabs"
import WifiSection from "./controlcenter/WifiSection"
import BluetoothSection from "./controlcenter/BluetoothSection"
import AudioSection from "./controlcenter/AudioSection"
import SystemSection from "./controlcenter/SystemSection"
import SessionSection from "./controlcenter/SessionSection"
import { createMusicAccentClassState } from "../lib/musicAccent"
import {
  monitorFromLayout,
  onOverlayVisibilityChanged,
  overlayLayoutBinding,
  registerOverlayWindow,
} from "../lib/overlayOrchestrator"
import {
  readLastControlCenterTab,
  writeLastControlCenterTab,
  type PersistedControlCenterTab,
} from "../lib/controlCenterState"

export default function ControlCenter() {
  let activeTab: ControlCenterTab = "wifi"
  let windowRef: any = null
  let sectionsScrollRef: any = null
  let tabsApi: {
    setActiveTab: (tab: ControlCenterTab) => void
    selectRelativeTab: (delta: number) => void
    getActiveTab: () => ControlCenterTab
  } | null = null
  let pendingStoredTab: ControlCenterTab | null = null
  const accentClass = createMusicAccentClassState()
  const overlayLayout = overlayLayoutBinding()

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

  const selectTabByIndex = (index: number) => {
    const tab = CONTROL_CENTER_TAB_ORDER[index]
    if (!tab) return false
    tabsApi?.setActiveTab(tab)
    return true
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
      class={overlayLayout((layout) =>
        [
          "ControlCenter",
          "cc-window",
          `overlay-layout-${layout.mode}`,
          layout.focus === "control-center"
            ? "overlay-focused"
            : layout.focus
              ? "overlay-muted"
              : "",
          layout.focus && layout.focus !== "control-center"
            ? "overlay-secondary"
            : "",
        ]
          .filter(Boolean)
          .join(" "),
      )}
      application={app}
      visible={false}
      layer={Astal.Layer.TOP}
      anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.RIGHT}
      gdkmonitor={overlayLayout((layout) => monitorFromLayout(layout))}
      marginTop={overlayLayout((layout) => layout.controlCenter.marginTop)}
      marginRight={overlayLayout((layout) => layout.controlCenter.marginRight)}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.ON_DEMAND}
      $={(window: any) => {
        windowRef = window
        registerOverlayWindow("control-center", window)

        const keyController = new Gtk.EventControllerKey()
        keyController.connect(
          "key-pressed",
          (_: any, keyval: number, _keycode: number, state: number) => {
            const hasCtrl = Boolean(state & Gdk.ModifierType.CONTROL_MASK)

            if (keyval === Gdk.KEY_Escape) {
              closePanel()
              return true
            }

            if (
              keyval === Gdk.KEY_Right ||
              keyval === Gdk.KEY_KP_Right ||
              (hasCtrl && keyval === Gdk.KEY_Tab)
            ) {
              tabsApi?.selectRelativeTab(1)
              return true
            }

            if (
              keyval === Gdk.KEY_Left ||
              keyval === Gdk.KEY_KP_Left ||
              (hasCtrl && keyval === Gdk.KEY_ISO_Left_Tab)
            ) {
              tabsApi?.selectRelativeTab(-1)
              return true
            }

            if (keyval === Gdk.KEY_1 || keyval === Gdk.KEY_KP_1)
              return selectTabByIndex(0)
            if (keyval === Gdk.KEY_2 || keyval === Gdk.KEY_KP_2)
              return selectTabByIndex(1)
            if (keyval === Gdk.KEY_3 || keyval === Gdk.KEY_KP_3)
              return selectTabByIndex(2)
            if (keyval === Gdk.KEY_4 || keyval === Gdk.KEY_KP_4)
              return selectTabByIndex(3)
            if (keyval === Gdk.KEY_5 || keyval === Gdk.KEY_KP_5)
              return selectTabByIndex(4)

            if (keyval === Gdk.KEY_w || keyval === Gdk.KEY_W)
              return selectTabByIndex(0)
            if (keyval === Gdk.KEY_b || keyval === Gdk.KEY_B)
              return selectTabByIndex(1)
            if (keyval === Gdk.KEY_a || keyval === Gdk.KEY_A)
              return selectTabByIndex(2)
            if (keyval === Gdk.KEY_s || keyval === Gdk.KEY_S)
              return selectTabByIndex(3)
            if (keyval === Gdk.KEY_e || keyval === Gdk.KEY_E)
              return selectTabByIndex(4)

            return false
          },
        )
        window.add_controller(keyController)

        window.connect("notify::visible", () => {
          onOverlayVisibilityChanged("control-center", Boolean(window.visible))
        })
      }}
    >
      <box
        orientation={Gtk.Orientation.VERTICAL}
        spacing={10}
        cssName="ccCard"
        class={accentClass(
          (accent) => `cc-card popup-accent-surface ${accent}`,
        )}
        widthRequest={overlayLayout((layout) => layout.controlCenter.width)}
      >
        <box class="cc-header" spacing={8}>
          <label class="cc-title" label="Control Center" hexpand xalign={0} />
          <label class="cc-header-hint" label="←/→ tabs · 1-5 · Esc" />
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
          heightRequest={overlayLayout(
            (layout) => layout.controlCenter.contentHeight,
          )}
          $={(scroll: any) => {
            sectionsScrollRef = scroll
            scroll.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
            scroll.set_propagate_natural_height(false)
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
