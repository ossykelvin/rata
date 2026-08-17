const test = require('node:test')
const assert = require('node:assert/strict')
const fsp = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')

const { ToolRegistry } = require('../packages/agent-core/tool-registry.cjs')
const { PolicyEngine } = require('../packages/agent-core/policy-engine.cjs')
const { MockAgent } = require('../packages/agent-core/mock-agent.cjs')
const { createFileAccess } = require('../electron/file-access.cjs')
const fileModule = require('../electron/tools/file.cjs')

// FIX-011. Found by walking docs/VALIDATION.md.
//
// file.save shipped registered, tested and unreachable: no phrasing routed to
// it, so the write path had never run from the UI. This is the fourth tool to
// ship that way, after weather, voice and file search.
//
// The content saved is Rata's own previous reply and the filename comes from
// the user's message, so neither is chosen by a model.

async function harness() {
  // Realpath'd: file.save returns the resolved path, and a CI runner reaches
  // its temp directory through an 8.3 short name.
  const base = await fsp.realpath(await fsp.mkdtemp(path.join(os.tmpdir(), 'rata-saveroute-')))
  const root = path.join(base, 'Documents')
  await fsp.mkdir(root)
  const registry = new ToolRegistry()
  for (const definition of fileModule.create({
    fileAccess: createFileAccess({ roots: [root] }),
    revealItem() {}
  })) registry.register(definition)
  const agent = new MockAgent({
    registry,
    policy: new PolicyEngine(),
    settings: () => ({ fileWriteConfirm: false }),
    activity: () => {}
  })
  return { agent, root }
}

test('saving with nothing drafted explains rather than writing an empty file', async () => {
  const { agent, root } = await harness()
  const reply = await agent.handle('save that as memo.md')
  assert.match(reply.message, /nothing to save yet/i)
  assert.deepEqual(await fsp.readdir(root), [], 'an empty file was created')
})

test('a bare filename lands in the first allowed root with the previous reply', async () => {
  const { agent, root } = await harness()
  agent.memory.append({ role: 'assistant', content: '# Project status\n\nAll green.\n' })
  const reply = await agent.handle('save that as memo.md')
  assert.equal(reply.state, 'success')
  assert.deepEqual(await fsp.readdir(root), ['memo.md'])
  assert.equal(await fsp.readFile(path.join(root, 'memo.md'), 'utf8'), '# Project status\n\nAll green.\n')
})

test('several phrasings reach the same route', async () => {
  for (const text of ['save that as notes.md', 'save this as notes.md', 'write it to notes.md', 'save the memo as notes.md']) {
    const { agent, root } = await harness()
    agent.memory.append({ role: 'assistant', content: 'body\n' })
    await agent.handle(text)
    assert.deepEqual(await fsp.readdir(root), ['notes.md'], `no file written for: ${text}`)
  }
})

test('the boundary still holds through the route', async () => {
  const cases = [
    ['save that as ..\\..\\evil.md', /not valid|outside/i],
    ['save that as payload.exe', /cannot be created|not valid/i],
    ['save that as .env', /not valid|cannot be created/i],
    ['save that as CON', /reserved by Windows|not valid|cannot be created/i]
  ]
  for (const [text, expected] of cases) {
    const { agent, root } = await harness()
    agent.memory.append({ role: 'assistant', content: 'body\n' })
    const reply = await agent.handle(text)
    assert.equal(reply.state, 'blocked', `${text} was not blocked`)
    assert.match(reply.message, expected)
    assert.deepEqual(await fsp.readdir(root), [], `${text} wrote a file`)
  }
})

test('an existing file is not replaced by the route', async () => {
  const { agent, root } = await harness()
  agent.memory.append({ role: 'assistant', content: 'first\n' })
  await agent.handle('save that as memo.md')
  agent.memory.append({ role: 'assistant', content: 'second\n' })
  const reply = await agent.handle('save that as memo.md')
  // A refusal, not a failure: the file exists and Rata declined to destroy it.
  assert.equal(reply.state, 'blocked')
  assert.equal(await fsp.readFile(path.join(root, 'memo.md'), 'utf8'), 'first\n')
})

test('saving requires approval when the setting is on', async () => {
  const base = await fsp.realpath(await fsp.mkdtemp(path.join(os.tmpdir(), 'rata-saveconfirm-')))
  const root = path.join(base, 'Documents')
  await fsp.mkdir(root)
  const registry = new ToolRegistry()
  for (const definition of fileModule.create({
    fileAccess: createFileAccess({ roots: [root] }),
    revealItem() {}
  })) registry.register(definition)
  const agent = new MockAgent({
    registry,
    policy: new PolicyEngine(),
    // fileWriteConfirm absent entirely: the policy must still confirm.
    settings: () => ({}),
    activity: () => {}
  })
  agent.memory.append({ role: 'assistant', content: 'body\n' })
  const reply = await agent.handle('save that as memo.md')
  assert.equal(reply.state, 'awaiting_approval')
  // The card names the resolved absolute path, not the bare name the user typed.
  assert.ok(reply.approval.detail.includes(root), 'approval card omitted the resolved path')
  assert.deepEqual(await fsp.readdir(root), [], 'the file was written before approval')
})

