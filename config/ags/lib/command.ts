import { execAsync } from "ags/process"

export type RunCommandOptions = {
  timeoutMs?: number
  allowFailure?: boolean
  dedupeKey?: string
}

const DEFAULT_TIMEOUT_MS = 4000
const inFlightByKey = new Map<string, Promise<string>>()

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function normalizeTimeoutMs(timeoutMs: number): number {
  if (!Number.isFinite(timeoutMs)) return DEFAULT_TIMEOUT_MS
  return Math.max(0, Math.floor(timeoutMs))
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim())
    return error.message.trim()
  if (typeof error === "string" && error.trim()) return error.trim()
  return "Command failed"
}

function timeoutSeconds(timeoutMs: number): string {
  const seconds = Math.max(0.1, timeoutMs / 1000)
  return seconds.toFixed(3).replace(/\.?0+$/, "")
}

async function executeCommand(
  command: string,
  options: RunCommandOptions,
): Promise<string> {
  const trimmed = command.trim()
  if (!trimmed) throw new Error("Empty command")

  const timeoutMs = normalizeTimeoutMs(options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  const allowFailure = options.allowFailure === true

  const script =
    timeoutMs > 0
      ? `if command -v timeout >/dev/null 2>&1; then timeout ${timeoutSeconds(timeoutMs)}s bash -lc ${shellQuote(trimmed)}; else bash -lc ${shellQuote(trimmed)}; fi`
      : `bash -lc ${shellQuote(trimmed)}`

  try {
    return await execAsync(`bash -lc ${shellQuote(script)}`)
  } catch (error) {
    if (allowFailure) return ""
    const message = normalizeErrorMessage(error)
    throw new Error(message)
  }
}

export async function runCommand(
  command: string,
  options: RunCommandOptions = {},
): Promise<string> {
  const key = (options.dedupeKey ?? "").trim()
  if (!key) {
    return executeCommand(command, options)
  }

  const existing = inFlightByKey.get(key)
  if (existing) return existing

  let pending: Promise<string>
  pending = executeCommand(command, options).finally(() => {
    if (inFlightByKey.get(key) === pending) {
      inFlightByKey.delete(key)
    }
  })

  inFlightByKey.set(key, pending)
  return pending
}
