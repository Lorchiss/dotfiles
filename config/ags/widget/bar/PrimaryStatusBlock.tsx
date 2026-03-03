import { Gtk } from "ags/gtk4"
import { BAR_PRIMARY_STATUS_V2, barLog } from "../../lib/barObservability"
import PrimaryStatusBlockV2 from "./PrimaryStatusBlockV2"

type PrimaryStatusBlockProps = {
  spotifyEnabled?: boolean
}

export default function PrimaryStatusBlock({
  spotifyEnabled = true,
}: PrimaryStatusBlockProps) {
  if (BAR_PRIMARY_STATUS_V2) {
    return <PrimaryStatusBlockV2 spotifyEnabled={spotifyEnabled} />
  }

  barLog("PRIMARY_STATUS_V2", "disabled by BAR_PRIMARY_STATUS_V2=0")
  return (
    <box class="primary-status-block-v2" spacing={0} valign={Gtk.Align.CENTER}>
      <button
        class="spotify-chip"
        tooltipText="Primary status v2 desactivado"
        sensitive={false}
      >
        <box class="spotify-chip-content" spacing={6}>
          <label class="spotify-chip-icon" label="—" />
          <label
            class="spotify-chip-title"
            label="—"
            widthChars={16}
            maxWidthChars={16}
            singleLineMode
            xalign={0}
          />
        </box>
      </button>
    </box>
  )
}
