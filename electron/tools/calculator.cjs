const { evaluateExpression, formatNumber } = require('../../packages/agent-core/calculator.cjs')

function requireObject(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('calculator.evaluate input must be an object.')
  }
  return input
}

function create() {
  return [{
    id: 'calculator.evaluate',
    description: 'Evaluate a safe arithmetic expression.',
    risk: 'read',
    confirmation: 'never',
    validateInput: input => {
      const value = requireObject(input)
      if (typeof value.expression !== 'string' || !value.expression.trim()) {
        throw new TypeError('Calculator expression must be a non-empty string.')
      }
      return { expression: value.expression.trim() }
    },
    execute: async ({ expression }) => {
      const result = evaluateExpression(expression)
      const formatted = formatNumber(result)
      return {
        summary: `Calculated ${expression}`,
        message: `${expression} = ${formatted}`
      }
    }
  }]
}

module.exports = { id: 'calculator', toolIds: ['calculator.evaluate'], create }
