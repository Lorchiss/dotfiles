import { Gtk } from "ags/gtk4"
import VolumeControl from "./VolumeControl"
import NetworkChip from "./NetworkChip"
import { BAR_UI } from "../../lib/uiTokens"

type QuickStatusBoxProps = {
  audioEnabled: boolean
  connectivityEnabled: boolean
}

export default function QuickStatusBox({
  audioEnabled,
  connectivityEnabled,
}: QuickStatusBoxProps) {
  if (!audioEnabled && !connectivityEnabled) return null

  return (
    <box
      class="quick-status-box"
      spacing={BAR_UI.spacing.tight}
      valign={Gtk.Align.CENTER}
    >
      {audioEnabled ? <VolumeControl compact /> : null}
      {connectivityEnabled ? <NetworkChip compact /> : null}
    </box>
  )
}
