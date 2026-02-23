import { execAsync } from "ags/process"

type TerminalLauncher = {
  binary: string
  command: (shellCommand: string) => string
}

const TERMINAL_LAUNCHERS: TerminalLauncher[] = [
  {
    binary: "kitty",
    command: (shellCommand) =>
      `kitty -e bash -lc ${shellQuote(shellCommand)} >/dev/null 2>&1 &`,
  },
  {
    binary: "foot",
    command: (shellCommand) =>
      `foot bash -lc ${shellQuote(shellCommand)} >/dev/null 2>&1 &`,
  },
  {
    binary: "alacritty",
    command: (shellCommand) =>
      `alacritty -e bash -lc ${shellQuote(shellCommand)} >/dev/null 2>&1 &`,
  },
  {
    binary: "wezterm",
    command: (shellCommand) =>
      `wezterm start --always-new-process -- bash -lc ${shellQuote(shellCommand)} >/dev/null 2>&1 &`,
  },
  {
    binary: "gnome-terminal",
    command: (shellCommand) =>
      `gnome-terminal -- bash -lc ${shellQuote(shellCommand)} >/dev/null 2>&1 &`,
  },
  {
    binary: "konsole",
    command: (shellCommand) =>
      `konsole -e bash -lc ${shellQuote(shellCommand)} >/dev/null 2>&1 &`,
  },
  {
    binary: "xterm",
    command: (shellCommand) =>
      `xterm -e bash -lc ${shellQuote(shellCommand)} >/dev/null 2>&1 &`,
  },
]

let cachedLauncher: TerminalLauncher | null | undefined

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

async function commandExists(binary: string): Promise<boolean> {
  try {
    await execAsync(
      `bash -lc ${shellQuote(`command -v ${shellQuote(binary)} >/dev/null 2>&1`)}`,
    )
    return true
  } catch {
    return false
  }
}

export async function openInTerminal(shellCommand: string): Promise<void> {
  const trimmed = shellCommand.trim()
  if (!trimmed) throw new Error("Comando vacío para terminal")

  if (cachedLauncher === undefined) {
    cachedLauncher = null
    for (const launcher of TERMINAL_LAUNCHERS) {
      if (!(await commandExists(launcher.binary))) continue
      cachedLauncher = launcher
      break
    }
  }

  if (cachedLauncher) {
    await execAsync(`bash -lc ${shellQuote(cachedLauncher.command(trimmed))}`)
    return
  }

  throw new Error(
    "No se encontró una terminal compatible (kitty, foot, alacritty, wezterm, gnome-terminal, konsole, xterm)",
  )
}
