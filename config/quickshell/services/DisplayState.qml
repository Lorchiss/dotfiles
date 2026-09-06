pragma Singleton

import QtQuick
import Quickshell
import Quickshell.Hyprland
import Quickshell.Io

Singleton {
    id: root

    readonly property string hdmiName: "HDMI-A-1"
    readonly property string dpName: "DP-1"
    readonly property var activeNames: Hyprland.monitors.values.map(monitor => monitor.name)
    readonly property string currentMode: activeNames.includes(hdmiName) && activeNames.includes(dpName)
        ? "dual"
        : activeNames.includes(hdmiName) ? "hdmi"
        : activeNames.includes(dpName) ? "dp" : "unknown"
    property bool busy: false
    property bool failed: false
    property string message: ""
    property string requestedMode: ""
    property string pendingRequest: ""
    property string startupMode: ""
    property var requestQueue: []

    function applyMode(mode: string): void {
        if (busy)
            return;

        if (!["dual", "hdmi", "dp"].includes(mode)) {
            fail("Preset de pantalla desconocido");
            return;
        }

        if (mode !== "dual") {
            const target = mode === "hdmi" ? hdmiName : dpName;
            if (!activeNames.includes(target)) {
                fail(`${target} no esta activa; restaura DUAL primero`);
                return;
            }
        }

        let requests = [];
        if (mode === "dual") {
            requests = [
                `/keyword monitor ${hdmiName},1920x1080@60,0x0,1`,
                `/keyword monitor ${dpName},1920x1080@165,1920x0,1`
            ];
        } else if (mode === "hdmi") {
            requests = [
                `/keyword monitor ${hdmiName},1920x1080@60,0x0,1`,
                `/keyword monitor ${dpName},disable`
            ];
        } else {
            requests = [
                `/keyword monitor ${dpName},1920x1080@165,0x0,1`,
                `/keyword monitor ${hdmiName},disable`
            ];
        }

        busy = true;
        failed = false;
        requestedMode = mode;
        message = `APLICANDO ${mode.toUpperCase()}...`;
        requestQueue = requests;
        sendNext();
    }

    function sendNext(): void {
        if (requestQueue.length === 0) {
            busy = false;
            failed = false;
            message = `${requestedMode.toUpperCase()} ACTIVO`;
            preferenceFile.setText(`${requestedMode}\n`);
            refreshTimer.restart();
            return;
        }

        pendingRequest = requestQueue[0];
        requestQueue = requestQueue.slice(1);
        hyprSocket.connected = true;
    }

    function handleResponse(data: string): void {
        const response = data.trim();
        hyprSocket.connected = false;

        if (!response.startsWith("ok")) {
            fail(response || "Hyprland rechazo el cambio");
            return;
        }

        Qt.callLater(sendNext);
    }

    function fail(reason: string): void {
        requestQueue = [];
        pendingRequest = "";
        busy = false;
        failed = true;
        message = reason;
        hyprSocket.connected = false;
        refreshTimer.restart();
    }

    Socket {
        id: hyprSocket

        path: Hyprland.requestSocketPath
        connected: false

        parser: SplitParser {
            splitMarker: ""
            onRead: data => root.handleResponse(data)
        }

        onConnectedChanged: {
            if (!connected || !root.pendingRequest)
                return;

            write(root.pendingRequest);
            flush();
        }

        onError: error => root.fail(`IPC de Hyprland: ${error}`)
    }

    FileView {
        id: preferenceFile

        path: Quickshell.statePath("display-mode")
        blockWrites: true
        printErrors: false

        onLoaded: {
            const savedMode = text().trim();
            if (["dual", "hdmi", "dp"].includes(savedMode)
                    && savedMode !== root.currentMode) {
                root.startupMode = savedMode;
                startupApplyTimer.restart();
            }
        }
    }

    Timer {
        id: startupApplyTimer

        interval: 900
        repeat: false
        onTriggered: {
            if (root.startupMode)
                root.applyMode(root.startupMode);
            root.startupMode = "";
        }
    }

    Timer {
        id: refreshTimer

        interval: 500
        repeat: false
        onTriggered: Hyprland.refreshMonitors()
    }
}