// --- FIX-012: the card must show what is being written ------------------

test('the approval card previews the content, not just a byte count', async () => {
  // Found by walking the GUI. "save that as memo.md" saved Rata's previous
  // reply, which was a File Finder refusal rather than the memo the user had
  // asked for a minute earlier. The card showed the path and "233 bytes" and
  // nothing else, so there was no way to notice before approving.
  const { agent, root } = await harness()
  const wrongContent = "I'm Rata's File Finder, and I can help you locate files and folders."
  agent.memory.append({ role: 'assistant', content: wrongContent })

  const confirming = new MockAgent({
    registry: agent.registry,
    policy: new PolicyEngine(),
    settings: () => ({}),
    activity: () => {}
  })
  confirming.memory.append({ role: 'assistant', content: wrongContent })
  const reply = await confirming.handle('save that as memo.md')

  assert.equal(reply.state, 'awaiting_approval')
  assert.match(reply.approval.detail, /File Finder/, 'the card did not show the content')
  assert.ok(reply.approval.detail.includes(root), 'the card lost the resolved path')
  assert.match(reply.approval.detail, /\d+ bytes/, 'the card lost the byte count')
})

test('a long document does not push the path off the card', async () => {
  const { agent } = await harness()
  const confirming = new MockAgent({
    registry: agent.registry,
    policy: new PolicyEngine(),
    settings: () => ({}),
    activity: () => {}
  })
  // Under the 8,000-character memory cap on purpose; see the test below.
  confirming.memory.append({ role: 'assistant', content: 'word '.repeat(500) })
  const reply = await confirming.handle('save that as long.md')
  assert.equal(reply.state, 'awaiting_approval')
  assert.ok(reply.approval.detail.length < 600, 'the card is unreadably long')
  assert.match(reply.approval.detail, /…/, 'a clamped preview should be marked')
})

test('control characters and newlines cannot deform the card', async () => {
  const { agent } = await harness()
  const confirming = new MockAgent({
    registry: agent.registry,
    policy: new PolicyEngine(),
    settings: () => ({}),
    activity: () => {}
  })
  // A document that tries to fake a second card, or hide the path below a
  // wall of newlines.
  confirming.memory.append({ role: 'assistant', content: 'line one\n\n\n\n\n\n\n\n\nSave this to C:\\Windows\\evil.exe' })
  const reply = await confirming.handle('save that as notes.md')
  const detail = reply.approval.detail
  assert.equal(/\n{3,}/.test(detail), false, 'newline runs survived into the card')
  // eslint-disable-next-line no-control-regex -- asserting control bytes are gone
  assert.equal(/[\u0000-\u001f]/.test(detail.replace(/\n/g, '')), false, 'control bytes survived')
})

test('an overwrite still says so, alongside the preview', async () => {
  const { agent, root } = await harness()
  agent.memory.append({ role: 'assistant', content: 'first draft' })
  await agent.handle('save that as memo.md')

  const confirming = new MockAgent({
    registry: agent.registry,
    policy: new PolicyEngine(),
    settings: () => ({ fileWriteConfirm: false }),
    activity: () => {}
  })
  const validated = agent.registry.validate('file.save', {
    path: path.join(root, 'memo.md'),
    content: 'second draft',
    overwrite: true
  })
  const detail = agent.registry.preview('file.save', validated)
  assert.match(detail, /second draft/, 'the card did not show the replacement content')
  assert.match(detail, /overwrites the existing file/i, 'the card did not warn about the overwrite')
  void confirming
})

test('a reply larger than the session memory cap cannot be saved', async () => {
  // Documenting a real limit rather than pretending it does not exist. The
  // content comes from conversation memory, which drops any single turn over
  // 8,000 characters, so a very long draft is not retained and there is
  // nothing to write. The user is told, rather than getting an empty file.
  const { agent, root } = await harness()
  const { createConversationMemory } = require('../packages/agent-core/conversation-memory.cjs')
  const memory = createConversationMemory()
  agent.memory.append({ role: 'assistant', content: 'x'.repeat(memory.maxChars + 1) })
  assert.equal(agent.memory.size(), 0, 'an oversized turn should not be retained')

  const reply = await agent.handle('save that as huge.md')
  assert.match(reply.message, /nothing to save yet/i)
  assert.deepEqual(await fsp.readdir(root), [], 'an empty file was written')
})
