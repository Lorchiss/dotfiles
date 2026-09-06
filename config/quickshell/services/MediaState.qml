pragma Singleton

import Quickshell
import Quickshell.Services.Mpris

Singleton {
    id: root

    readonly property var players: Mpris.players.values
    readonly property var player: players.find(candidate => candidate.isPlaying)
        ?? players.find(candidate => candidate.trackTitle && candidate.trackTitle.length > 0)
        ?? null
    readonly property bool available: Boolean(player && player.canControl
        && player.trackTitle && player.trackTitle.length > 0)
    readonly property bool playing: available && player.isPlaying
    readonly property string title: available ? player.trackTitle : ""
    readonly property string artist: available
        ? (player.trackArtist || player.identity || "MPRIS")
        : ""
    readonly property string artUrl: available ? player.trackArtUrl : ""
    readonly property bool canPrevious: available && player.canGoPrevious
    readonly property bool canNext: available && player.canGoNext
    readonly property bool canToggle: available && player.canTogglePlaying

    function togglePlaying(): void {
        if (canToggle)
            player.togglePlaying();
    }

    function previousTrack(): void {
        if (canPrevious)
            player.previous();
    }

    function nextTrack(): void {
        if (canNext)
            player.next();
    }
}
