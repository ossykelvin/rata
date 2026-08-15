'use strict'

/**
 * Electron shell hardening for the renderer privilege boundary.
 *
 * Addresses REVIEW-001 findings H3 and H4.
 *
 * `contextIsolation` and `sandbox` isolate how the preload bridge is
 * implemented. They do not control *who* gets to call it. Two gaps followed
 * from that:
 *
 *   H3 - neither window restricted navigation or `window.open`, so a renderer
 *        that navigated to a remote origin would load that origin into a
 *        window whose preload had already exposed `window.rata`.
 *   H4 - no IPC handler checked `event.senderFrame`, so any frame that ended
 *        up in a Rata window could invoke every privileged channel.
 *
 * Both are closed by deciding, in one place, which URLs count as "our
 * renderer" and refusing everything else.
 *
 * Kept free of Electron imports so it is unit-testable without booting the
 * app; callers pass the window and event objects in.
 */

/**
 * @param {object} options
 * @param {string[]} options.allowedPrefixes  Renderer URL prefixes that are
 *   ours: the dev-server origin in development, the packaged `index.html`
 *   file URL in production.
 * @param {(details: {channel?: string, url?: string}) => void} [options.onBlocked]
 *   Called when a navigation, popup or IPC call is refused. Receives the URL
 *   only — never payloads.
 */
function createSecurityPolicy({ allowedPrefixes, onBlocked = () => {} } = {}) {
  if (!Array.isArray(allowedPrefixes) || allowedPrefixes.length === 0) {
    throw new TypeError('createSecurityPolicy requires at least one allowed URL prefix.')
  }
  if (allowedPrefixes.some(prefix => typeof prefix !== 'string' || !prefix)) {
    throw new TypeError('Allowed URL prefixes must be non-empty strings.')
  }

  const prefixes = Object.freeze([...allowedPrefixes])

  /** Fail closed: anything that is not a string starting with a known prefix. */
  function isAllowedUrl(url) {
    if (typeof url !== 'string' || !url) return false
    return prefixes.some(prefix => url === prefix || url.startsWith(prefix))
  }

  /**
   * H4. `senderFrame` is null once a frame is disposed, and undefined on a
   * malformed event — both are untrusted.
   */
  function isTrustedSender(event) {
    return isAllowedUrl(event?.senderFrame?.url)
  }

  /**
   * H3. Applied to every BrowserWindow at creation, before any load.
   */
  function applyWindowGuards(win) {
    const contents = win?.webContents
    if (!contents || typeof contents.on !== 'function') {
      throw new TypeError('applyWindowGuards requires a BrowserWindow with webContents.')
    }

    // Rata never opens popups. A new window would carry the same preload.
    if (typeof contents.setWindowOpenHandler === 'function') {
      contents.setWindowOpenHandler(details => {
        onBlocked({ url: details?.url })
        return { action: 'deny' }
      })
    }

    const blockForeignNavigation = (event, url) => {
      if (isAllowedUrl(url)) return
      event.preventDefault()
      onBlocked({ url })
    }

    contents.on('will-navigate', blockForeignNavigation)
    // A redirect reaches the same destination without a `will-navigate`.
    contents.on('will-redirect', blockForeignNavigation)
    // Rata uses no <webview>; attaching one would create an unguarded frame.
    if (typeof contents.on === 'function') {
      contents.on('will-attach-webview', event => {
        event.preventDefault()
        onBlocked({ url: 'webview' })
      })
    }
  }

  return { allowedPrefixes: prefixes, isAllowedUrl, isTrustedSender, applyWindowGuards }
}

module.exports = { createSecurityPolicy }
