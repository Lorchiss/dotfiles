import { safeText } from "./text"

const CC_MESSAGE_BASE_CLASS = "cc-inline-message"
const CC_MESSAGE_ERROR_CLASS = "cc-inline-message-error"
const CC_MESSAGE_SUCCESS_CLASS = "cc-inline-message-success"

export function controlCenterInlineMessageClass(isError: boolean): string {
  return isError
    ? `${CC_MESSAGE_BASE_CLASS} ${CC_MESSAGE_ERROR_CLASS}`
    : `${CC_MESSAGE_BASE_CLASS} ${CC_MESSAGE_SUCCESS_CLASS}`
}

export function controlCenterInlineMessageLabel(
  message: unknown,
  busy: boolean,
  moduleName: string,
  fieldName = "message",
): string {
  const clean = safeText(message, "", moduleName, fieldName)
  if (!clean) return ""
  return busy ? `⏳ ${clean}` : clean
}
