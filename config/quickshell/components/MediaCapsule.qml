import QtQuick
import qs as Shell
import qs.services as Services

Rectangle {
    id: root

    required property var monitor
    readonly property bool shown: Boolean(monitor && monitor.focused && Services.MediaState.available)
    readonly property real naturalWidth: 390

    width: shown ? naturalWidth : 0
    height: 36
    opacity: shown ? 1 : 0
    scale: shown ? 1 : 0.94
    radius: 13
    color: "#d0162532"
    border.color: Services.MediaState.playing ? "#5570e1bd" : "#3679c7ff"
    clip: true
    visible: width > 1

    Row {
        anchors {
            fill: parent
            leftMargin: 5
            rightMargin: 7
        }
        spacing: 8

        Rectangle {
            anchors.verticalCenter: parent.verticalCenter
            width: 28
            height: 28
            radius: 9
            color: Shell.Theme.elevatedColor
            clip: true

            Image {
                id: coverArt
                anchors.fill: parent
                source: Services.MediaState.artUrl
                sourceSize.width: 56
                sourceSize.height: 56
                fillMode: Image.PreserveAspectCrop
                asynchronous: true
                visible: status === Image.Ready
            }

            Text {
                anchors.centerIn: parent
                visible: coverArt.status !== Image.Ready
                text: "M"
                color: Shell.Theme.frost
                font.family: Shell.Theme.monoFamily
                font.pixelSize: 11
                font.weight: Font.Bold
            }
        }

        Column {
            anchors.verticalCenter: parent.verticalCenter
            width: 240
            spacing: -2

            Text {
                width: parent.width
                text: Services.MediaState.title.toUpperCase()
                color: Shell.Theme.textPrimary
                elide: Text.ElideRight
                font.family: Shell.Theme.sansFamily
                font.pixelSize: 10
                font.weight: Font.DemiBold
                font.letterSpacing: 0.5
            }

            Text {
                width: parent.width
                text: Services.MediaState.artist.toUpperCase()
                color: Services.MediaState.playing ? Shell.Theme.mint : Shell.Theme.textMuted
                elide: Text.ElideRight
                font.family: Shell.Theme.monoFamily
                font.pixelSize: 8
                font.letterSpacing: 0.7
            }
        }

        Row {
            anchors.verticalCenter: parent.verticalCenter
            spacing: 1

            MediaButton {
                label: "|<"
                enabled: Services.MediaState.canPrevious
                onActivated: Services.MediaState.previousTrack()
            }

            MediaButton {
                label: Services.MediaState.playing ? "||" : ">"
                enabled: Services.MediaState.canToggle
                onActivated: Services.MediaState.togglePlaying()
            }

            MediaButton {
                label: ">|"
                enabled: Services.MediaState.canNext
                onActivated: Services.MediaState.nextTrack()
            }
        }
    }

    Behavior on width { NumberAnimation { duration: Shell.Theme.motionBase; easing.type: Easing.OutCubic } }
    Behavior on opacity { NumberAnimation { duration: Shell.Theme.motionFast } }
    Behavior on scale { NumberAnimation { duration: Shell.Theme.motionBase; easing.type: Easing.OutBack } }
    Behavior on border.color { ColorAnimation { duration: Shell.Theme.motionFast } }
}
