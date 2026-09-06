pragma Singleton

import Quickshell
import Quickshell.Hyprland

Singleton {
    property string monitorName: ""

    function openFor(name: string): void {
        monitorName = name;
    }

    function close(): void {
        monitorName = "";
    }

    function toggleFocused(): void {
        const monitors = Hyprland.monitors.values;
        const focused = monitors.find(monitor => monitor.focused);

        if (!focused)
            return;

        monitorName === focused.name ? close() : openFor(focused.name);
    }
}
