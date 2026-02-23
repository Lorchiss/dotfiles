import { Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { createPoll } from "ags/time"

const volumeStep = 5

export default function VolumeControl() {
  const volume = createPoll("VOL --%", 1200, async () => {
    try {
      const out = await execAsync(
        `bash -lc "pactl get-sink-volume @DEFAULT_SINK@ | head -n1 | awk '{print \\$5}'"`,
      )
      return `VOL ${out.trim()}`
    } catch {
      return "VOL --%"
    }
  })

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
    <box spacing={6} class="vol-control" valign={Gtk.Align.CENTER}>
      <button onClicked={lower} tooltipText="Bajar volumen">
        <label label="−" />
      </button>
      <button onClicked={toggleMute} tooltipText="Mute">
        <label label={volume} />
      </button>
      <button onClicked={raise} tooltipText="Subir volumen">
        <label label="+" />
      </button>
    </box>
  )
}
