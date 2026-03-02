import { barSystemStateBinding } from "../../lib/barSignals"

export default function ModeChip() {
  const state = barSystemStateBinding()

  return (
    <label
      class={state((s) => {
        if (!s.powerProfileAvailable) return "mode-chip mode-chip-idle"
        if (s.powerProfile === "power-saver") return "mode-chip mode-chip-eco"
        if (s.powerProfile === "balanced") return "mode-chip mode-chip-work"
        if (s.powerProfile === "performance") return "mode-chip mode-chip-boost"
        return "mode-chip mode-chip-idle"
      })}
      label={state((s) => {
        if (!s.powerProfileAvailable) return "MODE --"
        if (s.powerProfile === "power-saver") return "MODE ECO"
        if (s.powerProfile === "balanced") return "MODE WORK"
        if (s.powerProfile === "performance") return "MODE BOOST"
        return "MODE --"
      })}
    />
  )
}
