import QtQuick
import Quickshell
import Quickshell.Widgets
import qs as Shell

PopupWindow {
    id: root

    required property var trayItem
    required property var anchorItem
    property var currentMenu: trayItem.menu
    property var menuStack: []
    property var titleStack: []
    property string currentTitle: trayItem.title || "SYSTEM TRAY"

    function open(): void {
        currentMenu = trayItem.menu;
        menuStack = [];
        titleStack = [];
        currentTitle = trayItem.title || "SYSTEM TRAY";
        visible = true;
    }

    function close(): void {
        visible = false;
    }

    function enter(entry): void {
        menuStack = menuStack.concat([currentMenu]);
        titleStack = titleStack.concat([currentTitle]);
        currentMenu = entry;
        currentTitle = cleanLabel(entry.text);
    }

    function back(): void {
        if (menuStack.length === 0) {
            close();
            return;
        }

        currentMenu = menuStack[menuStack.length - 1];
        currentTitle = titleStack[titleStack.length - 1];
        menuStack = menuStack.slice(0, -1);
        titleStack = titleStack.slice(0, -1);
    }

    function cleanLabel(value): string {
        return String(value || "").replace(/&&/g, "\u0000").replace(/&/g, "").replace(/\u0000/g, "&");
    }

    function safeIcon(source): string {
        const value = String(source || "");
        return value.startsWith("image://icon/")
            ? Quickshell.iconPath(value.slice(13), true)
            : value;
    }

    anchor.item: anchorItem
    anchor.edges: Edges.Bottom | Edges.Right
    anchor.gravity: Edges.Bottom | Edges.Left
    anchor.margins.bottom: 8
    implicitWidth: 286
    implicitHeight: Math.min(460, 58 + menuList.contentHeight)
    color: "transparent"
    grabFocus: true
    visible: false

    QsMenuOpener {
        id: menuOpener
        menu: root.currentMenu
    }

    Rectangle {
        anchors.fill: parent
        radius: 16
        color: "#f20b141e"
        border.width: 1
        border.color: "#566f9bb8"
        clip: true

        Rectangle {
            anchors {
                top: parent.top
                left: parent.left
                right: parent.right
            }
            height: 3
            color: Shell.Theme.frost
            opacity: 0.8
        }

        Rectangle {
            id: header

            anchors {
                top: parent.top
                left: parent.left
                right: parent.right
                margins: 8
            }
            height: 38
            radius: 11
            color: backArea.containsMouse ? "#27384a" : "#172431"

            Row {
                anchors {
                    fill: parent
                    leftMargin: 11
                    rightMargin: 11
                }
                spacing: 9

                Text {
                    anchors.verticalCenter: parent.verticalCenter
                    visible: root.menuStack.length > 0
                    text: "<"
                    color: Shell.Theme.frost
                    font.family: Shell.Theme.monoFamily
                    font.pixelSize: 13
                    font.weight: Font.Bold
                }

                Text {
                    anchors.verticalCenter: parent.verticalCenter
                    width: parent.width - 22
                    text: root.currentTitle.toUpperCase()
                    color: Shell.Theme.textPrimary
                    elide: Text.ElideRight
                    font.family: Shell.Theme.sansFamily
                    font.pixelSize: 11
                    font.weight: Font.DemiBold
                    font.letterSpacing: 0.6
                }
            }

            MouseArea {
                id: backArea
                anchors.fill: parent
                enabled: root.menuStack.length > 0
                hoverEnabled: enabled
                cursorShape: enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
                onClicked: root.back()
            }
        }

        ListView {
            id: menuList

            anchors {
                top: header.bottom
                left: parent.left
                right: parent.right
                bottom: parent.bottom
                topMargin: 4
                leftMargin: 8
                rightMargin: 8
                bottomMargin: 8
            }
            clip: true
            spacing: 1
            model: menuOpener.children

            delegate: Item {
                id: entryRoot

                required property var modelData
                readonly property bool separator: modelData.isSeparator
                width: ListView.view.width
                height: separator ? 9 : 34

                Rectangle {
                    anchors.centerIn: parent
                    visible: entryRoot.separator
                    width: parent.width - 16
                    height: 1
                    color: Shell.Theme.hairlineColor
                }

                Rectangle {
                    anchors.fill: parent
                    visible: !entryRoot.separator
                    radius: 10
                    color: entryArea.containsMouse && entryRoot.modelData.enabled
                        ? "#26394a" : "transparent"
                    opacity: entryRoot.modelData.enabled ? 1 : 0.38

                    Row {
                        anchors {
                            fill: parent
                            leftMargin: 10
                            rightMargin: 10
                        }
                        spacing: 9

                        Item {
                            anchors.verticalCenter: parent.verticalCenter
                            width: 18
                            height: 18

                            IconImage {
                                anchors.fill: parent
                                source: root.safeIcon(entryRoot.modelData.icon)
                                visible: source.toString().length > 0
                            }

                            Rectangle {
                                anchors.centerIn: parent
                                visible: entryRoot.modelData.buttonType !== QsMenuButtonType.None
                                width: 12
                                height: 12
                                radius: entryRoot.modelData.buttonType === QsMenuButtonType.RadioButton ? 6 : 3
                                color: entryRoot.modelData.checkState === Qt.Checked
                                    ? Shell.Theme.mint : "transparent"
                                border.width: 1
                                border.color: entryRoot.modelData.checkState === Qt.Checked
                                    ? Shell.Theme.mint : Shell.Theme.textMuted
                            }
                        }

                        Text {
                            anchors.verticalCenter: parent.verticalCenter
                            width: parent.width - 48
                            text: root.cleanLabel(entryRoot.modelData.text)
                            color: Shell.Theme.textPrimary
                            elide: Text.ElideRight
                            font.family: Shell.Theme.sansFamily
                            font.pixelSize: 11
                        }

                        Text {
                            anchors.verticalCenter: parent.verticalCenter
                            visible: entryRoot.modelData.hasChildren
                            text: ">"
                            color: Shell.Theme.frost
                            font.family: Shell.Theme.monoFamily
                            font.pixelSize: 11
                            font.weight: Font.Bold
                        }
                    }

                    MouseArea {
                        id: entryArea
                        anchors.fill: parent
                        enabled: entryRoot.modelData.enabled
                        hoverEnabled: enabled
                        cursorShape: enabled ? Qt.PointingHandCursor : Qt.ArrowCursor
                        onClicked: {
                            if (entryRoot.modelData.hasChildren) {
                                root.enter(entryRoot.modelData);
                            } else {
                                entryRoot.modelData.triggered();
                                root.close();
                            }
                        }
                    }

                    Behavior on color { ColorAnimation { duration: Shell.Theme.motionFast } }
                }
            }
        }
    }
}
