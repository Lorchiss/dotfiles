pragma Singleton

import Quickshell
import Quickshell.Services.UPower

Singleton {
    id: root

    readonly property var device: UPower.displayDevice
    readonly property bool available: Boolean(device && device.ready
        && device.isLaptopBattery && device.isPresent)
    readonly property int percentage: available ? Math.round(device.percentage) : 0
    readonly property bool onBattery: available && UPower.onBattery
    readonly property int warningLevel: !available ? 0 : percentage < 15 ? 2 : percentage < 30 ? 1 : 0
    readonly property string label: `BAT ${percentage}%`
}
