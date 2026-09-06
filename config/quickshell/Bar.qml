import QtQuick
import QtQuick.Layouts
import Quickshell
import Quickshell.Hyprland
import qs.components
import qs.services as Services

Scope {
    Variants {
        model: Quickshell.screens

        PanelWindow {
            id: panel

            required property var modelData
            readonly property var hyprMonitor: Hyprland.monitorFor(modelData)

            screen: modelData
            color: "transparent"
            implicitHeight: Theme.barHeight
            exclusiveZone: Theme.barHeight

            anchors {
                top: true
                left: true
                right: true
            }

            Rectangle {
                id: rail
                readonly property bool focused: Boolean(panel.hyprMonitor && panel.hyprMonitor.focused)

                anchors {
                    fill: parent
                    topMargin: Theme.edgeMargin
                    leftMargin: Theme.edgeMargin
                    rightMargin: Theme.edgeMargin
                    bottomMargin: 4
                }

                radius: Theme.radiusRail
                color: Theme.panelColor
                border.color: Theme.hairlineColor
                border.width: 1
                scale: Services.FocusState.reducedMotion ? 1 : focused ? 1 : 0.992
                opacity: focused ? 1 : 0.88
                transformOrigin: Item.Center

                Behavior on scale {
                    NumberAnimation {
                        duration: Services.FocusState.reducedMotion ? 120 : 420
                        easing.type: Easing.OutCubic
                    }
                }
                Behavior on opacity {
                    NumberAnimation { duration: Services.FocusState.reducedMotion ? 120 : 240 }
                }

                Rectangle {
                    anchors {
                        top: parent.top
                        left: parent.left
                        right: parent.right
                        margins: 1
                    }
                    height: 1
                    color: "#5079c7ff"
                }

                WorkspaceConstellation {
                    anchors {
                        left: parent.left
                        leftMargin: 12
                        verticalCenter: parent.verticalCenter
                    }
                    monitor: panel.hyprMonitor
                }

                ContextRibbon {
                    anchors.centerIn: parent
                    maximumWidth: Math.max(260, rail.width * 0.34)
                    monitor: panel.hyprMonitor
                    suppressed: panel.hyprMonitor && panel.hyprMonitor.focused
                        && Services.MediaState.available
                }

                MediaCapsule {
                    anchors.centerIn: parent
                    monitor: panel.hyprMonitor
                }

                SystemCluster {
                    anchors {
                        right: parent.right
                        rightMargin: 8
                        verticalCenter: parent.verticalCenter
                    }
                    monitor: panel.hyprMonitor
                }

                FocusTransferEffect {
                    anchors.fill: parent
                    monitor: panel.hyprMonitor
                    z: 20
                }
            }
        }
    }
}
