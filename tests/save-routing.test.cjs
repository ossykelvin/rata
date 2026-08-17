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
