import app from "ags/gtk4/app"
import { Astal, Gtk, Gdk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { createPoll } from "ags/time"

export default function Bar(gdkmonitor: Gdk.Monitor) {
  const { TOP, LEFT, RIGHT } = Astal.WindowAnchor

  // Clock: igual a tu formato
  const clock = createPoll("", 1000, () => execAsync(`date "+%H:%M  %d-%m-%Y"`).then(s => s.trim()))

  // Spotify title (solo título, acotado)
  //
  const spotifyTitle = createPoll(" ", 2000, async () => {
    try {
      const out = await execAsync(`playerctl -p spotify metadata --format '{{title}}' 2>/dev/null || echo ''`)
     return ` ${out.trim()}`
    } catch {
      return ""
    }
  })

  // CPU / RAM (simple y estable)
  const cpu = createPoll("CPU --%", 2000, async () => {
    try {
      // cpu % aprox por /proc/stat (lightweight)
      const out = await execAsync(`bash -lc 'awk "/^cpu /{u=$2+$4; t=$2+$4+$5; if (pu>0){printf \\"CPU %d%%\\", (u-pu)*100/(t-pt)} pu=u; pt=t}" /proc/stat'`)
      return out.trim() || "CPU --%"
    } catch {
      return "CPU --%"
    }
  })

  const ram = createPoll("RAM --%", 2000, async () => {
    try {
      const out = await execAsync(`bash -lc 'free | awk "/Mem:/ {printf \\"RAM %d%%\\", $3*100/$2}"'`)
      return out.trim()
    } catch {
      return "RAM --%"
    }
  })

  // Network: muestra NET xx% si hay wifi, si no ETH, si no vacío
  const net = createPoll("", 2000, async () => {
    try {
      // WiFi signal (si existe) via iw
      const wifi = await execAsync(`bash -lc 'iw dev 2>/dev/null | awk "/Interface/ {print $2; exit}"'`).catch(() => "")
      const iface = (wifi || "").trim()
      if (iface) {
        const sig = await execAsync(`bash -lc 'iw dev ${iface} link 2>/dev/null | awk "/signal/ {print $2}"'`).catch(() => "")
        const s = sig.trim()
        if (s) return `NET ${s}dBm`
        return "NET"
      }
      // Ethernet up?
      const eth = await execAsync(`bash -lc 'ip -o link show up | awk -F": " "{print $2}" | grep -E "^(en|eth)" -m1 || true'`).catch(() => "")
      if ((eth || "").trim()) return "ETH"
      return ""
    } catch {
      return ""
    }
  })

  // Volume: pactl (PipeWire/PulseAudio)
  const vol = createPoll("VOL --%", 1500, async () => {
    try {
      const out = await execAsync(`bash -lc "pactl get-sink-volume @DEFAULT_SINK@ | head -n1 | awk '{print \\$5}'"`)
      return `VOL ${(out || "").trim()}`
    } catch {
      return "VOL --%"
    }
  })

  const toggleSpotifyPopup = () => execAsync("ags toggle spotify").catch(() => {})

  return (
    <window
      visible
      name="bar"
      class="Bar"
      gdkmonitor={gdkmonitor}
      
      exclusivity={Astal.Exclusivity.NORMAL}
      anchor={TOP | LEFT | RIGHT}
      application={app}
    >
      <centerbox cssName="centerbox">
        {/* LEFT: (por ahora placeholder) */}
        <box $type="start" spacing={10} hexpand halign={Gtk.Align.START}>
          <label label="WS" />
        </box>

        {/* CENTER: window title placeholder */}
        <box $type="center" hexpand halign={Gtk.Align.CENTER}>
          <label label=" " />
        </box>

        {/* RIGHT: spotify + cpu + ram + net + vol + clock */}
        <box $type="end" spacing={12} hexpand halign={Gtk.Align.END}>
        <button
          onClicked={toggleSpotifyPopup}
          class={spotifyState.playing ? "spotify-active" : ""}
          >
          <label label={` ${spotifyState.title}`} />
          </button>
          <label label={ram} />
          <label label={net} />
          <label label={vol} />
          <menubutton>
            <label label={clock} />
            <popover>
              <Gtk.Calendar />
            </popover>
          </menubutton>
        </box>
      </centerbox>
    </window>
  )
}

