import QtQuick
import Quickshell
import qs as Shell
import qs.services as Services

Item {
    id: root

    required property var monitor
    readonly property bool focused: Boolean(monitor && monitor.focused)
    readonly property bool showNetwork: focused
    readonly property bool showBluetooth: focused
        && (Services.BluetoothState.connectedCount > 0 || Services.BluetoothState.severity > 0)
    readonly property bool showPower: focused && Services.PowerState.available
    implicitWidth: statusRow.implicitWidth
    implicitHeight: 36

    SystemClock {
        id: clock
        precision: SystemClock.Minutes
    }

    Row {
        id: statusRow
        anchors.fill: parent
        spacing: 8

        TrayCluster {
            shown: root.focused
        }

        StatusChip {
            shown: !root.focused && Services.AlertState.severity > 0
            prefix: "ALERT"
            value: Services.AlertState.label
            accent: Services.AlertState.severity > 1 ? Shell.Theme.rose : Shell.Theme.amber
        }

        StatusChip {
            shown: !root.focused
            prefix: "DISPLAY"
            value: root.monitor ? root.monitor.name : "--"
            accent: Shell.Theme.textMuted
        }

        StatusChip {
            shown: root.focused && Services.AudioState.available
            interactive: true
            prefix: "VOL"
            value: Services.AudioState.muted ? "MUTE" : `${Services.AudioState.volume}%`
            accent: Services.AudioState.muted ? Shell.Theme.amber : Shell.Theme.frost
            onActivated: Services.AudioState.toggleMute()
            onWheelStep: step => Services.AudioState.adjustVolume(step)
        }

        StatusChip {
            shown: root.showNetwork
            prefix: "NET"
            value: Services.NetworkState.label
            accent: Services.NetworkState.severity > 1
                ? Shell.Theme.rose
                : Services.NetworkState.severity > 0 ? Shell.Theme.amber : Shell.Theme.mint
        }

        StatusChip {
            shown: root.showBluetooth
            prefix: "RADIO"
            value: Services.BluetoothState.label
            accent: Services.BluetoothState.severity > 0 ? Shell.Theme.rose : Shell.Theme.mint
        }

        StatusChip {
            shown: root.showPower
            prefix: "POWER"
            value: Services.PowerState.label
            accent: Services.PowerState.warningLevel > 1
                ? Shell.Theme.rose
                : Services.PowerState.warningLevel > 0 ? Shell.Theme.amber : Shell.Theme.mint
        }

        Rectangle {
            id: clockSurface

            width: timeColumn.implicitWidth + 24
            height: 34
            radius: 12
            color: Shell.Theme.elevatedColor
            border.color: "#3679c7ff"

            Column {
                id: timeColumn
                anchors.centerIn: parent
                spacing: -2

                Text {
                    anchors.horizontalCenter: parent.horizontalCenter
                    text: Qt.formatDateTime(clock.date, "HH:mm")
                    color: Shell.Theme.textPrimary
                    font.family: Shell.Theme.monoFamily
                    font.pixelSize: 14
                    font.weight: Font.DemiBold
                }

                Text {
                    anchors.horizontalCenter: parent.horizontalCenter
                    text: Qt.formatDateTime(clock.date, "ddd dd").toUpperCase()
                    color: Shell.Theme.frost
                    font.family: Shell.Theme.monoFamily
                    font.pixelSize: 8
                    font.letterSpacing: 0.8
                }
            }

            MouseArea {
                anchors.fill: parent
                enabled: root.focused
                hoverEnabled: enabled
                cursorShape: enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
                onClicked: controlCenter.toggle()
            }
        }
    }

    ControlCenter {
        id: controlCenter

        anchorItem: clockSurface
        monitor: root.monitor
    }
}
