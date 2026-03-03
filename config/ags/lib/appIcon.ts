export const FALLBACK_APP_ICON = "application-x-executable-symbolic"
export const DESKTOP_APP_ICON = "user-desktop-symbolic"

const APP_ICON_ALIASES: Record<string, string[]> = {
  code: ["code", "visual-studio-code", "vscode"],
  "code-url-handler": ["code", "visual-studio-code", "vscode"],
  cursor: ["cursor", "code", "visual-studio-code"],
  firefox: ["firefox", "firefox-developer-edition"],
  chromium: ["chromium-browser", "chromium"],
  "google-chrome": ["google-chrome", "chrome"],
  brave: ["brave-browser", "brave"],
  kitty: ["kitty"],
  alacritty: ["Alacritty", "alacritty"],
  wezterm: ["org.wezfurlong.wezterm", "wezterm"],
  foot: ["foot"],
  obsidian: ["obsidian"],
  discord: ["discord"],
  spotify: ["spotify"],
  telegramdesktop: ["telegram-desktop", "telegramdesktop"],
  nautilus: ["org.gnome.Nautilus", "nautilus"],
  thunar: ["Thunar", "thunar"],
}

const iconCache = new Map<string, string>()

function hasIcon(theme: any, iconName: string): boolean {
  const clean = iconName.trim()
  if (!clean) return false
  if (typeof theme?.has_icon === "function") return theme.has_icon(clean)
  return true
}

export function normalizeAppKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/["']/g, "")
    .replace(/\s+/g, "-")
    .replace(/_/g, "-")
    .replace(/[^a-z0-9.-]/g, "")
}

function iconCandidates(appName: string): string[] {
  const normalized = normalizeAppKey(appName)
  if (!normalized) return []

  const aliasCandidates = APP_ICON_ALIASES[normalized] ?? []
  const directCandidates = [
    normalized,
    normalized.replace(/\./g, "-"),
    normalized.replace(/-/g, "."),
  ]

  return [...aliasCandidates, ...directCandidates]
}

export function resolveAppIcon(theme: any, appName: string): string {
  const cacheKey = normalizeAppKey(appName)
  if (!cacheKey) return DESKTOP_APP_ICON

  const cached = iconCache.get(cacheKey)
  if (cached) return cached

  for (const candidate of iconCandidates(appName)) {
    if (hasIcon(theme, candidate)) {
      iconCache.set(cacheKey, candidate)
      return candidate
    }
  }

  const fallback = cacheKey === "desktop" ? DESKTOP_APP_ICON : FALLBACK_APP_ICON
  iconCache.set(cacheKey, fallback)
  return fallback
}
