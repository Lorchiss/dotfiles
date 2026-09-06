import QtQuick
import qs as Shell

Rectangle {
    id: root

    property bool shown: true
    property bool interactive: false
    property string prefix: ""
    property string value: ""
    property color accent: Shell.Theme.textMuted
    property color surface: "#7416222f"

    signal activated
    signal wheelStep(real step)

    readonly property real naturalWidth: chipContent.implicitWidth + 20

    width: shown ? naturalWidth : 0
    height: 30
    opacity: shown ? 1 : 0
    radius: 11
    color: mouseArea.containsMouse && interactive ? Shell.Theme.elevatedColor : surface
    clip: true

    Row {
        id: chipContent
        anchors.centerIn: parent
        spacing: 7

        Rectangle {
            anchors.verticalCenter: parent.verticalCenter
            width: 6
            height: 6
            radius: 3
            color: root.accent
        }

        Text {
            text: root.prefix
            visible: text.length > 0
            color: Shell.Theme.textMuted
            font.family: Shell.Theme.monoFamily
            font.pixelSize: 9
            font.weight: Font.DemiBold
            font.letterSpacing: 0.6
        }

        Text {
            text: root.value
            color: Shell.Theme.textPrimary
            font.family: Shell.Theme.monoFamily
            font.pixelSize: 10
            font.weight: Font.DemiBold
        }
    }

    MouseArea {
        id: mouseArea
        anchors.fill: parent
        enabled: root.interactive && root.shown
        hoverEnabled: enabled
        cursorShape: enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
        onClicked: root.activated()
        onWheel: wheel => root.wheelStep(wheel.angleDelta.y > 0 ? 5 : -5)
    }

    Behavior on width { NumberAnimation { duration: 320; easing.type: Easing.OutCubic } }
    Behavior on opacity { NumberAnimation { duration: 180 } }
    Behavior on color { ColorAnimation { duration: 160 } }
}
