import app from "ags/gtk4/app"
import { execAsync } from "ags/process"
import { createPoll } from "ags/time"
import {
  COMMAND_PALETTE_UI,
  CONTROL_CENTER_UI,
  OVERLAY_LAYOUT,
  SPOTIFY_UI,
} from "./uiTokens"

export type OverlayId = "spotify" | "control-center" | "command-palette"

type HyprMonitorRaw = {
  id?: number
  focused?: boolean
  width?: number
  height?: number
}

type OverlayVisibility = Record<OverlayId, boolean>

type OverlayBox = {
  marginTop: number
  marginRight: number
  width: number
}

export type OverlayLayoutSnapshot = {
  monitorIndex: number
  monitorWidth: number
  monitorHeight: number
  mode: "solo" | "side" | "stack"
  commandPalette: OverlayBox
  controlCenter: OverlayBox & {
    contentHeight: number
  }
  spotify: OverlayBox
}

const overlayRefs: Partial<Record<OverlayId, any>> = {}
const overlayVisibility: OverlayVisibility = {
  spotify: false,
  "control-center": false,
  "command-palette": false,
}

const suppressedSync = new Set<OverlayId>()

const FALLBACK_LAYOUT: OverlayLayoutSnapshot = {
  monitorIndex: 0,
  monitorWidth: 1920,
  monitorHeight: 1080,
  mode: "solo",
  commandPalette: {
    marginTop: OVERLAY_LAYOUT.topOffset + 8,
    marginRight: 0,
    width: COMMAND_PALETTE_UI.width,
  },
  controlCenter: {
    marginTop: OVERLAY_LAYOUT.topOffset,
    marginRight: OVERLAY_LAYOUT.edgeOffset,
    width: CONTROL_CENTER_UI.width,
    contentHeight: CONTROL_CENTER_UI.contentHeight,
  },
  spotify: {
    marginTop: OVERLAY_LAYOUT.topOffset,
    marginRight: OVERLAY_LAYOUT.edgeOffset,
    width: SPOTIFY_UI.coverWrapSize + SPOTIFY_UI.popupPadding * 2,
  },
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function readNumber(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback
  return value
}

async function readFocusedMonitor() {
  try {
    const raw = await execAsync(`bash -lc "hyprctl -j monitors"`)
    const parsed = JSON.parse(raw) as HyprMonitorRaw[]
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return {
        monitorIndex: 0,
        width: FALLBACK_LAYOUT.monitorWidth,
        height: FALLBACK_LAYOUT.monitorHeight,
      }
    }

    const focused = parsed.find((monitor) => monitor.focused) ?? parsed[0]
    const monitorIndex = clamp(
      Math.trunc(readNumber(focused?.id, 0)),
      0,
      Math.max(0, parsed.length - 1),
    )

    return {
      monitorIndex,
      width: readNumber(focused?.width, FALLBACK_LAYOUT.monitorWidth),
      height: readNumber(focused?.height, FALLBACK_LAYOUT.monitorHeight),
    }
  } catch {
    return {
      monitorIndex: 0,
      width: FALLBACK_LAYOUT.monitorWidth,
      height: FALLBACK_LAYOUT.monitorHeight,
    }
  }
}

function setOverlayVisible(id: OverlayId, visible: boolean) {
  overlayVisibility[id] = visible

  const ref = overlayRefs[id]
  if (!ref) return
  if (Boolean(ref.visible) === visible) return

  suppressedSync.add(id)
  ref.visible = visible
}

function applyVisibilityPolicy(activeOverlay: OverlayId, visible: boolean) {
  if (!visible) return

  if (activeOverlay === "command-palette") {
    setOverlayVisible("spotify", false)
    setOverlayVisible("control-center", false)
    return
  }

  if (overlayVisibility["command-palette"]) {
    setOverlayVisible("command-palette", false)
  }
}

export function registerOverlayWindow(id: OverlayId, windowRef: any) {
  overlayRefs[id] = windowRef
}

export function onOverlayVisibilityChanged(id: OverlayId, visible: boolean) {
  if (suppressedSync.has(id)) {
    suppressedSync.delete(id)
    overlayVisibility[id] = visible
    return
  }

  overlayVisibility[id] = visible
  applyVisibilityPolicy(id, visible)
}

function buildLayout(
  monitorIndex: number,
  monitorWidth: number,
  monitorHeight: number,
): OverlayLayoutSnapshot {
  const sidePadding = OVERLAY_LAYOUT.edgeOffset
  const topOffset = OVERLAY_LAYOUT.topOffset
  const gap = OVERLAY_LAYOUT.gap

  const controlWidth = clamp(
    Math.floor(monitorWidth * 0.34),
    560,
    CONTROL_CENTER_UI.width,
  )
  const spotifyWidth = clamp(
    SPOTIFY_UI.coverWrapSize + SPOTIFY_UI.popupPadding * 2,
    220,
    320,
  )
  const paletteWidth = clamp(
    monitorWidth - sidePadding * 2,
    640,
    COMMAND_PALETTE_UI.width,
  )
  const controlContentHeight = clamp(Math.floor(monitorHeight * 0.4), 320, 540)

  const controlEstimatedHeight = controlContentHeight + 146
  const spotifyEstimatedHeight = SPOTIFY_UI.coverWrapSize + 212

  const bothRightPanelsVisible =
    overlayVisibility.spotify && overlayVisibility["control-center"]

  const sideBySideRequired =
    controlWidth + spotifyWidth + sidePadding * 2 + gap + 120
  const canSideBySide = monitorWidth >= sideBySideRequired

  let mode: OverlayLayoutSnapshot["mode"] = "solo"

  const controlCenter: OverlayLayoutSnapshot["controlCenter"] = {
    marginTop: topOffset,
    marginRight: sidePadding,
    width: controlWidth,
    contentHeight: controlContentHeight,
  }

  const spotify: OverlayLayoutSnapshot["spotify"] = {
    marginTop: topOffset,
    marginRight: sidePadding,
    width: spotifyWidth,
  }

  if (bothRightPanelsVisible) {
    if (canSideBySide) {
      mode = "side"
      spotify.marginRight = sidePadding + controlWidth + gap
      spotify.marginTop = topOffset
    } else {
      mode = "stack"
      spotify.marginTop = topOffset + controlEstimatedHeight + gap
      const maxTop = Math.max(
        topOffset,
        monitorHeight - spotifyEstimatedHeight - sidePadding,
      )
      spotify.marginTop = Math.min(spotify.marginTop, maxTop)
      spotify.marginRight = sidePadding
    }
  }

  return {
    monitorIndex,
    monitorWidth,
    monitorHeight,
    mode,
    commandPalette: {
      marginTop: topOffset + 8,
      marginRight: 0,
      width: paletteWidth,
    },
    controlCenter,
    spotify,
  }
}

const overlayLayoutState = createPoll<OverlayLayoutSnapshot>(
  FALLBACK_LAYOUT,
  650,
  async () => {
    const monitor = await readFocusedMonitor()
    return buildLayout(monitor.monitorIndex, monitor.width, monitor.height)
  },
)

export function overlayLayoutBinding() {
  return overlayLayoutState
}

export function monitorFromLayout(layout: OverlayLayoutSnapshot): any {
  const monitors = app.get_monitors?.() ?? []
  if (!Array.isArray(monitors) || monitors.length === 0) return null

  const safeIndex = clamp(layout.monitorIndex, 0, monitors.length - 1)
  return monitors[safeIndex] ?? monitors[0] ?? null
}
