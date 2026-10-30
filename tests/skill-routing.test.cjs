const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { createSkillRegistry, createSkillRouter } = require('../packages/skills/index.cjs')
const { createMvpRegistry } = require('../electron/mvp-tools.cjs')

const ROOT = path.join(__dirname, '..')

// FIX-015. The fourth routing defect, and the first to be fixed at the cause.
//
// Three separate faults compounded in `triggerScore`:
//
//   1. A `message.includes(word)` fallback matched a trigger word inside any
//      longer word. Screenshot Inspector triggers on "at", which sits inside
//      "what", "that" and "create", so it scored against nearly every English
//      sentence. Because the score is hits/triggerWords.length, the damage grew
//      with message length.
//   2. Function words counted in the denominator, so a trigger that described
//      its skill well scored *worse* than a vague one. "Move these reports into
//      folders by year" scored 0.33 and fell under the 0.34 threshold, while
//      "Move my meeting" scored 0.50 on "move" alone.
//   3. The router ignored whether a skill could run, so a skill with no
//      registered tools could win and dead-end the request.
//
// These assert on routing outcomes, not on scores. The scoring numbers are an
// implementation detail; which skill answers the user is not.

function build() {
  const tools = createMvpRegistry({ spawnProcess: () => ({ unref() {} }), clipboardApi: { writeText() {} } })
  const registry = createSkillRegistry({ rootDir: ROOT, toolRegistry: tools })
  return { registry, router: createSkillRouter({ registry, toolRegistry: tools }) }
}

const selected = (router, message) => router.route(message).selectedSkillIds[0] || null

test('every skill still routes to itself from its own documented triggers', () => {
  const { registry, router } = build()
  for (const skill of registry.list().filter(item => item.selectable !== false)) {
    for (const trigger of skill.triggers) {
      assert.equal(selected(router, trigger), skill.id, `"${trigger}" no longer selects ${skill.id}`)
    }
  }
})

test('subject matter does not decide the skill, however long it gets', () => {
  const { router } = build()
  const short = 'draft a memo about the project status'
  const long = `${short} covering the migration timeline, the outstanding vendor questions and the two risks we agreed to track weekly`
  assert.equal(selected(router, short), 'document-assistant')
  assert.equal(selected(router, long), 'document-assistant', 'a longer request changed the skill')
})

test('a trigger word does not match inside a longer word', () => {
  const { router } = build()
  // Plain conversation, no skill intent. Under the substring fallback these
  // loaded Critical Thinking, because its triggers include words that sit
  // inside "that", "what" and "am". A skill prompt was being loaded for
  // ordinary chat.
  const conversation = [
    'is that the same as what we saw',
    'I am not sure what that means',
    'that is what I meant about the format'
  ]
  for (const message of conversation) {
    assert.equal(selected(router, message), null, `"${message}" matched a skill on a word fragment`)
  }
})

test('a request routes to the skill that can serve it, not one that cannot', () => {
  const { router } = build()
  // Both score identically on "move". Calendar Assistant has none of its four
  // tools registered, so selecting it replies "installed, but its tools are not
  // registered yet" to a plain file move.
  assert.equal(selected(router, 'move the invoice into the archive folder'), 'file-organizer')
})

test('an unregistered skill still wins when it is clearly the right one', () => {
  const { router } = build()
  // The tie-break must stay small enough not to override a real gap. Email
  // Assistant scores 1.00 here and Web Search 0.67; preferring Web Search would
  // send the user's private request to Serper as a public search query.
  assert.equal(selected(router, 'find the latest email from Sarah'), 'email-assistant')
  assert.equal(selected(router, 'what is on my calendar today'), 'calendar-assistant')
})

test('a skill that cannot run is reported rather than silently dropped', () => {
  const { router } = build()
  const routed = router.route('send an email to Sarah about tomorrow')
  assert.deepEqual(routed.selectedSkillIds, ['email-assistant'])
  // Being told which tools are missing is the honest answer, and the agent
  // depends on this to explain itself. Filtering unavailable skills out at the
  // threshold would produce "no skill matched" instead.
  assert.ok(routed.missingTools.length > 0)
})

test('routing survives a router built without a tool registry', () => {
  // Availability is unknown here, so the tie-break is inert by design. This
  // path is used by tests and must not throw.
  const router = createSkillRouter({ registry: createSkillRegistry({ rootDir: ROOT }) })
  assert.equal(selected(router, 'weather in Leeds'), 'weatherman')
  assert.equal(selected(router, 'what is 36 * 14?'), 'calculator')
})

test('common phrasings reach the skill the user meant', () => {
  const { router } = build()
  const expected = [
    ['what is 36 * 14?', 'calculator'],
    ['copy Hello Rata to clipboard', 'clipboard-assistant'],
    ['find large files', 'filesystem-scan'],
    ['give me a storage health report', 'filesystem-scan'],
    ['how much RAM do I have?', 'system-info'],
    ['how much disk space is free?', 'system-info'],
    ['keep my PC awake for two hours', 'keep-awake'],
    ['weather in Leeds', 'weatherman'],
    ['what is on my screen?', 'screenshot-inspector'],
    ['turn these notes into a slide deck', 'presentation-builder'],
    ['think critically about this proposal', 'critical-thinking'],
    ['search the web for the latest electron release notes', 'web-search'],
    ['what is the capital of Peru?', 'trivia']
  ]
  for (const [message, want] of expected) {
    assert.equal(selected(router, message), want, `"${message}" routed elsewhere`)
  }
})
