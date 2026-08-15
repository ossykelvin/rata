const test = require('node:test')
const assert = require('node:assert/strict')

const { ToolRegistry } = require('../packages/agent-core/tool-registry.cjs')
const { PolicyEngine } = require('../packages/agent-core/policy-engine.cjs')
const { MockAgent, APPROVAL_TTL_MS, MAX_PENDING_APPROVALS } = require('../packages/agent-core/mock-agent.cjs')

// Regression cover for REVIEW-001 finding M1.
//
// `this.pending` had no TTL and no size cap. 5,000 unanswered requests were
// retained and the oldest remained executable indefinitely. Two problems: main
// process memory grows unboundedly from renderer-driven input, and an approval
// requested hours ago still authorises the action it described.

function harness({ ttl = APPROVAL_TTL_MS, max = MAX_PENDING_APPROVALS } = {}) {
  const executed = []
  const registry = new ToolRegistry()
  registry.register({
    id: 'clipboard.write',
    description: 'Write text to the clipboard.',
    risk: 'safe-write',
    confirmation: 'configurable',
    confirmationSetting: 'clipboardConfirm',
    validateInput: input => ({ text: String(input.text) }),
    execute: async input => {
      executed.push(input.text)
      return { summary: 'copied', message: 'copied' }
    }
  })

  let clock = 1_000_000
  const agent = new MockAgent({
    registry,
    policy: new PolicyEngine(),
    settings: () => ({ clipboardConfirm: true }),
    activity: () => {},
    approvalTtlMs: ttl,
    maxPendingApprovals: max,
    now: () => clock
  })

  return {
    agent,
    executed,
    advance: ms => { clock += ms },
    request: async text => (await agent.handle(`copy ${text} to clipboard`)).approval
  }
}

test('an approval still works inside its TTL', async () => {
  const { agent, executed, advance, request } = harness()
  const approval = await request('hello')
  assert.ok(approval)

  advance(APPROVAL_TTL_MS - 1)
  const result = await agent.approve(approval.id)
  assert.equal(result.state, 'success')
  assert.deepEqual(executed, ['hello'])
})

test('an approval past its TTL cannot be executed', async () => {
  const { agent, executed, advance, request } = harness()
  const approval = await request('stale')

  advance(APPROVAL_TTL_MS + 1)
  const result = await agent.approve(approval.id)

  assert.equal(result.state, 'error')
  assert.match(result.message, /expired or was already handled/)
  assert.deepEqual(executed, [], 'an expired approval executed the action')
})

test('expired approvals do not accumulate', async () => {
  const { agent, advance, request } = harness()
  for (let i = 0; i < 10; i++) await request(`item ${i}`)
  assert.equal(agent.pending.size, 10)

  advance(APPROVAL_TTL_MS + 1)
  // Any subsequent activity prunes; approving a stale id is enough.
  await agent.approve('00000000-0000-4000-8000-000000000000')
  assert.equal(agent.pending.size, 0)
})

test('pending approvals are capped regardless of volume', async () => {
  const { agent, request } = harness({ max: 5 })
  for (let i = 0; i < 500; i++) await request(`item ${i}`)
  assert.equal(agent.pending.size, 5, 'the pending map grew past its ceiling')
})

test('at capacity the oldest approval is evicted, not the newest', async () => {
  const { agent, executed, request } = harness({ max: 3 })
  const first = await request('first')
  await request('second')
  await request('third')
  const fourth = await request('fourth')

  // The oldest was pushed out...
  const stale = await agent.approve(first.id)
  assert.equal(stale.state, 'error')
  assert.deepEqual(executed, [])

  // ...and the newest still works.
  const fresh = await agent.approve(fourth.id)
  assert.equal(fresh.state, 'success')
  assert.deepEqual(executed, ['fourth'])
})

test('rejecting an expired approval is safe and executes nothing', async () => {
  const { agent, executed, advance, request } = harness()
  const approval = await request('secret')
  advance(APPROVAL_TTL_MS + 1)

  const result = await agent.reject(approval.id)
  assert.equal(result.state, 'idle')
  assert.deepEqual(executed, [])
  assert.equal(agent.pending.size, 0)
})

test('an approval cannot be replayed after use', async () => {
  const { agent, executed, request } = harness()
  const approval = await request('once')

  assert.equal((await agent.approve(approval.id)).state, 'success')
  const replay = await agent.approve(approval.id)

  assert.equal(replay.state, 'error')
  assert.deepEqual(executed, ['once'], 'the approval executed twice')
})
