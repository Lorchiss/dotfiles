export const OVERLAY_LAYOUT = {
  topOffset: 84,
  edgeOffset: 28,
  gap: 16,
} as const

export const BAR_UI = {
  spacing: {
    section: 12,
    cluster: 8,
    inline: 6,
    tight: 4,
    popover: 8,
  },
  text: {
    activeWindowMaxChars: 64,
    activeWindowMinChars: 24,
    networkLabelChars: 14,
    volumeLabelChars: 4,
  },
  size: {
    volumeIcon: 16,
    volumePopoverIcon: 18,
    networkIcon: 15,
    activeWindowIcon: 16,
  },
  timing: {
    activeWindowPollMs: 1200,
    volumePollMs: 700,
    networkPollMs: 2800,
  },
} as const

export const CONTROL_CENTER_UI = {
  width: 600,
  contentHeight: 430,
} as const

export const COMMAND_PALETTE_UI = {
  width: 780,
  minListHeight: 284,
} as const

export const SPOTIFY_UI = {
  coverWrapSize: 196,
  coverImageSize: 192,
  popupPadding: 16,
  popupHorizontalWidth: 548,
  popupVerticalTitleChars: 24,
  popupHorizontalTitleChars: 34,
  popupVerticalArtistChars: 26,
  popupHorizontalArtistChars: 38,
} as const
