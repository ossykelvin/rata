'use strict'

const MAX_TEXT_LENGTH = 4_000
const MAX_KEYS = 4
/** Handles are opaque integers issued by window.list and never composed here. */
const MAX_HANDLE = Number.MAX_SAFE_INTEGER

function requireObject(input, toolId) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError(`${toolId} input must be an object.`)
  }
  return input
}

/**
 * Window handles and element ids are tokens the bridge issued, echoed back.
 *
 * Same shape as the screen-capture handle in ADR-020 and the app-catalog id in
 * RATA-016: the caller names a thing from a list it was given, it never
 * constructs a reference. A handle that was never issued fails the bridge's own
 * allow-list check, so this validation is about shape rather than authority.
 */
function requireHandle(value, toolId) {
  if (!Number.isInteger(value) || value <= 0 || value > MAX_HANDLE) {
    throw new TypeError(`${toolId} requires a window handle from window.list.`)
  }
  return value
}

function requireElementId(value, toolId) {
  if (typeof value !== 'string' || !/^e[0-9]{1,6}$/.test(value)) {
    throw new TypeError(`${toolId} requires an element id from desktop.inspect.`)
  }
  return value
}

function unavailable() {
  throw new Error('The Windows bridge is not configured.')
}

/**
 * Desktop automation tools. RATA-005 / ADR-024.
 *
 * Every tool here confirms, and none is `configurable`. Driving another
 * application's interface is not a setting a user should be able to make
 * silent: the whole point of the capability is that it acts outside Rata's own
 * window, where the user cannot see what was about to happen from Rata's UI
 * alone. The master switch gates whether the capability exists at all; the
 * approval card is per action, like ADR-020.
 */
