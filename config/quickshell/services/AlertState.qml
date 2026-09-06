pragma Singleton

import Quickshell

Singleton {
    readonly property int criticalCount:
        (NetworkState.severity > 1 ? 1 : 0)
        + (BluetoothState.severity > 1 ? 1 : 0)
        + (PowerState.warningLevel > 1 ? 1 : 0)
    readonly property int warningCount:
        (NetworkState.severity === 1 ? 1 : 0)
        + (PowerState.warningLevel === 1 ? 1 : 0)
        + TrayState.attentionCount
    readonly property int severity: criticalCount > 0 ? 2 : warningCount > 0 ? 1 : 0
    readonly property string label: criticalCount > 0
        ? `${criticalCount} CRIT`
        : `${warningCount} WARN`
}
