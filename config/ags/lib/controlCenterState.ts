import { runCommand } from "./command"

export type PersistedControlCenterTab =
  | "wifi"
  | "bluetooth"
  | "audio"
  | "system"
  | "session"

const CONTROL_CENTER_STATE_PATH = "/tmp/ags-cc-state.json"

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function isControlCenterTab(
  value: unknown,
): value is PersistedControlCenterTab {
  return (
    value === "wifi" ||
    value === "bluetooth" ||
    value === "audio" ||
    value === "system" ||
    value === "session"
  )
}

export async function readLastControlCenterTab(): Promise<PersistedControlCenterTab | null> {
  const raw = await runCommand(
    `[ -f ${shellQuote(CONTROL_CENTER_STATE_PATH)} ] && cat ${shellQuote(CONTROL_CENTER_STATE_PATH)} || true`,
    { timeoutMs: 1200, allowFailure: true },
  )

  const trimmed = raw.trim()
  if (!trimmed) return null

  try {
    const parsed = JSON.parse(trimmed) as { activeTab?: unknown }
    if (isControlCenterTab(parsed.activeTab)) return parsed.activeTab
  } catch {}

  return null
}

export async function writeLastControlCenterTab(
  tab: PersistedControlCenterTab,
): Promise<void> {
  const payload = JSON.stringify({ activeTab: tab })
  await runCommand(
    `printf %s ${shellQuote(payload)} > ${shellQuote(CONTROL_CENTER_STATE_PATH)}`,
    {
      timeoutMs: 1200,
      allowFailure: true,
      dedupeKey: "control-center-tab-write",
    },
  )
}
