import QtQuick
import qs as Shell

Rectangle {
    id: root

    property string eyebrow: ""
    property string value: ""
    property string detail: ""
    property color accent: Shell.Theme.frost
    property bool interactive: false
    signal activated

    height: 72
    radius: 13
    color: cardArea.containsMouse && interactive ? "#26394a" : "#172431"
    border.width: 1
    border.color: "#263f54"

    Rectangle {
        anchors {
            left: parent.left
            top: parent.top
            bottom: parent.bottom
        }
        width: 3
        radius: 2
        color: root.accent
    }

    Column {
        anchors {
            left: parent.left
            right: parent.right
            verticalCenter: parent.verticalCenter
            leftMargin: 15
            rightMargin: 12
        }
        spacing: 3

        Text {
            width: parent.width
            text: root.eyebrow
            color: root.accent
            elide: Text.ElideRight
            font.family: Shell.Theme.monoFamily
            font.pixelSize: 9
            font.weight: Font.DemiBold
            font.letterSpacing: 0.8
        }

        Text {
            width: parent.width
            text: root.value
            color: Shell.Theme.textPrimary
            elide: Text.ElideRight
            font.family: Shell.Theme.sansFamily
            font.pixelSize: 14
            font.weight: Font.DemiBold
        }

        Text {
            width: parent.width
            visible: text.length > 0
            text: root.detail
            color: Shell.Theme.textMuted
            elide: Text.ElideRight
            font.family: Shell.Theme.sansFamily
            font.pixelSize: 10
        }
    }

    MouseArea {
        id: cardArea
        anchors.fill: parent
        enabled: root.interactive
        hoverEnabled: enabled
        cursorShape: enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
        onClicked: root.activated()
    }

    Behavior on color { ColorAnimation { duration: Shell.Theme.motionFast } }
}
