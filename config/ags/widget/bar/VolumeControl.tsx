import { Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { createPoll } from "ags/time"

const volumeStep = 5
const maxVolume = 150

function levelGlyph(value: number) {
  const bars = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"]
  const normalized = Math.max(0, Math.min(100, value))
  const idx = Math.min(
    bars.length - 1,
    Math.floor((normalized / 100) * bars.length),
  )
  return bars[idx]
}

export default function VolumeControl() {
  const volumeValue = createPoll(0, 800, async () => {
    try {
      const out = await execAsync(
        `bash -lc "pactl get-sink-volume @DEFAULT_SINK@ | head -n1 | awk '{print \\$5}' | tr -d '%'"`,
      )
      const parsed = Number.parseInt(out.trim(), 10)
      return Number.isFinite(parsed) ? parsed : 0
    } catch {
      return 0
    }
  })

  const isMuted = createPoll(false, 800, async () => {
    try {
      const out = await execAsync(
        `bash -lc "pactl get-sink-mute @DEFAULT_SINK@ | awk '{print \\$2}'"`,
      )
      return out.trim() === "yes"
    } catch {
      return false
    }
  })

  const setVolume = (value: number) => {
    const clamped = Math.max(0, Math.min(maxVolume, Math.round(value)))
    return execAsync(
      `bash -lc "pactl set-sink-volume @DEFAULT_SINK@ ${clamped}%"`,
    ).catch(() => {})
  }

  const lower = () =>
    execAsync(
      `bash -lc "pactl set-sink-volume @DEFAULT_SINK@ -${volumeStep}%"`,
    ).catch(() => {})
  const raise = () =>
    execAsync(
      `bash -lc "pactl set-sink-volume @DEFAULT_SINK@ +${volumeStep}%"`,
    ).catch(() => {})

  const toggleMute = () =>
    execAsync(`bash -lc "pactl set-sink-mute @DEFAULT_SINK@ toggle"`).catch(
      () => {},
    )

  return (
    <menubutton class="vol-control" tooltipText="Control de volumen">
      <box spacing={8}>
        <label label={isMuted((m) => (m ? "🔇" : "🔊"))} />
        <label label={volumeValue((v) => levelGlyph(v))} />
      </box>

      <popover class="vol-popover-shell">
        <box spacing={12} cssName="volPopover">
          <button
            class="vol-mute-btn"
            onClicked={toggleMute}
            tooltipText="Silenciar / activar sonido"
          >
            <label label={isMuted((m) => (m ? "🔇" : "🔊"))} />
          </button>

          <box hexpand orientation={Gtk.Orientation.VERTICAL} spacing={8}>
            <Gtk.Scale
              class="vol-slider"
              hexpand
              drawValue={false}
              roundDigits={0}
              orientation={Gtk.Orientation.HORIZONTAL}
              adjustment={
                new Gtk.Adjustment({
                  lower: 0,
                  upper: maxVolume,
                  stepIncrement: 1,
                  pageIncrement: 5,
                })
              }
              setup={(self: any) => {
                let syncing = false

                volumeValue((v) => {
                  const current = self.get_value()
                  if (Math.abs(current - v) > 0.5) {
                    syncing = true
                    self.set_value(v)
                    syncing = false
                  }
                  return v
                })

                self.connect("value-changed", () => {
                  if (syncing) return
                  setVolume(self.get_value())
                })
              }}
            />

            <box spacing={8} halign={Gtk.Align.END}>
              <button onClicked={lower} tooltipText="Bajar volumen">
                <label label="−" />
              </button>
              <button onClicked={raise} tooltipText="Subir volumen">
                <label label="+" />
              </button>
            </box>
          </box>
        </box>
      </popover>
    </menubutton>
  )
}
