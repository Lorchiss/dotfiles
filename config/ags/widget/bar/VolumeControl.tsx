import { Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { createPoll } from "ags/time"
import { createMusicAccentClassState } from "../../lib/musicAccent"
import { BAR_UI } from "../../lib/uiTokens"
import { safeText } from "../../lib/text"
import { barLog } from "../../lib/barObservability"

const volumeStep = 5
const keepVolumePopoverOpen = false

type VolumeState = {
  value: number
  muted: boolean
}

function clampVolume(value: number) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(100, numeric))
}

function volumeIconName(value: number, muted: boolean) {
  if (muted || value <= 0) return "audio-volume-muted-symbolic"
  if (value < 34) return "audio-volume-low-symbolic"
  if (value < 67) return "audio-volume-medium-symbolic"
  return "audio-volume-high-symbolic"
}

export default function VolumeControl() {
  barLog("AUDIO", "mounting VolumeControl")
  let syncingScale = false
  let ignoreStateSyncUntil = 0
  const accentClass = createMusicAccentClassState()

  const state = createPoll<VolumeState>(
    { value: 0, muted: false },
    BAR_UI.timing.volumePollMs,
    async (prev) => {
      try {
        const wpLine = (
          await execAsync(
            `bash -lc "LC_ALL=C wpctl get-volume @DEFAULT_AUDIO_SINK@ 2>/dev/null || true"`,
          )
        ).trim()
        if (wpLine) {
          const match = wpLine.match(/([0-9]+(?:[.,][0-9]+)?)/)
          if (match) {
            const parsed = Number.parseFloat(match[1].replace(",", "."))
            if (Number.isFinite(parsed)) {
              return {
                value: clampVolume(Math.round(parsed * 100)),
                muted: wpLine.includes("[MUTED]"),
              }
            }
          }
        }

        const out = await execAsync(`bash -lc '
vol=$(pactl get-sink-volume @DEFAULT_SINK@ 2>/dev/null | head -n1 | awk "{print \$5}" | tr -d "%")
mute=$(pactl get-sink-mute @DEFAULT_SINK@ 2>/dev/null | awk "{print \$2}")
printf "%s\n%s" "$vol" "$mute"
'`)
        const [volRaw = "0", muteRaw = "no"] = out
          .trim()
          .split("\n")
          .map((v) => v.trim())

        const parsed = Number.parseInt(volRaw, 10)
        if (!Number.isFinite(parsed)) return prev

        return {
          value: Number.isFinite(parsed) ? clampVolume(parsed) : 0,
          muted: muteRaw === "yes",
        }
      } catch {
        return prev
      }
    },
  )

  const setVolume = (value: number) => {
    const next = Math.round(clampVolume(value))
    return execAsync(
      `bash -lc "if command -v wpctl >/dev/null 2>&1; then wpctl set-volume @DEFAULT_AUDIO_SINK@ ${next}%; else pactl set-sink-volume @DEFAULT_SINK@ ${next}%; fi"`,
    ).catch(() => {})
  }

  const readState = () => {
    const source = state as any
    if (typeof source.peek === "function") return source.peek() as VolumeState
    if (typeof source === "function") return source() as VolumeState
    return { value: 0, muted: false }
  }

  const toggleMute = () =>
    execAsync(
      `bash -lc "if command -v wpctl >/dev/null 2>&1; then wpctl set-mute @DEFAULT_AUDIO_SINK@ toggle; else pactl set-sink-mute @DEFAULT_SINK@ toggle; fi"`,
    ).catch(() => {})

  return (
    <menubutton class="vol-control" tooltipText="Volumen">
      <box spacing={BAR_UI.spacing.tight}>
        <image
          class="vol-trigger-icon"
          iconName={state((s) => volumeIconName(s.value, s.muted))}
          pixelSize={BAR_UI.size.volumeIcon}
        />
        <label
          class="vol-trigger-label"
          label={state((s) =>
            safeText(
              `${clampVolume(s.value)}%`,
              "--%",
              "AUDIO",
              "trigger-label",
            ),
          )}
          maxWidthChars={BAR_UI.text.volumeLabelChars}
          singleLineMode
        />
      </box>

      <popover
        class="vol-popover-shell"
        autohide={!keepVolumePopoverOpen}
        hasArrow={false}
      >
        <box
          spacing={BAR_UI.spacing.popover}
          cssName="volPopover"
          class={accentClass(
            (accent) => `volPopover popup-accent-surface ${accent}`,
          )}
        >
          <button
            class="vol-mute-btn"
            onClicked={toggleMute}
            tooltipText="Silenciar"
          >
            <image
              class="vol-popup-icon"
              iconName={state((s) => volumeIconName(s.value, s.muted))}
              pixelSize={BAR_UI.size.volumePopoverIcon}
            />
          </button>

          <box
            orientation={Gtk.Orientation.VERTICAL}
            spacing={BAR_UI.spacing.popover}
            hexpand
          >
            <box spacing={BAR_UI.spacing.popover}>
              <label
                class="vol-popup-heading"
                label="Volumen"
                xalign={0}
                hexpand
              />
              <label
                class="vol-percent-label"
                label={state((s) =>
                  safeText(
                    `${clampVolume(s.value)}%`,
                    "--%",
                    "AUDIO",
                    "popover-percent",
                  ),
                )}
              />
            </box>

            <box spacing={BAR_UI.spacing.popover}>
              <Gtk.Scale
                class="vol-scale"
                orientation={Gtk.Orientation.HORIZONTAL}
                hexpand
                drawValue={false}
                roundDigits={0}
                $={(self: any) => {
                  self.set_range(0, 100)
                  self.set_increments(1, volumeStep)

                  const syncFromState = () => {
                    if (Date.now() < ignoreStateSyncUntil) return
                    const next = clampVolume(readState().value)
                    if (Math.round(self.get_value()) !== next) {
                      syncingScale = true
                      self.set_value(next)
                      syncingScale = false
                    }
                  }

                  syncFromState()
                  const unsubscribe = (state as any).subscribe?.(syncFromState)
                  if (typeof unsubscribe === "function") {
                    self.connect("destroy", () => unsubscribe())
                  }
                }}
                onValueChanged={(self: any) => {
                  if (syncingScale) return
                  ignoreStateSyncUntil = Date.now() + 500
                  void setVolume(self.get_value())
                }}
              />
            </box>
          </box>
        </box>
      </popover>
    </menubutton>
  )
}
