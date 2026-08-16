const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { createSkillRegistry, createSkillLoader, createSkillRouter } = require('../packages/skills/index.cjs')
const { createMvpRegistry } = require('../electron/mvp-tools.cjs')
const { MockAgent } = require('../packages/agent-core/mock-agent.cjs')
const { PolicyEngine } = require('../packages/agent-core/policy-engine.cjs')

const ROOT = path.join(__dirname, '..')

function agentWithProvider(generate) {
  const tools = createMvpRegistry({ spawnProcess: () => ({ unref() {} }), clipboardApi: { writeText() {} } })
  const registry = createSkillRegistry({ rootDir: ROOT, toolRegistry: tools })
  const loader = createSkillLoader({ registry })
  const router = createSkillRouter({ registry, toolRegistry: tools })
  const events = []
  const calls = []
  const agent = new MockAgent({
    registry: tools,
    policy: new PolicyEngine(),
    settings: () => ({ clipboardConfirm: true }),
    activity: (...args) => events.push(args),
    skills: { registry, loader, router },
    provider: generate
      ? {
          generate: async request => {
            calls.push(request)
            return generate(request)
          }
        }
      : null
  })
  return { agent, calls, events, router }
}

test('Critical Thinking routes to the provider with its skill prompt', async () => {
  const { agent, calls, router } = agentWithProvider(() => ({
    text: 'Assumptions: the claim is untested.',
    model: 'test-model',
    provider: 'openrouter',
    attempts: []
  }))

  const routed = router.route('Think critically about this plan')
  assert.deepEqual(routed.selectedSkillIds, ['critical-thinking'])

  const result = await agent.handle('Think critically about this plan')
  assert.equal(result.state, 'success')
  assert.equal(result.message, 'Assumptions: the claim is untested.')
  assert.doesNotMatch(result.message, /no live provider/i)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].preferredProvider, 'openrouter')
  const system = calls[0].messages.filter(message => message.role === 'system').map(message => message.content).join('\n')
  assert.match(system, /Critical Thinking skill/)
  assert.match(calls[0].messages.at(-1).content, /Think critically about this plan/)
})

test('Critical Thinking without a provider does not use the unloaded-prompt stub', async () => {
  const { agent } = agentWithProvider(null)
  const result = await agent.handle('Challenge my assumptions about this')
  assert.doesNotMatch(result.message, /no live provider/i)
  assert.doesNotMatch(result.message, /skill prompt stays unloaded/i)
  assert.match(result.message, /no AI provider is connected/i)
})
