declare function print(...args: unknown[]): void

declare module "ags/gtk4/app" {
  const app: {
    start: (config: unknown) => void
    get_monitors: () => unknown[]
  }
  export default app
}

declare module "ags/gtk4" {
  export const Astal: any
  export const Gtk: any
  export const Gdk: any
}

declare module "ags/process" {
  export function execAsync(command: string): Promise<string>
}

declare module "ags/time" {
  export type PollBinding<T> = {
    (): T
    <U>(map: (value: T) => U): U
    peek?: () => T
    subscribe?: (listener: () => void) => (() => void) | void
  }

  export function createPoll<T>(
    initial: T,
    intervalMs: number,
    fn: (prev: T) => Promise<T> | T,
  ): PollBinding<T>
}

declare module "ags/gtk4/jsx-runtime" {
  export const jsx: any
  export const jsxs: any
  export const Fragment: any
}

declare namespace JSX {
  interface IntrinsicElements {
    [elemName: string]: any
  }
}
