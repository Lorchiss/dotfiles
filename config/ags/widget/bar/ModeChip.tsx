import { createPoll } from "ags/time"
import { readSystemState } from "../../lib/system"

type ModeState = {
  modeLabel: string
  modeClass: string
}

const MODE_POLL_MS = 6500

export default function ModeChip() {
  const state = createPoll<ModeState>(
    {
      modeLabel: "MODE --",
      modeClass: "mode-chip mode-chip-idle",
    },
    MODE_POLL_MS,
    async (prev) => {
      try {
        const snapshot = await readSystemState({ includeUpdates: false })

        if (!snapshot.powerProfileAvailable) {
          return {
            modeLabel: "MODE --",
            modeClass: "mode-chip mode-chip-idle",
          }
        }

        if (snapshot.powerProfile === "power-saver") {
          return {
            modeLabel: "MODE ECO",
            modeClass: "mode-chip mode-chip-eco",
          }
        }

        if (snapshot.powerProfile === "balanced") {
          return {
            modeLabel: "MODE WORK",
            modeClass: "mode-chip mode-chip-work",
          }
        }

        if (snapshot.powerProfile === "performance") {
          return {
            modeLabel: "MODE BOOST",
            modeClass: "mode-chip mode-chip-boost",
          }
        }

        return prev
      } catch {
        return prev
      }
    },
  )

  return (
    <label
      class={state((s) => s.modeClass)}
      label={state((s) => s.modeLabel)}
    />
  )
}
