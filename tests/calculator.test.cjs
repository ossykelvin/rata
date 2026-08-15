const test = require('node:test')
const assert = require('node:assert/strict')
const { evaluateExpression, extractCalculation } = require('../packages/agent-core/calculator.cjs')
const { createMvpRegistry } = require('../electron/mvp-tools.cjs')

test('calculator evaluates arithmetic without using eval', () => {
  assert.equal(evaluateExpression('36 * 14'), 504)
  assert.equal(evaluateExpression('2400*(15/100)'), 360)
  assert.equal(evaluateExpression('(1 + 2) * 3'), 9)
  assert.equal(evaluateExpression('15%'), 0.15)
  assert.equal(evaluateExpression('-4 + 10'), 6)
})

test('calculator rejects unsafe or malformed input', () => {
  assert.throws(() => evaluateExpression('process.exit(1)'), /unsupported|only contain/i)
  assert.throws(() => evaluateExpression('1 / 0'), /zero/)
  assert.throws(() => evaluateExpression(''), /non-empty/)
})

test('natural-language extraction finds percent-of and infix expressions', () => {
  assert.equal(extractCalculation('calculate 15% of 2400').expression, '2400*(15/100)')
  assert.equal(extractCalculation('what is 36 * 14?').expression.trim(), '36 * 14')
})

test('calculator tool is a read action and does not spawn processes', async () => {
  const launches = []
  const registry = createMvpRegistry({
    spawnProcess: (...args) => { launches.push(args); return { unref() {} } },
    clipboardApi: { writeText() {} }
  })
  const result = await registry.execute('calculator.evaluate', { expression: '8 / 2' })
  assert.match(result.message, /=\s*4/)
  assert.equal(launches.length, 0)
})
