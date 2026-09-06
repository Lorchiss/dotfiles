import QtQuick
import qs as Shell
import qs.services as Services

Rectangle {
    id: root

    property bool shown: true
    readonly property real naturalWidth: trayRow.implicitWidth + 10

    width: shown && Services.TrayState.visibleCount > 0 ? naturalWidth : 0
    height: 30
    opacity: shown && Services.TrayState.visibleCount > 0 ? 1 : 0
    radius: 11
    color: "#7416222f"
    clip: true

    Row {
        id: trayRow

        anchors.centerIn: parent
        spacing: 1

        Repeater {
            model: root.shown ? Services.TrayState.compactItems : []

            TrayIcon {
                required property var modelData

                trayItem: modelData
            }
        }

        Text {
            anchors.verticalCenter: parent.verticalCenter
            visible: Services.TrayState.overflowCount > 0
            text: `+${Services.TrayState.overflowCount}`
            color: Shell.Theme.textMuted
            font.family: Shell.Theme.monoFamily
            font.pixelSize: 9
            font.weight: Font.DemiBold
        }
    }

    Behavior on width { NumberAnimation { duration: Shell.Theme.motionBase; easing.type: Easing.OutCubic } }
    Behavior on opacity { NumberAnimation { duration: Shell.Theme.motionFast } }
}
