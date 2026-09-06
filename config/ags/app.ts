import app from "ags/gtk4/app"
import style from "./style.scss"
import Shell from "./widget/Shell"
import { logBarFlagsSummary } from "./lib/barObservability"

print("LOADING app.ts")

app.start({
  css: style,
  main() {
    logBarFlagsSummary()
    return Shell()
  },
})
