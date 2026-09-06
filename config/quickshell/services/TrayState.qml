pragma Singleton

import Quickshell
import Quickshell.Services.SystemTray

Singleton {
    id: root

    readonly property var items: SystemTray.items.values
    readonly property var visibleItems: items
        .filter(item => item.status !== Status.Passive)
        .sort((left, right) => right.status - left.status)
    readonly property var attentionItems: visibleItems
        .filter(item => item.status === Status.NeedsAttention)
    readonly property int visibleCount: visibleItems.length
    readonly property int attentionCount: attentionItems.length
    readonly property int maximumVisible: 4
    readonly property var compactItems: visibleItems.slice(0, maximumVisible)
    readonly property int overflowCount: Math.max(0, visibleCount - compactItems.length)
}
