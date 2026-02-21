import { Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { createPoll } from "ags/time"
import VolumeControl from "./VolumeControl"

export default function SystemMetrics() {
  const cpu = createPoll("CPU --%", 2000, async () => {
    try {
      const out = await execAsync(`bash -lc '
read -r _ u1 n1 s1 i1 w1 irq1 sirq1 st1 _ < /proc/stat
 t1=$((u1+n1+s1+i1+w1+irq1+sirq1+st1))
 idle1=$((i1+w1))
 sleep 0.2
 read -r _ u2 n2 s2 i2 w2 irq2 sirq2 st2 _ < /proc/stat
 t2=$((u2+n2+s2+i2+w2+irq2+sirq2+st2))
 idle2=$((i2+w2))
 dt=$((t2-t1)); didle=$((idle2-idle1))
 if [ "$dt" -gt 0 ]; then printf "CPU %d%%" $(((100*(dt-didle))/dt)); else printf "CPU --%%"; fi
'`)
      return out.trim() || "CPU --%"
    } catch {
      return "CPU --%"
    }
  })

  const ram = createPoll("RAM --%", 2000, async () => {
    try {
      const out = await execAsync(`bash -lc '
awk "
  /^MemTotal:/ {t=\$2}
  /^MemAvailable:/ {a=\$2}
  END {
    if (t > 0) {
      used=t-a
      pct=int((used*100)/t)
      printf \"RAM %d%%\", pct
    } else {
      printf \"RAM --%%\"
    }
  }
" /proc/meminfo
'`)
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

  return (
    <box spacing={12} halign={Gtk.Align.END}>
      <label label={cpu} />
      <label label={ram} />
      <label label={net} />
      <VolumeControl />
    </box>
  )
}
