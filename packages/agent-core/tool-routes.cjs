'use strict'

/**
 * Deterministic phrase → tool routes, in one ordered table.
 *
 * Why this file exists
 * --------------------
 * A registered tool is not a reachable tool. Nothing between a user's sentence
 * and `ToolRegistry.execute()` is provided by the model — the ADR-009 planner
 * proposes `system.openApp` and nothing else — so a tool with no phrase route
 * cannot run at all, however thoroughly it is registered, validated and tested.
 *
 * Five tools shipped that way and were found one at a time by GUI testing:
 * weather, voice, file search, `file.save`, and then eleven more at once. The
 * failure is quiet in the worst way: with a provider connected the request
 * falls through to `ask()`, and the model answers from general knowledge with
 * `state: 'success'`. "How much RAM do I have?" returned a confident wrong
 * number, and "keep my PC awake for two hours" replied "I have kept your PC
 * awake" while no blocker was held and the machine went on to sleep.
 *
 * Collecting the routes here makes the gap countable: `routableToolIds()` is
 * compared against the registry in tests and surfaced in the Skills page, so a
 * tool registered without a route is visible rather than discovered in use.
 *
 * What a route may and may not do
 * -------------------------------
 * A route extracts arguments from the user's own words. It never composes a
 * filesystem path, never invents a target, and never consults a model. Every
 * input it produces still passes `validateInput` and the policy engine
 * afterwards, so a route cannot widen what a tool permits — the worst a wrong
 * route can do is send a well-formed request the tool then refuses.
 *
 * `build` returns one of:
 *   - `{ toolId, input, title, options }` to run a tool
 *   - `{ reply }` to answer directly, for a question or a scope refusal
 *   - `null` to decline and let the next route try
 */

const MAX_KEEP_AWAKE_SECONDS = 12 * 60 * 60

const NUMBER_WORDS = new Map([
  ['half', 0.5], ['one', 1], ['an', 1], ['a', 1], ['two', 2], ['three', 3], ['four', 4],
  ['five', 5], ['six', 6], ['seven', 7], ['eight', 8], ['nine', 9], ['ten', 10],
  ['eleven', 11], ['twelve', 12]
])

