import type { ControlPageRegistration } from './model'

const modules = import.meta.glob<{ controlPage?: ControlPageRegistration }>('./*Page.tsx', { eager: true })

export const controlPages = Object.values(modules)
  .map(module => module.controlPage)
  .filter((page): page is ControlPageRegistration => Boolean(page))
  .sort((a, b) => a.order - b.order)
