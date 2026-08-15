import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const DEV_SERVER = 'http://127.0.0.1:5173'

/**
 * Content-Security-Policy for the renderer. REVIEW-001 finding H5.
 *
 * The packaged app loads over `file://`, where no HTTP response headers exist,
 * so `onHeadersReceived` cannot deliver a policy. A `<meta>` tag is the only
 * mechanism that works there — hence injecting it into index.html.
 *
 * Development and production need different policies. Vite's dev server and
 * the React refresh runtime inject an inline module preamble and open a
 * websocket for HMR; a production-strength `script-src 'self'` blocks both and
 * the app fails to boot. Rather than weaken production to keep dev working,
 * each mode gets the tightest policy it can actually run under.
 *
 * `style-src` keeps 'unsafe-inline' in both: React writes inline `style`
 * attributes (e.g. overlay opacity), which that directive governs. Removing it
 * requires moving those to classes first.
 */
const PRODUCTION_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  // The renderer talks to the main process over IPC, never over the network.
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'"
].join('; ')

const DEVELOPMENT_CSP = [
  "default-src 'self'",
  // Vite/React-refresh inject an inline preamble in dev only.
  `script-src 'self' 'unsafe-inline' ${DEV_SERVER}`,
  `style-src 'self' 'unsafe-inline' ${DEV_SERVER}`,
  `img-src 'self' data: ${DEV_SERVER}`,
  `font-src 'self' data: ${DEV_SERVER}`,
  // HMR websocket.
  `connect-src 'self' ${DEV_SERVER} ws://127.0.0.1:5173`,
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'"
].join('; ')

function contentSecurityPolicy(): Plugin {
  return {
    name: 'rata-content-security-policy',
    transformIndexHtml(_html, context) {
      const policy = context.server ? DEVELOPMENT_CSP : PRODUCTION_CSP
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: policy },
          injectTo: 'head-prepend'
        }
      ]
    }
  }
}

export default defineConfig({
  plugins: [react(), contentSecurityPolicy()],
  base: './',
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true
  }
})

export { DEVELOPMENT_CSP, PRODUCTION_CSP }
