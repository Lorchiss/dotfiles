import Quickshell
import Quickshell.Io
import qs.services as Services

ShellRoot {
    IpcHandler {
        target: "polar"

        function toggleControlCenter(): void {
            Services.ControlCenterState.toggleFocused();
        }

        function closeControlCenter(): void {
            Services.ControlCenterState.close();
        }

        function controlCenterMonitor(): string {
            return Services.ControlCenterState.monitorName;
        }

        function setDisplayMode(mode: string): void {
            Services.DisplayState.applyMode(mode);
        }

        function displayMode(): string {
            return Services.DisplayState.currentMode;
        }

        function displayStatus(): string {
            return Services.DisplayState.message;
        }
    }

    Bar {}
}
