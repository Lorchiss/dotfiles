import QtQuick
import Quickshell
import Quickshell.Hyprland
import qs as Shell
import qs.services as Services

PopupWindow {
    id: root

    required property var anchorItem
    required property var monitor
    property int activeTab: 0
    property string pendingDisplayMode: ""
    readonly property var monitors: Hyprland.monitors.values
    readonly property int alertSeverity: Services.AlertState.severity
    readonly property int desktopLeft: monitors.length > 0
        ? Math.min(...monitors.map(item => item.x)) : 0
    readonly property int desktopTop: monitors.length > 0
        ? Math.min(...monitors.map(item => item.y)) : 0
    readonly property int desktopRight: monitors.length > 0
        ? Math.max(...monitors.map(item => item.x + item.width)) : 0
    readonly property int desktopBottom: monitors.length > 0
        ? Math.max(...monitors.map(item => item.y + item.height)) : 0
    readonly property int desktopWidth: desktopRight - desktopLeft
    readonly property int desktopHeight: desktopBottom - desktopTop
    readonly property bool horizontalLayout: monitors.length < 2
        || monitors.every(item => item.y === monitors[0].y)
    readonly property int pageHeight: activeTab === 0
        ? 340
        : activeTab === 1 ? 258
        : activeTab === 2 ? 240
        : 144 + Math.max(1, Math.min(monitors.length, 2)) * 102

    function requestDisplayMode(mode): void {
        if (Services.DisplayState.busy)
            return;

        if (mode === "dual" || pendingDisplayMode === mode) {
            pendingDisplayMode = "";
            displayConfirmTimer.stop();
            Services.DisplayState.applyMode(mode);
            return;
        }

        pendingDisplayMode = mode;
        displayConfirmTimer.restart();
    }

    function open(): void {
        if (!monitor || !monitor.focused)
            return;

        Services.ControlCenterState.openFor(monitor.name);
    }

    function close(): void {
        Services.ControlCenterState.close();
    }

    function toggle(): void {
        Services.ControlCenterState.monitorName === monitor.name ? close() : open();
    }

    function selectRelative(delta): void {
        activeTab = (activeTab + delta + 4) % 4;
    }

    anchor.item: anchorItem
    anchor.edges: Edges.Bottom | Edges.Right
    anchor.gravity: Edges.Bottom | Edges.Left
    anchor.margins.bottom: 10
    implicitWidth: 430
    implicitHeight: 138 + pageHeight
    color: "transparent"
    grabFocus: true
    visible: false

    Behavior on implicitHeight {
        NumberAnimation {
            duration: Services.FocusState.reducedMotion ? 120 : 280
            easing.type: Easing.OutCubic
        }
    }

    Timer {
        id: displayConfirmTimer

        interval: 5000
        repeat: false
        onTriggered: root.pendingDisplayMode = ""
    }

    Connections {
        target: Services.ControlCenterState

        function onMonitorNameChanged(): void {
            const shouldOpen = Boolean(root.monitor
                && Services.ControlCenterState.monitorName === root.monitor.name);
            root.visible = shouldOpen;
            if (shouldOpen) {
                entrance.restart();
                Qt.callLater(() => keyScope.forceActiveFocus());
            }
        }
    }

    onVisibleChanged: {
        if (!visible && monitor
                && Services.ControlCenterState.monitorName === monitor.name)
            Services.ControlCenterState.close();
    }

    ParallelAnimation {
        id: entrance

        NumberAnimation {
            target: surface
            property: "opacity"
            from: 0
            to: 1
            duration: Services.FocusState.reducedMotion ? 120 : 260
            easing.type: Easing.OutCubic
        }
        NumberAnimation {
            target: surface
            property: "x"
            from: Services.FocusState.reducedMotion ? 0 : 22
            to: 0
            duration: Services.FocusState.reducedMotion ? 120 : 380
            easing.type: Easing.OutCubic
        }
    }

    FocusScope {
        id: keyScope
        anchors.fill: parent
        focus: root.visible

        Keys.onEscapePressed: root.close()
        Keys.onLeftPressed: root.selectRelative(-1)
        Keys.onRightPressed: root.selectRelative(1)

        Rectangle {
            id: surface

            anchors.fill: parent
            radius: 20
            color: "#f508111a"
            border.width: 1
            border.color: "#5b6f9bb8"
            clip: true

            Rectangle {
                anchors {
                    top: parent.top
                    left: parent.left
                    right: parent.right
                }
                height: 3
                color: root.alertSeverity > 1
                    ? Shell.Theme.rose
                    : root.alertSeverity > 0 ? Shell.Theme.amber : Shell.Theme.frost
            }

            Column {
                anchors {
                    fill: parent
                    margins: 14
                }
                spacing: 10

                Item {
                    width: parent.width
                    height: 58

                    Column {
                        anchors {
                            left: parent.left
                            verticalCenter: parent.verticalCenter
                        }
                        spacing: 1

                        Text {
                            text: "POLAR / CONTROL"
                            color: Shell.Theme.frost
                            font.family: Shell.Theme.monoFamily
                            font.pixelSize: 9
                            font.weight: Font.DemiBold
                            font.letterSpacing: 1.2
                        }

                        Text {
                            text: "Centro de control"
                            color: Shell.Theme.textPrimary
                            font.family: Shell.Theme.sansFamily
                            font.pixelSize: 21
                            font.weight: Font.DemiBold
                        }

                        Text {
                            text: root.monitor
                                ? `${root.monitor.name} / WORKSPACE ${root.monitor.activeWorkspace ? root.monitor.activeWorkspace.name : "--"}`
                                : "DISPLAY --"
                            color: Shell.Theme.textMuted
                            font.family: Shell.Theme.monoFamily
                            font.pixelSize: 9
                        }
                    }

                    Rectangle {
                        anchors {
                            right: parent.right
                            verticalCenter: parent.verticalCenter
                        }
                        width: 34
                        height: 34
                        radius: 12
                        color: closeArea.containsMouse ? "#2b4052" : "#172431"

                        Text {
                            anchors.centerIn: parent
                            text: "X"
                            color: Shell.Theme.textMuted
                            font.family: Shell.Theme.monoFamily
                            font.pixelSize: 11
                            font.weight: Font.Bold
                        }

                        MouseArea {
                            id: closeArea
                            anchors.fill: parent
                            hoverEnabled: true
                            cursorShape: Qt.PointingHandCursor
                            onClicked: root.close()
                        }
                    }
                }

                Row {
                    width: parent.width
                    height: 32
                    spacing: 6

                    Repeater {
                        model: ["RESUMEN", "AUDIO", "RED", "PANTALLAS"]

                        ControlTabButton {
                            required property int index
                            required property string modelData

                            width: 94
                            label: modelData
                            active: root.activeTab === index
                            onActivated: root.activeTab = index
                        }
                    }
                }

                Item {
                    width: parent.width
                    height: root.pageHeight

                    Flickable {
                        anchors.fill: parent
                        visible: root.activeTab === 0
                        contentHeight: summaryColumn.implicitHeight
                        clip: true

                        Column {
                            id: summaryColumn
                            width: parent.width
                            spacing: 8

                            Rectangle {
                                width: parent.width
                                height: 92
                                radius: 15
                                color: "#172431"
                                border.width: 1
                                border.color: root.alertSeverity > 1
                                    ? "#70ff7d91"
                                    : root.alertSeverity > 0 ? "#70f1bd66" : "#4d70e1bd"

                                Column {
                                    anchors {
                                        left: parent.left
                                        right: parent.right
                                        verticalCenter: parent.verticalCenter
                                        margins: 16
                                    }
                                    spacing: 4

                                    Text {
                                        text: root.alertSeverity > 1
                                            ? "ATENCION REQUERIDA"
                                            : root.alertSeverity > 0 ? "ESTADO DEGRADADO" : "SISTEMAS NOMINALES"
                                        color: root.alertSeverity > 1
                                            ? Shell.Theme.rose
                                            : root.alertSeverity > 0 ? Shell.Theme.amber : Shell.Theme.mint
                                        font.family: Shell.Theme.monoFamily
                                        font.pixelSize: 10
                                        font.weight: Font.Bold
                                        font.letterSpacing: 1
                                    }

                                    Text {
                                        text: root.alertSeverity > 0
                                            ? Services.AlertState.label
                                            : "Sin alertas activas"
                                        color: Shell.Theme.textPrimary
                                        font.family: Shell.Theme.sansFamily
                                        font.pixelSize: 18
                                        font.weight: Font.DemiBold
                                    }

                                    Text {
                                        text: `${Services.TrayState.visibleCount} servicios de bandeja / ${root.monitors.length} pantallas`
                                        color: Shell.Theme.textMuted
                                        font.family: Shell.Theme.monoFamily
                                        font.pixelSize: 9
                                    }
                                }
                            }

                            ControlCard {
                                width: parent.width
                                eyebrow: "AUDIO / PIPEWIRE"
                                value: Services.AudioState.available
                                    ? (Services.AudioState.muted ? "Silenciado" : `${Services.AudioState.volume}%`)
                                    : "No disponible"
                                detail: Services.AudioState.sinkName
                                accent: Services.AudioState.muted ? Shell.Theme.amber : Shell.Theme.frost
                                interactive: Services.AudioState.available
                                onActivated: Services.AudioState.toggleMute()
                            }

                            ControlCard {
                                width: parent.width
                                eyebrow: "CONECTIVIDAD"
                                value: Services.NetworkState.label
                                detail: Services.BluetoothState.connectedCount > 0
                                    ? `${Services.BluetoothState.connectedCount} dispositivos Bluetooth`
                                    : "Bluetooth sin dispositivos conectados"
                                accent: Services.NetworkState.severity > 1
                                    ? Shell.Theme.rose
                                    : Services.NetworkState.severity > 0 ? Shell.Theme.amber : Shell.Theme.mint
                            }

                            ControlCard {
                                width: parent.width
                                eyebrow: "ENERGIA"
                                value: Services.PowerState.available
                                    ? Services.PowerState.label
                                    : "Desktop / corriente estable"
                                detail: Services.PowerState.available && Services.PowerState.onBattery
                                    ? "Operando con bateria"
                                    : "Sin bateria activa"
                                accent: Services.PowerState.warningLevel > 1
                                    ? Shell.Theme.rose
                                    : Services.PowerState.warningLevel > 0 ? Shell.Theme.amber : Shell.Theme.textMuted
                            }
                        }
                    }

                    Item {
                        anchors.fill: parent
                        visible: root.activeTab === 1

                        Column {
                            anchors.fill: parent
                            spacing: 12

                            Rectangle {
                                width: parent.width
                                height: 166
                                radius: 16
                                color: "#172431"
                                border.width: 1
                                border.color: "#365b7892"

                                Column {
                                    anchors {
                                        fill: parent
                                        margins: 16
                                    }
                                    spacing: 10

                                    Row {
                                        width: parent.width

                                        Column {
                                            width: parent.width - 92
                                            spacing: 2

                                            Text {
                                                text: "SALIDA PRINCIPAL"
                                                color: Shell.Theme.frost
                                                font.family: Shell.Theme.monoFamily
                                                font.pixelSize: 9
                                                font.weight: Font.DemiBold
                                                font.letterSpacing: 0.8
                                            }

                                            Text {
                                                width: parent.width
                                                text: Services.AudioState.sinkName
                                                color: Shell.Theme.textPrimary
                                                elide: Text.ElideRight
                                                font.family: Shell.Theme.sansFamily
                                                font.pixelSize: 14
                                                font.weight: Font.DemiBold
                                            }
                                        }

                                        Text {
                                            anchors.verticalCenter: parent.verticalCenter
                                            width: 92
                                            horizontalAlignment: Text.AlignRight
                                            text: `${Services.AudioState.volume}%`
                                            color: Services.AudioState.muted ? Shell.Theme.amber : Shell.Theme.textPrimary
                                            font.family: Shell.Theme.monoFamily
                                            font.pixelSize: 24
                                            font.weight: Font.DemiBold
                                        }
                                    }

                                    Item {
                                        id: volumeSlider
                                        width: parent.width
                                        height: 28

                                        function applyPosition(xPosition): void {
                                            Services.AudioState.setVolume(Math.round(Math.max(0, Math.min(width, xPosition)) / width * 100));
                                        }

                                        Rectangle {
                                            anchors.verticalCenter: parent.verticalCenter
                                            width: parent.width
                                            height: 5
                                            radius: 3
                                            color: "#294052"
                                        }

                                        Rectangle {
                                            anchors.verticalCenter: parent.verticalCenter
                                            width: parent.width * Services.AudioState.volume / 100
                                            height: 5
                                            radius: 3
                                            color: Services.AudioState.muted ? Shell.Theme.amber : Shell.Theme.frost
                                        }

                                        Rectangle {
                                            x: Math.max(0, Math.min(parent.width - width,
                                                parent.width * Services.AudioState.volume / 100 - width / 2))
                                            anchors.verticalCenter: parent.verticalCenter
                                            width: 16
                                            height: 16
                                            radius: 8
                                            color: Shell.Theme.textPrimary
                                            border.width: 3
                                            border.color: Services.AudioState.muted ? Shell.Theme.amber : Shell.Theme.frost
                                        }

                                        MouseArea {
                                            anchors.fill: parent
                                            enabled: Services.AudioState.available
                                            hoverEnabled: enabled
                                            cursorShape: Qt.PointingHandCursor
                                            onPressed: mouse => volumeSlider.applyPosition(mouse.x)
                                            onPositionChanged: mouse => {
                                                if (pressed)
                                                    volumeSlider.applyPosition(mouse.x);
                                            }
                                            onWheel: wheel => Services.AudioState.adjustVolume(wheel.angleDelta.y > 0 ? 5 : -5)
                                        }
                                    }

                                    Rectangle {
                                        width: parent.width
                                        height: 34
                                        radius: 11
                                        color: muteArea.containsMouse ? "#2b4052" : "#1c2c39"

                                        Text {
                                            anchors.centerIn: parent
                                            text: Services.AudioState.muted ? "REACTIVAR AUDIO" : "SILENCIAR AUDIO"
                                            color: Services.AudioState.muted ? Shell.Theme.amber : Shell.Theme.textPrimary
                                            font.family: Shell.Theme.monoFamily
                                            font.pixelSize: 10
                                            font.weight: Font.DemiBold
                                        }

                                        MouseArea {
                                            id: muteArea
                                            anchors.fill: parent
                                            enabled: Services.AudioState.available
                                            hoverEnabled: true
                                            cursorShape: Qt.PointingHandCursor
                                            onClicked: Services.AudioState.toggleMute()
                                        }
                                    }
                                }
                            }

                            ControlCard {
                                width: parent.width
                                eyebrow: "POLITICA DE CONTROL"
                                value: "Rango protegido 0-100%"
                                detail: "Rueda: 5% / click en pista: valor exacto"
                                accent: Shell.Theme.textMuted
                            }
                        }
                    }

                    Item {
                        anchors.fill: parent
                        visible: root.activeTab === 2

                        Column {
                            anchors.fill: parent
                            spacing: 8

                            ControlCard {
                                width: parent.width
                                eyebrow: "NETWORKMANAGER"
                                value: Services.NetworkState.label
                                detail: Services.NetworkState.limited
                                    ? "Acceso limitado o portal cautivo"
                                    : Services.NetworkState.offline ? "No existe enlace util" : "Conectividad completa"
                                accent: Services.NetworkState.severity > 1
                                    ? Shell.Theme.rose
                                    : Services.NetworkState.severity > 0 ? Shell.Theme.amber : Shell.Theme.mint
                            }

                            Row {
                                width: parent.width
                                spacing: 8

                                ControlCard {
                                    width: (parent.width - 8) / 2
                                    eyebrow: "ETHERNET"
                                    value: Services.NetworkState.wiredConnected ? "Conectado" : "Inactivo"
                                    detail: "Enlace cableado"
                                    accent: Services.NetworkState.wiredConnected ? Shell.Theme.mint : Shell.Theme.textMuted
                                }

                                ControlCard {
                                    width: (parent.width - 8) / 2
                                    eyebrow: "WI-FI"
                                    value: Services.NetworkState.wifiConnected ? "Conectado" : "Inactivo"
                                    detail: "SSID protegido"
                                    accent: Services.NetworkState.wifiConnected ? Shell.Theme.mint : Shell.Theme.textMuted
                                }
                            }

                            ControlCard {
                                width: parent.width
                                eyebrow: "BLUETOOTH"
                                value: !Services.BluetoothState.available
                                    ? "Sin adaptador"
                                    : Services.BluetoothState.blocked ? "Bloqueado"
                                    : Services.BluetoothState.enabled ? "Encendido" : "Apagado"
                                detail: `${Services.BluetoothState.connectedCount} dispositivos conectados`
                                accent: Services.BluetoothState.severity > 0
                                    ? Shell.Theme.rose
                                    : Services.BluetoothState.connectedCount > 0 ? Shell.Theme.mint : Shell.Theme.textMuted
                            }

                            Repeater {
                                model: Services.BluetoothState.connectedDevices

                                ControlCard {
                                    required property var modelData

                                    width: parent.width
                                    eyebrow: "DISPOSITIVO CONECTADO"
                                    value: modelData.name || modelData.alias || "Bluetooth"
                                    detail: "Gestion informativa en esta fase"
                                    accent: Shell.Theme.mint
                                }
                            }
                        }
                    }

                    Flickable {
                        anchors.fill: parent
                        visible: root.activeTab === 3
                        contentHeight: displayColumn.implicitHeight
                        clip: true

                        Column {
                            id: displayColumn
                            width: parent.width
                            spacing: 8

                            Rectangle {
                                width: parent.width
                                height: 62
                                radius: 13
                                color: "#172431"
                                border.width: 1
                                border.color: "#365b7892"

                                Row {
                                    anchors {
                                        fill: parent
                                        margins: 13
                                    }

                                    Column {
                                        width: parent.width - 80
                                        spacing: 2

                                        Text {
                                            width: parent.width
                                            text: Services.DisplayState.busy || Services.DisplayState.failed
                                                ? Services.DisplayState.message
                                                : "GEOMETRIA ACTIVA"
                                            color: Services.DisplayState.failed
                                                ? Shell.Theme.rose
                                                : Services.DisplayState.busy ? Shell.Theme.amber : Shell.Theme.frost
                                            elide: Text.ElideRight
                                            font.family: Shell.Theme.monoFamily
                                            font.pixelSize: 9
                                            font.weight: Font.DemiBold
                                        }

                                        Text {
                                            text: `${root.monitors.length} ${root.monitors.length === 1 ? "PANTALLA" : "PANTALLAS"} / ESCRITORIO ${root.horizontalLayout ? "HORIZONTAL" : "VERTICAL"}`
                                            color: Shell.Theme.textPrimary
                                            font.family: Shell.Theme.sansFamily
                                            font.pixelSize: 13
                                            font.weight: Font.DemiBold
                                        }
                                    }

                                    Text {
                                        anchors.verticalCenter: parent.verticalCenter
                                        width: 80
                                        horizontalAlignment: Text.AlignRight
                                        text: `${root.desktopWidth}x${root.desktopHeight}`
                                        color: Shell.Theme.textMuted
                                        font.family: Shell.Theme.monoFamily
                                        font.pixelSize: 10
                                    }
                                }
                            }

                            Row {
                                width: parent.width
                                height: 66
                                spacing: 8

                                DisplayActionButton {
                                    width: (parent.width - 16) / 3
                                    label: "DUAL"
                                    detail: "EXTENDER"
                                    active: Services.DisplayState.currentMode === "dual"
                                    enabled: !Services.DisplayState.busy
                                    onActivated: root.requestDisplayMode("dual")
                                }

                                DisplayActionButton {
                                    width: (parent.width - 16) / 3
                                    label: "SOLO HDMI"
                                    detail: "APAGA DP"
                                    active: Services.DisplayState.currentMode === "hdmi"
                                    armed: root.pendingDisplayMode === "hdmi"
                                    enabled: !Services.DisplayState.busy
                                    onActivated: root.requestDisplayMode("hdmi")
                                }

                                DisplayActionButton {
                                    width: (parent.width - 16) / 3
                                    label: "SOLO DP"
                                    detail: "APAGA HDMI"
                                    active: Services.DisplayState.currentMode === "dp"
                                    armed: root.pendingDisplayMode === "dp"
                                    enabled: !Services.DisplayState.busy
                                    onActivated: root.requestDisplayMode("dp")
                                }
                            }

                            Repeater {
                                model: root.monitors

                                Rectangle {
                                    required property var modelData

                                    width: parent.width
                                    height: 94
                                    radius: 14
                                    color: modelData.focused ? "#1d3040" : "#14212c"
                                    border.width: 1
                                    border.color: modelData.focused ? "#6579c7ff" : "#263f54"

                                    Rectangle {
                                        anchors {
                                            left: parent.left
                                            top: parent.top
                                            bottom: parent.bottom
                                        }
                                        width: 3
                                        radius: 2
                                        color: modelData.focused ? Shell.Theme.frost : Shell.Theme.textMuted
                                    }

                                    Column {
                                        anchors {
                                            left: parent.left
                                            right: parent.right
                                            verticalCenter: parent.verticalCenter
                                            leftMargin: 16
                                            rightMargin: 14
                                        }
                                        spacing: 4

                                        Row {
                                            width: parent.width

                                            Text {
                                                width: parent.width - 88
                                                text: modelData.name
                                                color: Shell.Theme.textPrimary
                                                font.family: Shell.Theme.sansFamily
                                                font.pixelSize: 15
                                                font.weight: Font.DemiBold
                                            }

                                            Text {
                                                width: 88
                                                horizontalAlignment: Text.AlignRight
                                                text: modelData.focused ? "EN FOCO" : "ACTIVA"
                                                color: modelData.focused ? Shell.Theme.frost : Shell.Theme.textMuted
                                                font.family: Shell.Theme.monoFamily
                                                font.pixelSize: 9
                                                font.weight: Font.DemiBold
                                            }
                                        }

                                        Text {
                                            text: `${modelData.width} x ${modelData.height} / ${Math.round(modelData.scale * 100)}%`
                                            color: Shell.Theme.textPrimary
                                            font.family: Shell.Theme.monoFamily
                                            font.pixelSize: 11
                                        }

                                        Text {
                                            text: `POS ${modelData.x},${modelData.y} / WORKSPACE ${modelData.activeWorkspace ? modelData.activeWorkspace.name : "--"}`
                                            color: Shell.Theme.textMuted
                                            font.family: Shell.Theme.monoFamily
                                            font.pixelSize: 9
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
