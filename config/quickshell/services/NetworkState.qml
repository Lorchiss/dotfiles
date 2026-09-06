pragma Singleton

import Quickshell
import Quickshell.Networking

Singleton {
    id: root

    readonly property var devices: Networking.devices.values
    readonly property bool wiredConnected: devices.some(device =>
        device.type === DeviceType.Wired && device.connected)
    readonly property bool wifiConnected: devices.some(device =>
        device.type === DeviceType.Wifi && device.connected)
    readonly property int connectivity: Networking.connectivity
    readonly property bool limited: connectivity === NetworkConnectivity.Limited
        || connectivity === NetworkConnectivity.Portal
    readonly property bool offline: (!wiredConnected && !wifiConnected)
        || connectivity === NetworkConnectivity.None
    readonly property int severity: offline ? 2 : limited ? 1 : 0
    readonly property string label: offline
        ? "SIN RED"
        : limited ? "RED LIMITADA"
        : wiredConnected && wifiConnected ? "LAN + WI-FI"
        : wiredConnected ? "LAN"
        : "WI-FI"
}
