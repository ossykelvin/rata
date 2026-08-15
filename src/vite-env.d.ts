/// <reference types="vite/client" />

import type { RataBridge } from './types'

declare global {
  interface Window {
    rata: RataBridge
  }
}

export {}
