const test = require('node:test')
const assert = require('node:assert/strict')

const { ToolRegistry } = require('../packages/agent-core/tool-registry.cjs')

// Regression cover for REVIEW-001 finding M2.
//
// CLAUDE.md requires tools to run "through ToolRegistry.execute() so input
// validation cannot be skipped". `get()` used to return the live tool object
// including its executor, so any caller could invoke it directly and bypass
// validateInput(). That made the rule a convention rather than a guarantee.

const ACCESSORS = ['get', 'describe', 'list']

function registry() {
  const executed = []
  const reg = new ToolRegistry()
  reg.register({
    id: 'demo.action',
    description: 'Demo tool.',
    risk: 'safe-write',
    confirmation: 'configurable',
    confirmationSetting: 'demoConfirm',
    validateInput: input => {
      if (typeof input?.value !== 'string') throw new TypeError('value must be a string')
      return { value: input.value }
    },
    execute: async input => {
      executed.push(input.value)
      return { summary: 'done', message: 'done' }
    }
  })
  return { reg, executed }
}

test('no accessor hands out an executor', () => {
  const { reg } = registry()
  const results = [reg.get('demo.action'), reg.describe('demo.action'), ...reg.list()]
  for (const meta of results) {
    assert.equal(typeof meta.execute, 'undefined', 'an accessor exposed execute()')
    assert.equal(typeof meta.validateInput, 'undefined', 'an accessor exposed validateInput()')
  }
  for (const name of ACCESSORS) assert.equal(typeof reg[name], 'function')
})

test('metadata is still complete enough for the policy engine', () => {
  const { reg } = registry()
  const meta = reg.describe('demo.action')
  assert.equal(meta.id, 'demo.action')
  assert.equal(meta.risk, 'safe-write')
  assert.equal(meta.confirmation, 'configurable')
  assert.equal(meta.confirmationSetting, 'demoConfirm')
  assert.equal(meta.description, 'Demo tool.')
})

test('returned metadata is frozen, so a caller cannot downgrade a risk level', () => {
  const { reg } = registry()
  const meta = reg.describe('demo.action')
  assert.equal(Object.isFrozen(meta), true)
  assert.throws(() => { 'use strict'; meta.risk = 'read' }, TypeError)
  // The registry's own copy is untouched.
  assert.equal(reg.describe('demo.action').risk, 'safe-write')
})

test('has() reports registration without exposing anything', () => {
  const { reg } = registry()
  assert.equal(reg.has('demo.action'), true)
  assert.equal(reg.has('nope.missing'), false)
  assert.equal(reg.describe('nope.missing'), undefined)
  assert.equal(reg.get('nope.missing'), undefined)
})

test('execute() validates even when the caller did not', async () => {
  const { reg, executed } = registry()
  await assert.rejects(() => reg.execute('demo.action', { value: 42 }), /value must be a string/)
  await assert.rejects(() => reg.execute('demo.action', {}), /value must be a string/)
  assert.deepEqual(executed, [], 'an invalid input reached the executor')

  const result = await reg.execute('demo.action', { value: 'ok' })
  assert.equal(result.summary, 'done')
  assert.deepEqual(executed, ['ok'])
})

test('execute() and validate() reject unregistered tools', async () => {
  const { reg } = registry()
  await assert.rejects(() => reg.execute('nope.missing', {}), /not registered/)
  assert.throws(() => reg.validate('nope.missing', {}), /not registered/)
})
