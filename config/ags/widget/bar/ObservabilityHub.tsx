import { Gtk } from "ags/gtk4"
import { execAsync } from "ags/process"
import { createPoll } from "ags/time"
import { readSystemState } from "../../lib/system"
import { createMusicAccentClassState } from "../../lib/musicAccent"

type ObservabilityState = {
  cpu: number | null
  ram: number | null
  temp: number | null
  updates: number | null
  aur: number | null
  news: number
  profile: string
  statusClass: "obs-ok" | "obs-warn"
}

const OBS_POLL_MS = 3600

function parseIntSafe(value: string): number | null {
  const numeric = Number.parseInt(value.trim(), 10)
  if (!Number.isFinite(numeric)) return null
  return numeric
}

async function readCpuAndRam() {
  try {
    const raw = await execAsync(`bash -lc '
read -r _ u1 n1 s1 i1 w1 irq1 sirq1 st1 _ < /proc/stat
 t1=$((u1+n1+s1+i1+w1+irq1+sirq1+st1))
 idle1=$((i1+w1))
 sleep 0.12
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
    return {
      cpu: null,
      ram: null,
    }
  }
}

function profileLabel(powerProfile: string): string {
  if (powerProfile === "power-saver") return "ECO"
  if (powerProfile === "balanced") return "WORK"
  if (powerProfile === "performance") return "BOOST"
  return "--"
}

export default function ObservabilityHub() {
  const accentClass = createMusicAccentClassState()

  const state = createPoll<ObservabilityState>(
    {
      cpu: null,
      ram: null,
      temp: null,
      updates: null,
      aur: null,
      news: 0,
      profile: "--",
      statusClass: "obs-ok",
    },
    OBS_POLL_MS,
    async (prev) => {
      try {
        const [system, compute] = await Promise.all([
          readSystemState(),
          readCpuAndRam(),
        ])

        const hasWarning =
          system.archNewsUnreadCount > 0 ||
          (system.updatesCount !== null && system.updatesCount > 0)

        return {
          cpu: compute.cpu,
          ram: compute.ram,
          temp: system.maxTemperatureC,
          updates: system.updatesCount,
          aur: system.updatesAurCount,
          news: system.archNewsUnreadCount,
          profile: profileLabel(system.powerProfile),
          statusClass: hasWarning ? "obs-warn" : "obs-ok",
        }
      } catch {
        return prev
      }
    },
  )

  return (
    <menubutton class={state((s) => `observability-chip ${s.statusClass}`)}>
      <box spacing={7}>
        <label label="OBS" />
        <label
          class="observability-inline"
          label={state(
            (s) =>
              `C${s.cpu ?? "--"} R${s.ram ?? "--"} T${s.temp !== null ? s.temp.toFixed(0) : "--"}`,
          )}
        />
        <label
          class="observability-badge"
          label={state((s) =>
            s.news > 0 ? `N${Math.min(9, s.news)}+` : `U${s.updates ?? "--"}`,
          )}
        />
      </box>

      <popover class="obs-popover-shell" hasArrow={false}>
        <box
          orientation={Gtk.Orientation.VERTICAL}
          spacing={8}
          class={accentClass(
            (accent) => `obs-popover-card popup-accent-surface ${accent}`,
          )}
        >
          <label
            class="obs-popover-heading"
            label="Observabilidad"
            xalign={0}
          />

          <box class="obs-popover-row" spacing={8}>
            <label class="obs-popover-key" label="Compute" xalign={0} hexpand />
            <label
              class="obs-popover-value"
              label={state(
                (s) => `CPU ${s.cpu ?? "--"}% · RAM ${s.ram ?? "--"}%`,
              )}
            />
          </box>

          <box class="obs-popover-row" spacing={8}>
            <label class="obs-popover-key" label="Thermal" xalign={0} hexpand />
            <label
              class="obs-popover-value"
              label={state(
                (s) => `TEMP ${s.temp !== null ? s.temp.toFixed(1) : "--"}°C`,
              )}
            />
          </box>

          <box class="obs-popover-row" spacing={8}>
            <label class="obs-popover-key" label="Updates" xalign={0} hexpand />
            <label
              class="obs-popover-value"
              label={state(
                (s) => `Total ${s.updates ?? "--"} · AUR ${s.aur ?? "--"}`,
              )}
            />
          </box>

          <box class="obs-popover-row" spacing={8}>
            <label
              class="obs-popover-key"
              label="Arch News"
              xalign={0}
              hexpand
            />
            <label
              class="obs-popover-value"
              label={state((s) => `${s.news} unread`)}
            />
          </box>

          <box class="obs-popover-row" spacing={8}>
            <label class="obs-popover-key" label="Mode" xalign={0} hexpand />
            <label class="obs-popover-value" label={state((s) => s.profile)} />
          </box>
        </box>
      </popover>
    </menubutton>
  )
}
