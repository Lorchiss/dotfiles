import { Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { createPoll } from "ags/time"

const volumeStep = 5

export default function VolumeControl() {
  const volumePercent = createPoll("--%", 1200, async () => {
    try {
      const out = await execAsync(
        `bash -lc "pactl get-sink-volume @DEFAULT_SINK@ | head -n1 | awk '{print \\$5}'"`,
      )
      return out.trim() || "--%"
    } catch {
      return "--%"
    }
  })

  const isMuted = createPoll(false, 1200, async () => {
    try {
      const out = await execAsync(
        `bash -lc "pactl get-sink-mute @DEFAULT_SINK@ | awk '{print \\$2}'"`,
      )
      return out.trim() === "yes"
    } catch {
      return false
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
    <menubutton class="vol-control">
      <label
        label={isMuted((m) => `${m ? "🔇" : "🔊"} ${volumePercent((v) => v)}`)}
      />
      <popover>
        <box
          orientation={Gtk.Orientation.VERTICAL}
          spacing={8}
          cssName="volPopover"
        >
          <label label="Volumen" cssName="volPopoverTitle" xalign={0} />
          <box spacing={8}>
            <button onClicked={lower} tooltipText="Bajar volumen">
              <label label="−" />
            </button>
            <button onClicked={toggleMute} tooltipText="Mute">
              <label label={isMuted((m) => (m ? "Unmute" : "Mute"))} />
            </button>
            <button onClicked={raise} tooltipText="Subir volumen">
              <label label="+" />
            </button>
          </box>
        </box>
      </popover>
    </menubutton>
  )
}
