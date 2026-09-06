import QtQuick
import qs as Shell

Rectangle {
    id: root

    property string label: ""
    property bool enabled: true
    signal activated

    width: 25
    height: 25
    radius: 9
    color: mouseArea.containsMouse && enabled ? "#326b8cad" : "transparent"
    opacity: enabled ? 1 : 0.32

    Text {
        anchors.centerIn: parent
        text: root.label
        color: root.enabled ? Shell.Theme.textPrimary : Shell.Theme.textMuted
        font.family: Shell.Theme.monoFamily
        font.pixelSize: 10
        font.weight: Font.Bold
    }

    MouseArea {
        id: mouseArea
        anchors.fill: parent
        enabled: root.enabled
        hoverEnabled: enabled
        cursorShape: enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
        onClicked: root.activated()
    }

    Behavior on color { ColorAnimation { duration: Shell.Theme.motionFast } }
    Behavior on opacity { NumberAnimation { duration: Shell.Theme.motionFast } }
}
