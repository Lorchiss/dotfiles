import { Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { createPoll } from "ags/time"

export default function SystemMetrics() {
  const cpu = createPoll("CPU --%", 2000, async () => {
    try {
      const out = await execAsync(`bash -lc 'awk "/^cpu /{u=$2+$4; t=$2+$4+$5; if (pu>0){printf \\\"CPU %d%%\\\", (u-pu)*100/(t-pt)} pu=u; pt=t}" /proc/stat'`)
      return out.trim() || "CPU --%"
    } catch {
      return "CPU --%"
    }
  })

  const ram = createPoll("RAM --%", 2000, async () => {
    try {
      const out = await execAsync(`bash -lc 'free | awk "/Mem:/ {printf \\\"RAM %d%%\\\", $3*100/$2}"'`)
      return out.trim() || "RAM --%"
    } catch {
      return "RAM --%"
    }
  })

  const net = createPoll("", 2000, async () => {
    try {
      const wifi = await execAsync(`bash -lc 'iw dev 2>/dev/null | awk "/Interface/ {print $2; exit}"'`).catch(() => "")
      const iface = wifi.trim()

      if (iface) {
        const sig = await execAsync(`bash -lc 'iw dev ${iface} link 2>/dev/null | awk "/signal/ {print $2}"'`).catch(() => "")
        const signal = sig.trim()
        if (signal) return `NET ${signal}dBm`
        return "NET"
      }

      const eth = await execAsync(`bash -lc 'ip -o link show up | awk -F": " "{print $2}" | grep -E "^(en|eth)" -m1 || true'`).catch(() => "")
      return eth.trim() ? "ETH" : ""
    } catch {
      return ""
    }
  })

  const vol = createPoll("VOL --%", 1500, async () => {
    try {
      const out = await execAsync(`bash -lc "pactl get-sink-volume @DEFAULT_SINK@ | head -n1 | awk '{print \\$5}'"`)
      return `VOL ${out.trim()}`
    } catch {
      return "VOL --%"
    }
  })

  return (
    <box spacing={12} halign={Gtk.Align.END}>
      <label label={cpu} />
      <label label={ram} />
      <label label={net} />
      <label label={vol} />
    </box>
  )
}
