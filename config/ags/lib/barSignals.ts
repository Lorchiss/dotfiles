import { execAsync } from "ags/process"
import { createPoll } from "ags/time"
import {
  createEmptySystemState,
  readSystemState,
  type SystemState,
} from "./system"

export type BarComputeState = {
  cpu: number | null
  ram: number | null
  gpu: number | null
}

const BAR_SYSTEM_POLL_MS = 5200
const BAR_COMPUTE_POLL_MS = 4200

function parseIntSafe(value: string): number | null {
  const numeric = Number.parseInt(value.trim(), 10)
  if (!Number.isFinite(numeric)) return null
  return numeric
}

const barSystemState = createPoll<SystemState>(
  createEmptySystemState(),
  BAR_SYSTEM_POLL_MS,
  async () => readSystemState(),
)

const barComputeState = createPoll<BarComputeState>(
  {
    cpu: null,
    ram: null,
    gpu: null,
  },
  BAR_COMPUTE_POLL_MS,
  async (prev) => {
    try {
      const raw = await execAsync(`bash -lc '
read -r _ u1 n1 s1 i1 w1 irq1 sirq1 st1 _ < /proc/stat
 t1=$((u1+n1+s1+i1+w1+irq1+sirq1+st1))
 idle1=$((i1+w1))
 sleep 0.1
 read -r _ u2 n2 s2 i2 w2 irq2 sirq2 st2 _ < /proc/stat
 t2=$((u2+n2+s2+i2+w2+irq2+sirq2+st2))
 idle2=$((i2+w2))
 dt=$((t2-t1)); didle=$((idle2-idle1))
 cpu=0
 if [ "$dt" -gt 0 ]; then cpu=$(((100*(dt-didle))/dt)); fi
 memTotal=$(grep -m1 "^MemTotal:" /proc/meminfo | tr -s " " | cut -d" " -f2)
 memAvail=$(grep -m1 "^MemAvailable:" /proc/meminfo | tr -s " " | cut -d" " -f2)
 ram=0
 if [ -n "$memTotal" ] && [ "$memTotal" -gt 0 ] && [ -n "$memAvail" ]; then
   ram=$(((100*(memTotal-memAvail))/memTotal))
 fi
 gpu=""
 if command -v nvidia-smi >/dev/null 2>&1; then
   gpu=$(nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>/dev/null | head -n1)
 elif [ -r /sys/class/drm/card0/device/gpu_busy_percent ]; then
   gpu=$(cat /sys/class/drm/card0/device/gpu_busy_percent 2>/dev/null)
 elif [ -r /sys/class/drm/card1/device/gpu_busy_percent ]; then
   gpu=$(cat /sys/class/drm/card1/device/gpu_busy_percent 2>/dev/null)
 fi
 printf "%s\n%s\n%s" "$cpu" "$ram" "$gpu"
'`)

      const [cpuRaw = "", ramRaw = "", gpuRaw = ""] = raw.split("\n")
      return {
        cpu: parseIntSafe(cpuRaw),
        ram: parseIntSafe(ramRaw),
        gpu: parseIntSafe(gpuRaw),
      }
    } catch {
      return prev
    }
  },
)

export function barSystemStateBinding() {
  return barSystemState
}

export function barComputeStateBinding() {
  return barComputeState
}
