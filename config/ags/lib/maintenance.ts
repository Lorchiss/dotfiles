import { runCommand } from "./command"
import { openInTerminal } from "./terminal"

export type UpdatesBreakdown = {
  official: number | null
  aur: number | null
  total: number | null
  aurEnabled: boolean
}

export type ArchNewsState = {
  unreadCount: number
  latestTitle: string
  latestLink: string
  latestPublishedAt: string
}

export type SnapperAvailability = {
  snapperAvailable: boolean
  reason: string
}

type ReadOptions = {
  forceRefresh?: boolean
}

type UpdatesCacheRecord = UpdatesBreakdown & {
  fetchedAt: number
}

type ArchNewsCacheRecord = {
  latestTitle: string
  latestLink: string
  latestPublishedAt: string
  fetchedAt: number
}

type ArchNewsSeenRecord = {
  lastSeenPublishedAt: string
}

const UPDATES_CACHE_PATH = "/tmp/ags-updates-cache-v2.json"
const UPDATES_LOCK_PATH = "/tmp/ags-updates-cache-v2.lock"
const UPDATES_CACHE_TTL_MS = 15 * 60 * 1000

const ARCH_NEWS_CACHE_PATH = "/tmp/ags-arch-news-cache.json"
const ARCH_NEWS_CACHE_TTL_MS = 30 * 60 * 1000

const SYSTEM_UPDATE_SCRIPT = `${SRC}/scripts/system_update.sh`
const SNAPSHOT_ROLLBACK_SCRIPT = `${SRC}/scripts/snapper_rollback.sh`

let updatesCache: UpdatesCacheRecord | null = null
let archNewsCache: ArchNewsCacheRecord | null = null

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function parseIntSafe(raw: string): number | null {
  const parsed = Number.parseInt(raw.trim(), 10)
  if (!Number.isFinite(parsed)) return null
  return Math.max(0, Math.floor(parsed))
}

function isCacheFresh(
  fetchedAt: number,
  ttlMs: number,
  now = Date.now(),
): boolean {
  if (!Number.isFinite(fetchedAt) || fetchedAt <= 0) return false
  return now - fetchedAt < ttlMs
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>
    }
  } catch {}

  const lastLine = trimmed
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .pop()
  if (!lastLine) return null

  try {
    const parsed = JSON.parse(lastLine)
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>
    }
  } catch {}

  return null
}

function parseUpdatesCache(raw: string): UpdatesCacheRecord | null {
  const parsed = parseJsonObject(raw)
  if (!parsed) return null

  const fetchedAt =
    typeof parsed.fetchedAt === "number" ? Math.floor(parsed.fetchedAt) : NaN
  if (!Number.isFinite(fetchedAt) || fetchedAt <= 0) return null

  const official =
    typeof parsed.official === "number"
      ? Math.max(0, Math.floor(parsed.official))
      : parsed.official === null
        ? null
        : null

  const aur =
    typeof parsed.aur === "number"
      ? Math.max(0, Math.floor(parsed.aur))
      : parsed.aur === null
        ? null
        : null

  const total =
    typeof parsed.total === "number"
      ? Math.max(0, Math.floor(parsed.total))
      : parsed.total === null
        ? null
        : null

  const aurEnabled = parsed.aurEnabled === true

  return {
    official,
    aur,
    total,
    aurEnabled,
    fetchedAt,
  }
}

function parseArchNewsCache(raw: string): ArchNewsCacheRecord | null {
  const parsed = parseJsonObject(raw)
  if (!parsed) return null

  const fetchedAt =
    typeof parsed.fetchedAt === "number" ? Math.floor(parsed.fetchedAt) : NaN
  if (!Number.isFinite(fetchedAt) || fetchedAt <= 0) return null

  const latestTitle =
    typeof parsed.latestTitle === "string" ? parsed.latestTitle.trim() : ""
  const latestLink =
    typeof parsed.latestLink === "string" ? parsed.latestLink.trim() : ""
  const latestPublishedAt =
    typeof parsed.latestPublishedAt === "string"
      ? parsed.latestPublishedAt.trim()
      : ""

  return {
    latestTitle,
    latestLink,
    latestPublishedAt,
    fetchedAt,
  }
}

