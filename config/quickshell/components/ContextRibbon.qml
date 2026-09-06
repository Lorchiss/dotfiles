import QtQuick
import QtQuick.Layouts
import Quickshell.Hyprland
import qs as Shell

Rectangle {
    id: root

    required property var monitor
    property bool suppressed: false
    property real maximumWidth: 520
    readonly property var activeWindow: Hyprland.activeToplevel
    readonly property bool isLocal: Boolean(activeWindow && monitor && monitor.focused)
    readonly property string windowTitle: isLocal && activeWindow.title ? activeWindow.title : "ESCRITORIO EN CALMA"

    implicitWidth: Math.min(maximumWidth, contextRow.implicitWidth + 32)
    implicitHeight: 34
    radius: 12
    color: isLocal ? "#a3172634" : "#66111b26"
    border.color: isLocal ? "#3d79c7ff" : "transparent"
    opacity: suppressed ? 0 : 1
    scale: suppressed ? 0.94 : 1
    visible: opacity > 0

    RowLayout {
        id: contextRow
        anchors {
            fill: parent
            leftMargin: 14
            rightMargin: 14
        }
        spacing: 10

        Rectangle {
            Layout.preferredWidth: 5
            Layout.preferredHeight: root.isLocal ? 18 : 5
            radius: 3
            color: root.isLocal ? Shell.Theme.mint : Shell.Theme.textMuted

            Behavior on color { ColorAnimation { duration: 180 } }
        }

        Text {
            Layout.fillWidth: true
            text: root.windowTitle.toUpperCase()
            color: root.isLocal ? Shell.Theme.textPrimary : Shell.Theme.textMuted
            elide: Text.ElideRight
            horizontalAlignment: Text.AlignHCenter
            font.family: Shell.Theme.sansFamily
            font.pixelSize: 11
            font.weight: Font.DemiBold
            font.letterSpacing: 1.1
        }
    }

    Behavior on implicitWidth { NumberAnimation { duration: 240; easing.type: Easing.OutCubic } }
    Behavior on color { ColorAnimation { duration: 180 } }
    Behavior on opacity { NumberAnimation { duration: Shell.Theme.motionFast } }
    Behavior on scale { NumberAnimation { duration: Shell.Theme.motionBase; easing.type: Easing.OutCubic } }
}
