import { createBinding, For, This } from "ags"
import app from "ags/gtk4/app"
import Bar from "./Bar"

export default function Bars() {
  const monitors = createBinding(app, "monitors")

  return (
    <For each={monitors}>
      {(monitor: unknown) => (
        <This this={app}>
          <Bar gdkmonitor={monitor} />
        </This>
      )}
    </For>
  )
}