function create({ windowsBridge, windowsBridgeEnabled = () => false } = {}) {
  const bridge = windowsBridge || { request: unavailable }

  function assertEnabled(toolId) {
    if (windowsBridgeEnabled() !== true) {
      throw new TypeError(
        `${toolId} is disabled. Turn on desktop automation in Permissions before Rata can control other applications.`
      )
    }
  }

  /**
   * Maps a bridge failure to a message that carries no machine detail.
   *
   * Only a typed `WindowsBridgeError` is passed through, because those carry
   * fixed, caller-safe strings by construction — either written here or chosen
   * from the bridge's own fixed set. Anything else is replaced: a raw Node
   * error from the pipe reads like
   * `EPIPE connect \\.\pipe\rata-bridge-9f2c C:\Users\someone\...`, and that
   * would put a pipe name and a home directory into the user-visible reply and
   * the audit log. Found by a test that asserted the absence rather than the
   * presence of detail.
   */
  function publicError(error) {
    if (error?.name === 'WindowsBridgeError' && typeof error.message === 'string' && error.message) {
      return error.message
    }
    return 'The desktop automation bridge failed.'
  }

  async function send(toolId, op, args) {
    assertEnabled(toolId)
    try {
      return await bridge.request(op, args)
    } catch (error) {
      // The cause is kept for diagnosis but must never be rendered: it is the
      // raw pipe or Win32 error, and `publicError` exists precisely because
      // that text carries pipe names and home directories. Only `message`
      // reaches a reply or the audit log.
      throw new Error(publicError(error), { cause: error })
    }
  }

  return [
    {
      id: 'desktop.listWindows',
      description: 'List open windows of applications Rata is allowed to control. Returns titles and opaque handles.',
      // A window title is user content — "Payroll 2026.xlsx", "Re: contract" —
      // so listing is a read of someone's desktop, not a neutral enumeration.
      risk: 'read',
      confirmation: 'always',
      validateInput: input => {
        assertEnabled('desktop.listWindows')
        if (input === undefined || input === null) return {}
        requireObject(input, 'desktop.listWindows')
        return {}
      },
      describeInput: () =>
        'List the open windows of applications Rata may control. Window titles can contain file names and subjects.',
      execute: async () => {
        const result = await send('desktop.listWindows', 'window.list', {})
        const windows = result.windows || []
        return {
          summary: `Listed ${windows.length} window(s)`,
          message: windows.length
            ? `I found ${windows.length} window(s) I can work with: ${windows.map(w => w.title).slice(0, 8).join('; ')}`
            : 'I could not find any windows belonging to applications I am allowed to control.',
          windows: windows.map(w => ({
            handle: w.handle,
            title: w.title,
            process: w.process,
            foreground: w.foreground === true
          }))
        }
      }
    },
    {
      id: 'desktop.focusWindow',
      description: 'Bring an allowed application window to the foreground.',
      risk: 'safe-write',
      confirmation: 'always',
      validateInput: input => {
        assertEnabled('desktop.focusWindow')
        const value = requireObject(input, 'desktop.focusWindow')
        return { handle: requireHandle(value.handle, 'desktop.focusWindow') }
      },
      describeInput: input => `Bring window ${input.handle} to the front.`,
      execute: async ({ handle }) => {
        await send('desktop.focusWindow', 'window.focus', { handle })
        return { summary: 'Focused a window', message: 'I brought that window to the front.' }
      }
    },
    {
      id: 'desktop.inspect',
      description: 'Read the controls of one allowed window through UI Automation. Returns element ids, names and what each supports.',
      // This reads the contents of another application's interface: field
      // values, document names, message subjects.
      risk: 'read',
      confirmation: 'always',
      validateInput: input => {
        assertEnabled('desktop.inspect')
        const value = requireObject(input, 'desktop.inspect')
        return { handle: requireHandle(value.handle, 'desktop.inspect') }
      },
      describeInput: input =>
        `Read the on-screen controls of window ${input.handle}. This can include text shown in that application.`,
      execute: async ({ handle }) => {
        const result = await send('desktop.inspect', 'ua.inspect', { handle })
        const elements = result.elements || []
        return {
          summary: `Inspected ${elements.length} element(s)`,
          message: elements.length
            ? `That window exposes ${elements.length} control(s).`
            : 'That window did not expose any controls I can read.',
          // Untrusted: these names come from another application's UI and
          // reach the model. Same treatment as fetched web text (ADR-008).
          trust: 'untrusted-external',
          elements: elements.map(element => ({
            elementId: element.elementId,
            name: element.name,
            controlType: element.controlType,
            enabled: element.enabled === true,
            canInvoke: element.canInvoke === true,
            canSetValue: element.canSetValue === true
          }))
        }
      }
    },
    {
      id: 'desktop.invoke',
      description: 'Press one control in an allowed window, named by an element id from desktop.inspect.',
      // Destructive, because Rata cannot know what a control does. "Delete all"
      // is a button like any other, and the element name is supplied by the
      // target application rather than by Rata.
      risk: 'destructive',
      confirmation: 'always',
      validateInput: input => {
        assertEnabled('desktop.invoke')
        const value = requireObject(input, 'desktop.invoke')
        return {
          handle: requireHandle(value.handle, 'desktop.invoke'),
          elementId: requireElementId(value.elementId, 'desktop.invoke')
        }
      },
      describeInput: input => `Press control ${input.elementId} in window ${input.handle}.`,
      execute: async ({ handle, elementId }) => {
        await send('desktop.invoke', 'ua.invoke', { handle, elementId })
        return { summary: 'Pressed a control', message: 'I pressed that control.' }
      }
    },
    {
      id: 'desktop.setValue',
      description: 'Set the value of one editable control in an allowed window.',
      // Bounded: it replaces the text of one field rather than invoking a
      // command.
      risk: 'safe-write',
      confirmation: 'always',
      validateInput: input => {
        assertEnabled('desktop.setValue')
        const value = requireObject(input, 'desktop.setValue')
        if (typeof value.value !== 'string') throw new TypeError('desktop.setValue requires a value.')
        if (value.value.length > MAX_TEXT_LENGTH) throw new TypeError('That value is too long.')
        return {
          handle: requireHandle(value.handle, 'desktop.setValue'),
          elementId: requireElementId(value.elementId, 'desktop.setValue'),
          value: value.value
        }
      },
      describeInput: input =>
        `Set control ${input.elementId} in window ${input.handle} to:\n\n“${String(input.value).slice(0, 200)}”`,
      execute: async ({ handle, elementId, value }) => {
        await send('desktop.setValue', 'ua.setValue', { handle, elementId, value })
        return { summary: 'Set a control value', message: 'I set that value.' }
      }
    },
    {
      id: 'desktop.type',
      description: 'Type literal text into an allowed window that is currently in the foreground.',
      // Literal characters only. A command chord needs desktop.pressKeys,
      // which is rated higher.
      risk: 'safe-write',
      confirmation: 'always',
      validateInput: input => {
        assertEnabled('desktop.type')
        const value = requireObject(input, 'desktop.type')
        if (typeof value.text !== 'string' || !value.text) throw new TypeError('desktop.type requires text.')
        if (value.text.length > MAX_TEXT_LENGTH) throw new TypeError('That text is too long to type.')
        return { handle: requireHandle(value.handle, 'desktop.type'), text: value.text }
      },
      // The card shows the exact keystrokes. Synthesized input goes wherever
      // focus is, so the user approving it needs to see precisely what will be
      // typed, not a summary of it.
      describeInput: input =>
        `Type this into window ${input.handle}:\n\n“${String(input.text).slice(0, 200)}”`,
      execute: async ({ handle, text }) => {
        await send('desktop.type', 'input.type', { handle, value: text })
        return { summary: `Typed ${text.length} character(s)`, message: 'I typed that text.' }
      }
    },
    {
      id: 'desktop.pressKeys',
      description: 'Press one key combination in an allowed, foreground window, such as ctrl+s.',
      // Destructive: a chord is a command invocation in the target
      // application, and which command depends on that application.
      risk: 'destructive',
      confirmation: 'always',
      validateInput: input => {
        assertEnabled('desktop.pressKeys')
        const value = requireObject(input, 'desktop.pressKeys')
        if (!Array.isArray(value.keys) || value.keys.length === 0) throw new TypeError('desktop.pressKeys requires keys.')
        if (value.keys.length > MAX_KEYS) throw new TypeError('That key combination is too long.')
        const keys = value.keys.map(key => {
          if (typeof key !== 'string' || !/^[a-z0-9]{1,9}$/i.test(key)) {
            throw new TypeError('That key name is not valid.')
          }
          return key.toLowerCase()
        })
        return { handle: requireHandle(value.handle, 'desktop.pressKeys'), keys }
      },
      describeInput: input => `Press ${input.keys.join('+')} in window ${input.handle}.`,
      execute: async ({ handle, keys }) => {
        await send('desktop.pressKeys', 'input.key', { handle, keys })
        return { summary: `Pressed ${keys.join('+')}`, message: `I pressed ${keys.join('+')}.` }
      }
    }
  ]
}

module.exports = {
  id: 'desktop',
  toolIds: [
    'desktop.listWindows',
    'desktop.focusWindow',
    'desktop.inspect',
    'desktop.invoke',
    'desktop.setValue',
    'desktop.type',
    'desktop.pressKeys'
  ],
  create
}
