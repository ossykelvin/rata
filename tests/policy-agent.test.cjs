const test = require('node:test')
const assert = require('node:assert/strict')
const { ToolRegistry } = require('../packages/agent-core/tool-registry.cjs')
const { PolicyEngine } = require('../packages/agent-core/policy-engine.cjs')
const { MockAgent } = require('../packages/agent-core/mock-agent.cjs')

function fixture({ clipboardConfirm = true } = {}) {
  const registry = new ToolRegistry()
  const calls = []
  registry.register({ id: 'system.openApp', description: 'Open an app.', risk: 'safe-write', confirmation: 'never', validateInput: input => input, execute: async input => { calls.push(['open', input]); return { summary: 'opened', message: 'opened' } } })
  registry.register({ id: 'clipboard.write', description: 'Write clipboard text.', risk: 'safe-write', confirmation: 'configurable', confirmationSetting: 'clipboardConfirm', validateInput: input => input, execute: async input => { calls.push(['clipboard', input]); return { summary: 'copied', message: 'copied' } } })
  registry.register({ id: 'file.delete', description: 'Delete a file.', risk: 'destructive', confirmation: 'always', validateInput: input => input, execute: async () => { throw new Error('must not execute') } })
  const events = []
  const agent = new MockAgent({ registry, policy: new PolicyEngine(), settings: () => ({ clipboardConfirm }), activity: (...args) => events.push(args) })
  return { agent, calls, events }
}

test('allow-listed app launch executes without approval', async () => {
  const { agent, calls } = fixture()
  const result = await agent.handle('open notepad')
  assert.equal(result.state, 'success')
  assert.equal(calls.length, 1)
  assert.equal(calls[0][1].appName, 'notepad')
})

test('clipboard write requests approval by default and executes after approval', async () => {
  const { agent, calls } = fixture({ clipboardConfirm: true })
  const first = await agent.handle('copy Hello Rata to clipboard')
  assert.ok(first.approval)
  assert.equal(calls.length, 0)
  const second = await agent.approve(first.approval.id)
  assert.equal(second.state, 'success')
  assert.equal(calls[0][1].text, 'Hello Rata')
})

test('clipboard approval can be rejected without executing', async () => {
  const { agent, calls } = fixture({ clipboardConfirm: true })
  const first = await agent.handle('copy secret to clipboard')
  const second = await agent.reject(first.approval.id)
  assert.equal(second.state, 'idle')
  assert.equal(calls.length, 0)
})

test('destructive tools stay blocked even when they declare confirmation', async () => {
  const { agent, calls } = fixture()
  const result = await agent.runTool('file.delete', { path: 'example.txt' }, 'Delete file')
  assert.equal(result.state, 'error')
  assert.match(result.message, /blocked/i)
  assert.equal(calls.length, 0)
})

test('audit events do not include the full user request', async () => {
  const { agent, events } = fixture()
  await agent.handle('a private message that should not be logged')
  assert.equal(events[0][0], 'User request')
  assert.doesNotMatch(events[0][1], /private message/)
})
