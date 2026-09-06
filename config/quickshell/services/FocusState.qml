pragma Singleton

import QtQuick
import Quickshell
import Quickshell.Hyprland

Singleton {
    id: root

    property string currentMonitor: ""
    property string previousMonitor: ""
    property int direction: 0
    property int transitionSerial: 0
    property bool transitioning: false
    property real currentMonitorX: 0

    readonly property bool reducedMotion: Quickshell.env("QS_REDUCED_MOTION") === "1"
    readonly property int transitionDuration: reducedMotion ? 120 : 680

    function acceptMonitor(monitor: var): void {
        if (!monitor || !monitor.name || monitor.name === currentMonitor)
            return;

        const nextX = monitor.x ?? 0;
        if (!currentMonitor) {
            currentMonitor = monitor.name;
            currentMonitorX = nextX;
            return;
        }

        previousMonitor = currentMonitor;
        direction = nextX === currentMonitorX ? 0 : nextX > currentMonitorX ? 1 : -1;
        currentMonitor = monitor.name;
        currentMonitorX = nextX;
        transitionSerial += 1;
        transitioning = true;
        transitionTimer.restart();
    }

    Timer {
        id: transitionTimer
        interval: root.transitionDuration
        onTriggered: root.transitioning = false
    }

    Connections {
        target: Hyprland

        function onFocusedMonitorChanged(): void {
            root.acceptMonitor(Hyprland.focusedMonitor);
        }
    }

    Component.onCompleted: acceptMonitor(Hyprland.focusedMonitor)
}