/** "two hours", "90 minutes", "an hour and a half" → seconds, or null. */
function parseDuration(text) {
  if (!text) return null
  const lower = String(text).toLowerCase()
  const match = lower.match(/(\d+(?:\.\d+)?|half|one|an?|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(second|minute|min|hour|hr)s?/)
  if (!match) return null
  const raw = match[1]
  const amount = NUMBER_WORDS.has(raw) ? NUMBER_WORDS.get(raw) : Number(raw)
  if (!Number.isFinite(amount) || amount <= 0) return null
  const unit = match[2]
  const perUnit = unit.startsWith('second') ? 1 : unit.startsWith('min') ? 60 : 3600
  const seconds = Math.round(amount * perUnit)
  if (seconds < 1) return null
  return Math.min(seconds, MAX_KEEP_AWAKE_SECONDS)
}

const strip = value => String(value).replace(/[?.!]+$/, '').trim()

/**
 * Scopes Rata may never inventory, refused before any tool call.
 *
 * `filesystem.scan` would refuse these itself, but only after an approval card
 * had been rendered — the user would be asked to approve a scan of `C:\` that
 * was always going to fail. Fail-closed ordering means the refusal comes first.
 */
// Each alternative carries its own boundaries. A single trailing \b does not
// work here: "scan C:\" ends in punctuation, so a word boundary can never hold
// after it and the drive letter slipped through to a scan of the whole disk.
const FORBIDDEN_SCOPE = new RegExp([
  '\\b[a-z]:(?:[\\\\/]|\\b)',              // C:  C:\  C:/
  '\\bc\\s*drive\\b',
  '\\b(?:whole|entire|full)\\s+(?:pc|computer|system|machine|drive|disk)\\b',
  '\\bprogram\\s+files\\b',
  '\\bwindows\\s+(?:folder|directory)\\b',
  '\\bsystem32\\b',
  '\\busers?\\s+folder\\b',
  '\\\\\\\\[^\\s]+'                        // \\server\share
].join('|'), 'i')

const OUT_OF_SCOPE_REPLY = {
  message:
    'I can only inspect Documents, Downloads and Desktop. I will not scan a whole drive, a system folder or a network share.',
  state: 'blocked'
}

const ROUTES = [
  // ---- migrated verbatim from mock-agent dispatchRequest -----------------
  {
    toolId: 'system.openApp',
    pattern: /\b(open|launch|start)\s+(notepad|calculator|calc)\b/i,
    build: match => ({
      input: { appName: /notepad/i.test(match[0]) ? 'notepad' : 'calculator' },
      title: `Open ${/notepad/i.test(match[0]) ? 'notepad' : 'calculator'}`
    })
  },
  {
    toolId: 'clipboard.write',
    pattern: /^copy\s+(.+?)(?:\s+to\s+(?:the\s+)?clipboard)?$/i,
    build: match => {
      const value = match[1].replace(/\s+to\s+(?:the\s+)?clipboard$/i, '').trim()
      return { input: { text: value }, title: 'Write to clipboard' }
    }
  },
  {
    // A URL is fetched only through the registered tool. If approved, its
    // result is passed to the provider as `context`, which the provider
    // contract fences as untrusted external data.
    toolId: 'web.fetch',
    pattern: /^(?:fetch|read|summari[sz]e)\s+(https?:\/\/\S+)/i,
    build: (match, { text }) => ({
      input: { url: match[1] },
      title: 'Fetch public web page',
      options: { kind: 'synthesize-web', question: text }
    })
  },
  {
    // Local file routes sit BEFORE the web-search route on purpose. "search my
    // files for invoice" matches the web pattern below, which would send the
    // phrase to Serper — the opposite of what was asked, and a local request
    // leaving the machine. FIX-010.
    toolId: 'file.searchContent',
    pattern: /^(?:search|grep|look)\s+(?:in\s+|inside\s+|through\s+)?(?:my\s+|the\s+)?(?:files?|documents?|notes?)\s+for\s+(.+)$/i,
    build: match => {
      const query = strip(match[1])
      return query ? { input: { query }, title: `Search your files for “${query}”` } : null
    }
  },
  {
    // "save that as memo.md" writes Rata's own last reply to a file. The
    // filename comes from the user and the content is the previous assistant
    // turn, so neither is chosen by a model: the user names the file, and the
    // bytes are text they have already read on screen. FIX-011.
    toolId: 'file.save',
    pattern: /^(?:save|write|put)\s+(?:that|this|it|the\s+\w+)\s+(?:to\s+a\s+file\s+)?(?:as|to|in)\s+(.+)$/i,
    build: (match, { lastAssistantMessage }) => {
      const name = strip(match[1]).replace(/^["']|["']$/g, '').trim()
      if (!name) return { reply: { message: 'What should I call the file?', state: 'idle' } }
      if (!lastAssistantMessage) {
        return {
          reply: {
            message: 'There is nothing to save yet. Ask me to draft something first, then say “save that as notes.md”.',
            state: 'idle'
          }
        }
      }
      return { input: { path: name, content: lastAssistantMessage }, title: `Save ${name}` }
    }
  },
  {
    toolId: 'file.search',
    pattern: /^(?:find|list|show|locate)\s+(?:me\s+)?(?:all\s+)?(?:the\s+|my\s+)?files?\s+(?:called|named|matching|with\s+the\s+name)\s+(.+)$/i,
    build: match => {
      const query = strip(match[1])
      return query ? { input: { query }, title: `Find files named “${query}”` } : null
    }
  },

  // ---- FIX-016: tools that were registered with no route ------------------
  {
    // Before the scan routes: a forbidden scope is refused rather than turned
    // into an approval card the user could grant.
    toolId: null,
    pattern: /^(?:scan|inventory|index|inspect|search)\b/i,
    build: (match, { text }) => (FORBIDDEN_SCOPE.test(text) ? { reply: OUT_OF_SCOPE_REPLY } : null)
  },
  {
    toolId: 'filesystem.diskUsage',
    pattern: /\b(?:storage|disk|drive)\s+(?:health|usage|report|capacity)\b|\bhow\s+full\s+is\s+(?:my|the)\b/i,
    build: () => ({ input: {}, title: 'Report drive capacity' })
  },
  {
    toolId: 'filesystem.scan',
    pattern: /\b(?:find|show|list)\s+(?:my\s+|the\s+)?(?:large|big|biggest|largest)\s+files?\b|\bwhat(?:'|’)?s?\s+(?:is\s+)?taking\s+up\s+(?:my\s+)?(?:space|room|disk)\b/i,
    build: () => ({ input: {}, title: 'Inventory file sizes' })
  },
  {
    toolId: 'filesystem.scan',
    pattern: /^(?:scan|inventory|index)\s+(?:my\s+|the\s+)?(documents|downloads|desktop)\b/i,
    build: match => ({ input: {}, title: `Inventory ${match[1]}` })
  },
  {
    toolId: 'system.storage',
    pattern: /\bhow\s+much\s+(?:disk\s+|drive\s+|hard\s+drive\s+)?(?:space|storage)\b|\b(?:disk|drive)\s+space\s+(?:free|left|remaining)\b/i,
    build: () => ({ input: {}, title: 'Check storage' })
  },
  {
    toolId: 'system.info',
    pattern: /\bhow\s+much\s+(?:ram|memory)\b|\b(?:system|pc|computer)\s+(?:info|information|spec|specs|status)\b|\bwhat\s+version\s+of\s+windows\b|\bwhich\s+windows\s+(?:version|build)\b/i,
    build: () => ({ input: {}, title: 'Read system information' })
  },
  {
    toolId: 'system.processSummary',
    pattern: /\bwhat(?:'|’)?s?\s+(?:is\s+)?running\b|\b(?:process|processes)\s+(?:list|summary|running)\b|\bwhat\s+is\s+using\s+(?:my\s+)?(?:memory|ram|cpu)\b/i,
    build: () => ({ input: {}, title: 'Summarize running processes' })
  },
  {
    // Stop before start: "stop keeping the computer awake" contains "keep…awake".
    toolId: 'system.keepAwake.stop',
    pattern: /\b(?:stop|cancel|end|release)\b[^.]{0,40}\bawake\b|\b(?:let|allow)\s+(?:my\s+|the\s+)?(?:pc|computer|laptop|machine|it)\s+sleep\b/i,
    build: () => ({ input: {}, title: 'Release keep awake' })
  },
  {
    toolId: 'system.keepAwake.status',
    pattern: /\b(?:is|are)\s+(?:my\s+|the\s+)?(?:pc|computer|laptop|machine)\s+(?:being\s+)?kept\s+awake\b|\bkeep[- ]awake\s+status\b/i,
    build: () => ({ input: {}, title: 'Check keep awake' })
  },
  {
    toolId: 'system.keepAwake.start',
    pattern: /\bkeep\b[^.]{0,40}\bawake\b|\b(?:don(?:'|’)?t|do\s+not)\s+let\s+(?:my\s+|the\s+)?(?:pc|computer|laptop|machine)\s+sleep\b|\bprevent\s+sleep\b/i,
    build: (match, { text }) => {
      const durationSeconds = parseDuration(text)
      if (durationSeconds === null) {
        return {
          reply: {
            message: 'For how long should I keep the computer awake? For example, “keep my PC awake for two hours”.',
            state: 'idle'
          }
        }
      }
      return { input: { durationSeconds }, title: `Keep awake for ${durationSeconds}s` }
    }
  },
  {
    toolId: 'folder.create',
    pattern: /^(?:create|make|add)\s+(?:a\s+|the\s+)?(?:new\s+)?folder\s+(?:called\s+|named\s+)?(.+)$/i,
    build: match => {
      // "Archive in Documents" → the folder path the user named, unchanged.
      // Composition stays in file-access, which owns the roots.
      const name = strip(match[1]).replace(/^["']|["']$/g, '').trim()
      if (!name) return { reply: { message: 'What should the folder be called?', state: 'idle' } }
      const inFolder = name.match(/^(.+?)\s+(?:in|inside|under)\s+(.+)$/i)
      const target = inFolder ? `${strip(inFolder[2])}/${strip(inFolder[1])}` : name
      return { input: { path: target }, title: `Create folder ${target}` }
    }
  },
  {
    toolId: 'file.move',
    pattern: /^(?:move|put)\s+(.+?)\s+(?:in|into|to|under)\s+(?:the\s+)?(.+)$/i,
    build: match => {
      const source = strip(match[1]).replace(/^["']|["']$/g, '').trim()
      const destination = strip(match[2]).replace(/^["']|["']$/g, '').replace(/\s+folder$/i, '').trim()
      if (!source || !destination) return null
      return { input: { source, destination }, title: `Move ${source} to ${destination}` }
    }
  },
  {
    toolId: 'file.rename',
    pattern: /^rename\s+(.+?)\s+(?:to|as)\s+(.+)$/i,
    build: match => {
      const target = strip(match[1]).replace(/^["']|["']$/g, '').trim()
      const name = strip(match[2]).replace(/^["']|["']$/g, '').trim()
      if (!target || !name) return null
      return { input: { path: target, name }, title: `Rename ${target} to ${name}` }
    }
  },

  // ---- web search sits last: it is the broadest pattern -------------------
  {
    // Explicit search intent goes to the registered tool, so the query passes
    // the policy engine before it leaves the machine.
    toolId: 'web.search',
    pattern: /^(?:search(?:\s+the\s+web)?(?:\s+for)?|google|look\s+up|find\s+online)\s+(.+)$/i,
    build: (match, { text }) => ({
      input: { query: match[1].trim() },
      title: 'Research the web',
      options: {
        kind: 'research-web',
        question: text,
        approvalDetail:
          'Send this query to Serper, then fetch the first public result for AI synthesis. Each request leaves your machine.'
      }
    })
  },
  {
    // Weather is deterministic: the location is extracted here, not chosen by a
    // model, so no provider sees the request before the tool runs. RATA-007.
    toolId: 'weather.current',
    pattern: /^(?:(?:can|could)\s+you\s+)?(?:please\s+)?(?:tell\s+me\s+|check\s+|do\s+you\s+know\s+|give\s+me\s+)?(?:what(?:'|’)?s|what\s+is|how(?:'|’)?s|how\s+is|hows)?\s*(?:the\s+)?(?:weather|temperature|air\s+quality)\b(?:\s+like)?(?:\s+(?:in|for|at|near))?\s*(.*)$/i,
    build: match => {
      const place = match[1]
        .replace(/[?.!]+$/, '')
        .replace(/\b(right now|now|today|currently|outside|please|like)\b/gi, '')
        .trim()
      if (!place) return { reply: { message: 'Which place should I check the weather for?', state: 'idle' } }
      return { input: { query: place }, title: `Check the weather in ${place}` }
    }
  }
]

/**
 * First matching route wins. `has` is the registry existence check: a route for
 * an unregistered tool is skipped rather than attempted, so a build that
 * composes no side effects still cannot reach a tool that is not there.
 */
function matchToolRoute(message, { has = () => true, lastAssistantMessage = '' } = {}) {
  const text = String(message || '').trim()
  if (!text) return null
  for (const route of ROUTES) {
    if (route.toolId && !has(route.toolId)) continue
    const match = text.match(route.pattern)
    if (!match) continue
    const built = route.build(match, { text, lastAssistantMessage })
    if (!built) continue
    if (built.reply) return { reply: built.reply }
    return { toolId: route.toolId, input: built.input, title: built.title, options: built.options }
  }
  return null
}

/**
 * Tools reached through `handleSkill` rather than a phrase route.
 *
 * These are genuinely reachable — the skill router selects the skill and the
 * handler runs the tool — so leaving them out would under-report reachability
 * and make the Skills page lie in the other direction.
 */
const SKILL_HANDLER_TOOL_IDS = Object.freeze([
  'calculator.evaluate',
  'screen.capture',
  'vision.analyze'
])

/**
 * Registered on purpose with no way for a user phrase to reach them. Each entry
 * needs a reason, because "no route" is exactly the defect this file exists to
 * prevent; an unexplained entry here is the bug wearing a disguise.
 */
const INTENTIONALLY_UNROUTED = Object.freeze({
  'file.delete': 'Registered and disabled so File Organizer stays available without granting deletion (ADR-003).',
  'file.readText': 'Supplies source text to a skill prompt; the user names a document, not a tool.',
  'file.stat': 'Detail lookup used by other file tools rather than asked for directly.',
  'file.reveal': 'Invoked from a result in the UI, not from a typed sentence.',
  'filesystem.hash': 'Verification helper with no standalone user phrasing.',
  'document.create': 'The model returns text and the host writes it through file.save; see FIX-013.',
  'presentation.create': 'Deck content comes from the skill prompt; the host writes it through file.save.',
  'presentation.render': 'Rendering follows creation in the same host-side flow.'
})

/** Every tool id reachable from a user request. Asserted against the registry. */
function routableToolIds() {
  return [...new Set([...ROUTES.map(route => route.toolId).filter(Boolean), ...SKILL_HANDLER_TOOL_IDS])]
}

module.exports = {
  matchToolRoute,
  routableToolIds,
  parseDuration,
  ROUTES,
  SKILL_HANDLER_TOOL_IDS,
  INTENTIONALLY_UNROUTED
}
