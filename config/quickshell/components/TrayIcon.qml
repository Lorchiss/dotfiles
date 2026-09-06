import QtQuick
import Quickshell
import Quickshell.Services.SystemTray
import Quickshell.Widgets
import qs as Shell

Rectangle {
    id: root

    required property var trayItem
    readonly property bool needsAttention: trayItem.status === Status.NeedsAttention

    function safeIcon(source): string {
        const value = String(source || "");
        return value.startsWith("image://icon/")
            ? Quickshell.iconPath(value.slice(13), true)
            : value;
    }

    width: 26
    height: 26
    radius: 9
    color: mouseArea.containsMouse
        ? Shell.Theme.elevatedColor
        : needsAttention ? "#2fff7d91" : "transparent"
    border.width: needsAttention ? 1 : 0
    border.color: "#70ff7d91"

    IconImage {
        anchors.centerIn: parent
        width: 16
        height: 16
        source: root.safeIcon(root.trayItem.icon)
    }

    Rectangle {
        anchors {
            right: parent.right
            top: parent.top
            margins: 2
        }
        visible: root.needsAttention
        width: 5
        height: 5
        radius: 3
        color: Shell.Theme.rose
    }

    TrayMenu {
        id: trayMenu

        trayItem: root.trayItem
        anchorItem: root
    }

    MouseArea {
        id: mouseArea

        anchors.fill: parent
        acceptedButtons: Qt.LeftButton | Qt.MiddleButton | Qt.RightButton
        hoverEnabled: true
        cursorShape: Qt.PointingHandCursor

        function displayMenu(): void {
            trayMenu.open();
        }

        onClicked: mouse => {
            if (mouse.button === Qt.RightButton && root.trayItem.hasMenu) {
                displayMenu();
            } else if (mouse.button === Qt.MiddleButton) {
                root.trayItem.secondaryActivate();
            } else if (root.trayItem.onlyMenu && root.trayItem.hasMenu) {
                displayMenu();
            } else {
                root.trayItem.activate();
            }
        }
        onWheel: wheel => root.trayItem.scroll(wheel.angleDelta.y, false)
    }

    Behavior on color { ColorAnimation { duration: Shell.Theme.motionFast } }
    Behavior on border.width { NumberAnimation { duration: Shell.Theme.motionFast } }
}
