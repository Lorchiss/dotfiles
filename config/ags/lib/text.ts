import { DEBUG_BAR, barLog } from "./barObservability"

const FORBIDDEN_TECH_PATTERNS = [
  /\[object/i,
  /instance\s+wrapper/i,
  /gtk\./i,
  /gobject/i,
  /native@/i,
  /accessor/i,
  /\bundefined\b/i,
  /\bnull\b/i,
]

function normalize(value: string | number): string {
  return String(value).replace(/\s+/g, " ").trim()
}

function normalizePrimitive(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number") {
    return normalize(value)
  }
  return null
}

function hasForbiddenTechText(value: string): boolean {
  return FORBIDDEN_TECH_PATTERNS.some((pattern) => pattern.test(value))
}

function debugSanitizerWarning(
  moduleName: string,
  fieldName: string,
  reason: string,
  value: unknown,
  fallback: string,
) {
  if (!DEBUG_BAR) return
  const rawPreview = safeTextRaw(value)
  barLog(
    moduleName,
    `WARN safeText blocked field=${fieldName} reason=${reason} raw=${rawPreview} fallback=${fallback}`,
  )
}

function safeTextRaw(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return normalize(value).slice(0, 120)
  }
  if (value === null) return "null"
  if (value === undefined) return "undefined"
  return Object.prototype.toString.call(value)
}

export function safeText(
  value: unknown,
  fallback: unknown = "",
  moduleName = "TEXT",
  fieldName = "value",
): string {
  const fallbackCandidate = normalizePrimitive(fallback)
  const fallbackText =
    typeof fallbackCandidate === "string" &&
    fallbackCandidate.length > 0 &&
    !hasForbiddenTechText(fallbackCandidate)
      ? fallbackCandidate
      : ""

  if (value === null || value === undefined) {
    debugSanitizerWarning(
      moduleName,
      fieldName,
      "nullish",
      value,
      fallbackText || "<empty>",
    )
    return fallbackText
  }
  if (typeof value !== "string" && typeof value !== "number") {
    debugSanitizerWarning(
      moduleName,
      fieldName,
      "non-string-number",
      value,
      fallbackText || "<empty>",
    )
    return fallbackText
  }

  const text = normalizePrimitive(value) ?? ""
  if (!text) {
    return fallbackText
  }
  if (hasForbiddenTechText(text)) {
    debugSanitizerWarning(
      moduleName,
      fieldName,
      "forbidden-pattern",
      value,
      fallbackText || "<empty>",
    )
    return fallbackText
  }

  return text
}
