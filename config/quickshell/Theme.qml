pragma Singleton

import QtQuick
import Quickshell

Singleton {
    readonly property color voidColor: "#080d14"
    readonly property color panelColor: "#e60d151f"
    readonly property color elevatedColor: "#f216222f"
    readonly property color hairlineColor: "#29435a"
    readonly property color textPrimary: "#edf7ff"
    readonly property color textMuted: "#91a5b7"
    readonly property color frost: "#79c7ff"
    readonly property color mint: "#70e1bd"
    readonly property color amber: "#f1bd66"
    readonly property color rose: "#ff7d91"

    readonly property int barHeight: 64
    readonly property int railHeight: 48
    readonly property int edgeMargin: 12
    readonly property int radiusRail: 17
    readonly property int radiusControl: 12
    readonly property int motionFast: 180
    readonly property int motionBase: 320
    readonly property int motionCinematic: 680

    readonly property string sansFamily: "IBM Plex Sans"
    readonly property string monoFamily: "IBM Plex Mono"
}
