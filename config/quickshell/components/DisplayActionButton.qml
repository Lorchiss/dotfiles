import QtQuick
import qs as Shell

Rectangle {
    id: root

    property string label: ""
    property string detail: ""
    property bool active: false
    property bool armed: false
    property bool enabled: true
    signal activated

    height: 66
    radius: 13
    color: armed
        ? "#3b252d"
        : active ? "#19332f" : actionArea.containsMouse && enabled ? "#213443" : "#14212c"
    border.width: 1
    border.color: armed
        ? Shell.Theme.rose
        : active ? Shell.Theme.mint : "#365b7892"
    opacity: enabled ? 1 : 0.48

    Column {
        anchors.centerIn: parent
        width: parent.width - 16
        spacing: 3

        Text {
            width: parent.width
            horizontalAlignment: Text.AlignHCenter
            text: root.armed ? "CONFIRMAR" : root.label
            color: root.armed
                ? Shell.Theme.rose
                : root.active ? Shell.Theme.mint : Shell.Theme.textPrimary
            font.family: Shell.Theme.monoFamily
            font.pixelSize: 9
            font.weight: Font.Bold
            font.letterSpacing: 0.5
        }

        Text {
            width: parent.width
            horizontalAlignment: Text.AlignHCenter
            text: root.armed ? root.label : root.detail
            color: Shell.Theme.textMuted
            elide: Text.ElideRight
            font.family: Shell.Theme.monoFamily
            font.pixelSize: 8
        }
    }

    MouseArea {
        id: actionArea
        anchors.fill: parent
        enabled: root.enabled
        hoverEnabled: enabled
        cursorShape: Qt.PointingHandCursor
        onClicked: root.activated()
    }

    Behavior on color { ColorAnimation { duration: Shell.Theme.motionFast } }
    Behavior on border.color { ColorAnimation { duration: Shell.Theme.motionFast } }
}
