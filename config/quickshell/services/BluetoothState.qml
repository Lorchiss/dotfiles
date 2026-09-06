pragma Singleton

import Quickshell
import Quickshell.Bluetooth

Singleton {
    id: root

    readonly property var adapter: Bluetooth.defaultAdapter
    readonly property bool available: Boolean(adapter)
    readonly property bool enabled: available && adapter.enabled
    readonly property var connectedDevices: Bluetooth.devices.values.filter(device => device.connected)
    readonly property int connectedCount: connectedDevices.length
    readonly property bool blocked: available && adapter.state === BluetoothAdapterState.Blocked
    readonly property int severity: blocked ? 2 : 0
    readonly property string label: blocked ? "BT BLOQUEADO" : `BT ${connectedCount}`
}
