import QtQuick
import qs as Shell
import qs.services as Services

Item {
    id: root

    required property var monitor
    property int mode: 0
    property real progress: 1

    readonly property string monitorName: monitor ? monitor.name : ""
    readonly property int travelDirection: Services.FocusState.direction === 0
        ? 1
        : Services.FocusState.direction
    readonly property bool incoming: mode === 1
    readonly property real energy: Math.sin(progress * Math.PI)

    visible: mode !== 0 || transferAnimation.running
    clip: true

    function trigger(): void {
        if (!monitorName)
            return;

        if (monitorName === Services.FocusState.currentMonitor)
            mode = 1;
        else if (monitorName === Services.FocusState.previousMonitor)
            mode = -1;
        else
            return;

        progress = 0;
        transferAnimation.restart();
    }

    Rectangle {
        anchors.fill: parent
        color: root.incoming ? Shell.Theme.frost : Shell.Theme.voidColor
        opacity: root.energy * (root.incoming ? 0.13 : 0.18)
    }

    Rectangle {
        id: beam
        visible: !Services.FocusState.reducedMotion
        width: Services.FocusState.reducedMotion ? 80 : 220
        height: parent.height
        opacity: root.energy * (root.incoming ? 0.72 : 0.52)
        x: {
            const half = root.width * 0.5;
            if (root.incoming)
                return root.travelDirection > 0
                    ? -beam.width + root.progress * (half + beam.width)
                    : root.width - root.progress * (half + beam.width);

            return root.travelDirection > 0
                ? half + root.progress * (half + beam.width) - beam.width
                : half - root.progress * (half + beam.width);
        }

        gradient: Gradient {
            orientation: Gradient.Horizontal
            GradientStop { position: 0; color: "#0079c7ff" }
            GradientStop { position: 0.5; color: "#b079c7ff" }
            GradientStop { position: 1; color: "#0070e1bd" }
        }
    }

    Rectangle {
        visible: !Services.FocusState.reducedMotion
        width: 3
        height: parent.height * (0.25 + root.energy * 0.55)
        radius: 2
        y: (parent.height - height) / 2
        x: root.travelDirection > 0
            ? (root.incoming ? 0 : parent.width - width)
            : (root.incoming ? parent.width - width : 0)
        color: root.incoming ? Shell.Theme.mint : Shell.Theme.frost
        opacity: root.energy
    }

    NumberAnimation {
        id: transferAnimation
        target: root
        property: "progress"
        from: 0
        to: 1
        duration: Services.FocusState.transitionDuration
        easing.type: Easing.InOutCubic
        onStopped: root.mode = 0
    }

    Connections {
        target: Services.FocusState

        function onTransitionSerialChanged(): void {
            root.trigger();
        }
    }
}
