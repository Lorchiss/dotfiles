pragma Singleton

import Quickshell
import Quickshell.Services.Pipewire

Singleton {
    id: root

    readonly property var sink: Pipewire.defaultAudioSink
    readonly property bool available: Boolean(Pipewire.ready && sink && sink.audio)
    readonly property int volume: available ? Math.round(sink.audio.volume * 100) : 0
    readonly property bool muted: available ? sink.audio.muted : false
    readonly property string sinkName: available
        ? (sink.description || sink.nickname || sink.name || "Audio")
        : "Audio no disponible"

    PwObjectTracker {
        objects: [root.sink]
    }

    function adjustVolume(step: real): void {
        if (!available)
            return;

        sink.audio.volume = Math.max(0, Math.min(1, sink.audio.volume + step / 100));
    }

    function setVolume(value: real): void {
        if (available)
            sink.audio.volume = Math.max(0, Math.min(1, value / 100));
    }

    function toggleMute(): void {
        if (available)
            sink.audio.muted = !sink.audio.muted;
    }
}