async function readUpdatesCacheFromDisk(): Promise<UpdatesCacheRecord | null> {
  const raw = await runCommand(
    `[ -f ${shellQuote(UPDATES_CACHE_PATH)} ] && cat ${shellQuote(UPDATES_CACHE_PATH)} || true`,
    { timeoutMs: 1200, allowFailure: true },
  )
  return parseUpdatesCache(raw)
}

async function writeUpdatesCacheToDisk(
  cache: UpdatesCacheRecord,
): Promise<void> {
  await runCommand(
    `printf %s ${shellQuote(JSON.stringify(cache))} > ${shellQuote(UPDATES_CACHE_PATH)}`,
    {
      timeoutMs: 1200,
      allowFailure: true,
      dedupeKey: "maintenance-updates-cache-write",
    },
  )
}

async function readLatestKnownUpdates(): Promise<UpdatesCacheRecord | null> {
  if (updatesCache) return updatesCache

  const diskCache = await readUpdatesCacheFromDisk()
  if (diskCache) updatesCache = diskCache
  return updatesCache
}

async function queryUpdatesBreakdown(): Promise<UpdatesBreakdown | null> {
  const raw = await runCommand(
    `
lock=${shellQuote(UPDATES_LOCK_PATH)}
attempts=0
while ! mkdir "$lock" 2>/dev/null; do
  attempts=$((attempts + 1))
  if [ "$attempts" -ge 40 ]; then
    exit 0
  fi
  sleep 0.25
done
trap 'rmdir "$lock" >/dev/null 2>&1 || true' EXIT

official=0
if command -v checkupdates >/dev/null 2>&1; then
  official=$(checkupdates 2>/dev/null | wc -l)
else
  official=$(pacman -Qu 2>/dev/null | wc -l)
fi

aur=__NA__
if command -v paru >/dev/null 2>&1; then
  aur=$(paru -Qua 2>/dev/null | wc -l)
fi

printf '%s\\n%s\\n' "$official" "$aur"
`,
    {
      timeoutMs: 90_000,
      allowFailure: true,
      dedupeKey: "maintenance-updates-refresh",
    },
  )

  const lines = raw.replace(/\r/g, "").split("\n")
  const officialRaw = (lines[0] ?? "").trim()
  const aurRaw = (lines[1] ?? "__NA__").trim()

  const official = parseIntSafe(officialRaw)
  const aurEnabled = aurRaw !== "__NA__"
  const aur = aurEnabled ? parseIntSafe(aurRaw) : null

  if (official === null && (!aurEnabled || aur === null)) {
    return null
  }

  const total =
    official === null
      ? null
      : aurEnabled
        ? aur === null
          ? official
          : official + aur
        : official

  return {
    official,
    aur,
    total,
    aurEnabled,
  }
}

export async function readUpdatesBreakdown(
  options: ReadOptions = {},
): Promise<UpdatesBreakdown> {
  const forceRefresh = options.forceRefresh === true

  if (!forceRefresh) {
    if (
      updatesCache &&
      isCacheFresh(updatesCache.fetchedAt, UPDATES_CACHE_TTL_MS)
    ) {
      const { fetchedAt: _fetchedAt, ...snapshot } = updatesCache
      return snapshot
    }

    const diskCache = await readUpdatesCacheFromDisk()
    if (diskCache && isCacheFresh(diskCache.fetchedAt, UPDATES_CACHE_TTL_MS)) {
      updatesCache = diskCache
      const { fetchedAt: _fetchedAt, ...snapshot } = diskCache
      return snapshot
    }
  }

  const queried = await queryUpdatesBreakdown()
  if (queried) {
    const nextCache: UpdatesCacheRecord = {
      ...queried,
      fetchedAt: Date.now(),
    }
    updatesCache = nextCache
    await writeUpdatesCacheToDisk(nextCache)
    return queried
  }

  const fallback = await readLatestKnownUpdates()
  if (fallback) {
    const { fetchedAt: _fetchedAt, ...snapshot } = fallback
    return snapshot
  }

  return {
    official: null,
    aur: null,
    total: null,
    aurEnabled: false,
  }
}

export async function refreshUpdatesBreakdown(): Promise<UpdatesBreakdown> {
  return readUpdatesBreakdown({ forceRefresh: true })
}

