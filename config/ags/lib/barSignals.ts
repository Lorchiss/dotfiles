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
 read -r memTotal memAvail <<< "$(grep -E "^(MemTotal|MemAvailable):" /proc/meminfo | awk "{print \$2}")"
 ram=0
 if [ -n "$memTotal" ] && [ "$memTotal" -gt 0 ] && [ -n "$memAvail" ]; then
   ram=$(((100*(memTotal-memAvail))/memTotal))
 fi
 printf "%s\n%s" "$cpu" "$ram"
'`)

      const [cpuRaw = "", ramRaw = ""] = raw.split("\n")
      return {
        cpu: parseIntSafe(cpuRaw),
        ram: parseIntSafe(ramRaw),
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
