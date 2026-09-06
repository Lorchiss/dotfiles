import QtQuick
import qs as Shell

Rectangle {
    id: root

    property string label: ""
    property bool active: false
    signal activated

    height: 32
    radius: 10
    color: active ? "#2b4052" : tabArea.containsMouse ? "#1d2d3b" : "transparent"
    border.width: active ? 1 : 0
    border.color: "#5279c7ff"

    Text {
        anchors.centerIn: parent
        text: root.label
        color: root.active ? Shell.Theme.textPrimary : Shell.Theme.textMuted
        font.family: Shell.Theme.monoFamily
        font.pixelSize: 9
        font.weight: Font.DemiBold
        font.letterSpacing: 0.5
    }

    MouseArea {
        id: tabArea
        anchors.fill: parent
        hoverEnabled: true
        cursorShape: Qt.PointingHandCursor
        onClicked: root.activated()
    }

    Behavior on color { ColorAnimation { duration: Shell.Theme.motionFast } }
    Behavior on border.width { NumberAnimation { duration: Shell.Theme.motionFast } }
}