async function readArchNewsCacheFromDisk(): Promise<ArchNewsCacheRecord | null> {
  const raw = await runCommand(
    `[ -f ${shellQuote(ARCH_NEWS_CACHE_PATH)} ] && cat ${shellQuote(ARCH_NEWS_CACHE_PATH)} || true`,
    { timeoutMs: 1200, allowFailure: true },
  )
  return parseArchNewsCache(raw)
}

async function writeArchNewsCacheToDisk(
  cache: ArchNewsCacheRecord,
): Promise<void> {
  await runCommand(
    `printf %s ${shellQuote(JSON.stringify(cache))} > ${shellQuote(ARCH_NEWS_CACHE_PATH)}`,
    {
      timeoutMs: 1200,
      allowFailure: true,
      dedupeKey: "arch-news-cache-write",
    },
  )
}

async function readArchNewsSeenRecord(): Promise<ArchNewsSeenRecord | null> {
  const raw = await runCommand(
    `seen_path="$HOME/.cache/ags/arch-news-seen.json"; [ -f "$seen_path" ] && cat "$seen_path" || true`,
    { timeoutMs: 1200, allowFailure: true },
  )

  const parsed = parseJsonObject(raw)
  if (!parsed) return null

  const lastSeenPublishedAt =
    typeof parsed.lastSeenPublishedAt === "string"
      ? parsed.lastSeenPublishedAt.trim()
      : ""

  if (!lastSeenPublishedAt) return null
  return { lastSeenPublishedAt }
}

function archNewsUnreadCount(
  latestPublishedAt: string,
  seenPublishedAt: string,
): number {
  if (!latestPublishedAt.trim()) return 0
  if (!seenPublishedAt.trim()) return 1

  const latestMs = Date.parse(latestPublishedAt)
  const seenMs = Date.parse(seenPublishedAt)

  if (Number.isFinite(latestMs) && Number.isFinite(seenMs)) {
    return latestMs > seenMs ? 1 : 0
  }

  return latestPublishedAt.trim() === seenPublishedAt.trim() ? 0 : 1
}

async function fetchLatestArchNews(): Promise<ArchNewsCacheRecord | null> {
  const raw = await runCommand(
    `
curl -fsSL --max-time 15 https://archlinux.org/feeds/news/ | python3 - <<'PY'
import json
import sys
import xml.etree.ElementTree as ET

payload = sys.stdin.read()
if not payload.strip():
    print("{}")
    raise SystemExit(0)

try:
    root = ET.fromstring(payload)
except Exception:
    print("{}")
    raise SystemExit(0)

channel = root.find("channel")
item = channel.find("item") if channel is not None else None

def text_of(tag: str) -> str:
    if item is None:
        return ""
    node = item.find(tag)
    if node is None or node.text is None:
        return ""
    return node.text.strip()

print(json.dumps({
    "latestTitle": text_of("title"),
    "latestLink": text_of("link"),
    "latestPublishedAt": text_of("pubDate"),
}, ensure_ascii=False))
PY
`,
    {
      timeoutMs: 22_000,
      allowFailure: true,
      dedupeKey: "arch-news-refresh",
    },
  )

  const parsed = parseJsonObject(raw)
  if (!parsed) return null

  const latestTitle =
    typeof parsed.latestTitle === "string" ? parsed.latestTitle.trim() : ""
  const latestLink =
    typeof parsed.latestLink === "string" ? parsed.latestLink.trim() : ""
  const latestPublishedAt =
    typeof parsed.latestPublishedAt === "string"
      ? parsed.latestPublishedAt.trim()
      : ""

  if (!latestTitle && !latestLink && !latestPublishedAt) return null

  return {
    latestTitle,
    latestLink,
    latestPublishedAt,
    fetchedAt: Date.now(),
  }
}

function mapArchNewsState(
  cache: ArchNewsCacheRecord | null,
  seenPublishedAt: string,
): ArchNewsState {
  const latestTitle = cache?.latestTitle ?? ""
  const latestLink = cache?.latestLink ?? ""
  const latestPublishedAt = cache?.latestPublishedAt ?? ""

  return {
    unreadCount: archNewsUnreadCount(latestPublishedAt, seenPublishedAt),
    latestTitle,
    latestLink,
    latestPublishedAt,
  }
}

