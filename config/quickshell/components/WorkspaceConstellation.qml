import QtQuick
import QtQuick.Layouts
import Quickshell
import Quickshell.Hyprland
import qs as Shell

Item {
    id: root

    required property var monitor
    implicitWidth: content.implicitWidth
    implicitHeight: 34

    RowLayout {
        id: content
        anchors.fill: parent
        spacing: 7

        Rectangle {
            Layout.preferredWidth: 28
            Layout.preferredHeight: 28
            radius: 10
            color: root.monitor && root.monitor.focused ? Shell.Theme.frost : Shell.Theme.elevatedColor

            Text {
                anchors.centerIn: parent
                text: "D"
                color: root.monitor && root.monitor.focused ? Shell.Theme.voidColor : Shell.Theme.textPrimary
                font.family: Shell.Theme.monoFamily
                font.pixelSize: 12
                font.weight: Font.DemiBold
            }

            Behavior on color { ColorAnimation { duration: 180 } }
        }

        Rectangle {
            Layout.preferredWidth: workspaceRow.implicitWidth + 18
            Layout.preferredHeight: 32
            radius: 12
            color: "#7416222f"

            Row {
                id: workspaceRow
                anchors.centerIn: parent
                spacing: 5

                Repeater {
                    model: ScriptModel {
                        values: Hyprland.workspaces.values
                            .filter(workspace => workspace.monitor === root.monitor && workspace.id > 0)
                            .sort((left, right) => left.id - right.id)
                    }

                    delegate: Rectangle {
                        id: orbit

                        required property var modelData
                        width: modelData.active ? 30 : 10
                        height: 10
                        radius: 5
                        color: modelData.urgent
                            ? Shell.Theme.rose
                            : modelData.active ? Shell.Theme.frost
                            : modelData.toplevels.values.length > 0 ? Shell.Theme.textMuted
                            : Shell.Theme.hairlineColor

                        Text {
                            anchors.centerIn: parent
                            visible: orbit.modelData.active
                            text: orbit.modelData.id
                            color: Shell.Theme.voidColor
                            font.family: Shell.Theme.monoFamily
                            font.pixelSize: 9
                            font.weight: Font.Bold
                        }

                        MouseArea {
                            anchors.fill: parent
                            cursorShape: Qt.PointingHandCursor
                            onClicked: orbit.modelData.activate()
                        }

                        Behavior on width { NumberAnimation { duration: 200; easing.type: Easing.OutCubic } }
                        Behavior on color { ColorAnimation { duration: 160 } }
                    }
                }
            }
        }
    }
}