export async function readArchNewsState(
  options: ReadOptions = {},
): Promise<ArchNewsState> {
  const forceRefresh = options.forceRefresh === true

  const seen = await readArchNewsSeenRecord()
  const seenPublishedAt = seen?.lastSeenPublishedAt ?? ""

  if (!forceRefresh) {
    if (
      archNewsCache &&
      isCacheFresh(archNewsCache.fetchedAt, ARCH_NEWS_CACHE_TTL_MS)
    ) {
      return mapArchNewsState(archNewsCache, seenPublishedAt)
    }

    const diskCache = await readArchNewsCacheFromDisk()
    if (
      diskCache &&
      isCacheFresh(diskCache.fetchedAt, ARCH_NEWS_CACHE_TTL_MS)
    ) {
      archNewsCache = diskCache
      return mapArchNewsState(diskCache, seenPublishedAt)
    }
  }

  const freshCache = await fetchLatestArchNews()
  if (freshCache) {
    archNewsCache = freshCache
    await writeArchNewsCacheToDisk(freshCache)
    return mapArchNewsState(freshCache, seenPublishedAt)
  }

  if (archNewsCache) {
    return mapArchNewsState(archNewsCache, seenPublishedAt)
  }

  const diskCache = await readArchNewsCacheFromDisk()
  if (diskCache) {
    archNewsCache = diskCache
    return mapArchNewsState(diskCache, seenPublishedAt)
  }

  return {
    unreadCount: 0,
    latestTitle: "",
    latestLink: "",
    latestPublishedAt: "",
  }
}

export async function markArchNewsAsRead(publishedAt: string): Promise<void> {
  const cleanPublishedAt = publishedAt.trim()
  if (!cleanPublishedAt) return

  const payload = JSON.stringify({
    lastSeenPublishedAt: cleanPublishedAt,
    updatedAt: Date.now(),
  })

  await runCommand(
    `seen_dir="$HOME/.cache/ags"; seen_path="$seen_dir/arch-news-seen.json"; mkdir -p "$seen_dir"; printf %s ${shellQuote(payload)} > "$seen_path"`,
    {
      timeoutMs: 1600,
      allowFailure: true,
      dedupeKey: "arch-news-seen-write",
    },
  )
}

export async function openLatestArchNews(): Promise<void> {
  const news = await readArchNewsState()
  const link = news.latestLink.trim()
  if (!link) throw new Error("No hay enlace de Arch News disponible")

  await runCommand(`xdg-open ${shellQuote(link)} >/dev/null 2>&1 &`, {
    timeoutMs: 2200,
  })
}

export async function readSnapperAvailability(): Promise<SnapperAvailability> {
  const raw = await runCommand(
    `
if ! command -v snapper >/dev/null 2>&1; then
  echo "missing"
elif snapper list-configs 2>/dev/null | awk '{print $1}' | grep -qx root; then
  echo "ok"
else
  echo "missing_root"
fi
`,
    {
      timeoutMs: 3500,
      allowFailure: true,
      dedupeKey: "snapper-availability",
    },
  )

  const status = raw.trim()
  if (status === "ok") {
    return {
      snapperAvailable: true,
      reason: "Snapper disponible (config root)",
    }
  }

  if (status === "missing_root") {
    return {
      snapperAvailable: false,
      reason: "Snapper sin configuración root",
    }
  }

  return {
    snapperAvailable: false,
    reason: "snapper no instalado",
  }
}

async function openScriptInTerminal(
  primaryPath: string,
  fallbackScriptName: string,
  label: string,
): Promise<void> {
  await openInTerminal(
    `
script_path=${shellQuote(primaryPath)}
if [ ! -f "$script_path" ]; then
  script_path="$HOME/.config/ags/scripts/${fallbackScriptName}"
fi

if [ ! -f "$script_path" ]; then
  echo ${shellQuote(`${label}: script no encontrado`)}
  echo "$script_path"
  echo
  read -r -p "Enter para cerrar" _
  exit 1
fi

if [ ! -x "$script_path" ]; then
  chmod +x "$script_path" >/dev/null 2>&1 || true
fi

exec bash "$script_path"
`,
  )
}

export async function openSystemUpdateTerminal(): Promise<void> {
  await openScriptInTerminal(
    SYSTEM_UPDATE_SCRIPT,
    "system_update.sh",
    "Mantenimiento",
  )
}

export async function openSnapperRollbackTerminal(): Promise<void> {
  await openScriptInTerminal(
    SNAPSHOT_ROLLBACK_SCRIPT,
    "snapper_rollback.sh",
    "Rollback",
  )
}
