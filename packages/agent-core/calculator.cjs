'use strict'

const MAX_EXPRESSION_LENGTH = 200
const MAX_DEPTH = 24
const ALLOWED = /^[0-9+\-*/().%\s]+$/

function tokenize(source) {
  const tokens = []
  let i = 0
  while (i < source.length) {
    const ch = source[i]
    if (/\s/.test(ch)) {
      i += 1
      continue
    }
    if ('+-*/()%'.includes(ch)) {
      tokens.push({ type: 'op', value: ch })
      i += 1
      continue
    }
    if (ch === '.' || (ch >= '0' && ch <= '9')) {
      let num = ''
      let dots = 0
      while (i < source.length && (source[i] === '.' || (source[i] >= '0' && source[i] <= '9'))) {
        if (source[i] === '.') dots += 1
        if (dots > 1) throw new TypeError('Invalid number in expression.')
        num += source[i]
        i += 1
      }
      if (num === '.') throw new TypeError('Invalid number in expression.')
      tokens.push({ type: 'number', value: Number(num) })
      continue
    }
    throw new TypeError('Expression contains unsupported characters.')
  }
  return tokens
}

function evaluateTokens(tokens) {
  let index = 0
  let depth = 0

  function peek() {
    return tokens[index]
  }

  function consume() {
    return tokens[index++]
  }

  function parseExpression() {
    let left = parseTerm()
    while (peek() && peek().type === 'op' && (peek().value === '+' || peek().value === '-')) {
      const op = consume().value
      const right = parseTerm()
      left = op === '+' ? left + right : left - right
    }
    return left
  }

  function parseTerm() {
    let left = parseFactor()
    while (peek() && peek().type === 'op' && (peek().value === '*' || peek().value === '/')) {
      const op = consume().value
      const right = parseFactor()
      if (op === '/') {
        if (right === 0) throw new TypeError('Division by zero.')
        left = left / right
      } else {
        left = left * right
      }
    }
    return left
  }

  function parseFactor() {
    depth += 1
    if (depth > MAX_DEPTH) throw new TypeError('Expression is too deeply nested.')
    try {
      const token = peek()
      if (!token) throw new TypeError('Unexpected end of expression.')

      if (token.type === 'op' && token.value === '-') {
        consume()
        return -parseFactor()
      }
      if (token.type === 'op' && token.value === '+') {
        consume()
        return parseFactor()
      }
      if (token.type === 'op' && token.value === '(') {
        consume()
        const value = parseExpression()
        const close = consume()
        if (!close || close.value !== ')') throw new TypeError('Missing closing parenthesis.')
        return applyPercent(value)
      }
      if (token.type === 'number') {
        consume()
        return applyPercent(token.value)
      }
      throw new TypeError('Unexpected token in expression.')
    } finally {
      depth -= 1
    }
  }

  function applyPercent(value) {
    if (peek() && peek().type === 'op' && peek().value === '%') {
      consume()
      return value / 100
    }
    return value
  }

  const result = parseExpression()
  if (index !== tokens.length) throw new TypeError('Unexpected trailing tokens in expression.')
  if (!Number.isFinite(result)) throw new TypeError('Calculation did not produce a finite number.')
  return result
}

function evaluateExpression(expression) {
  if (typeof expression !== 'string' || !expression.trim()) {
    throw new TypeError('Expression must be a non-empty string.')
  }
  const source = expression.trim()
  if (source.length > MAX_EXPRESSION_LENGTH) {
    throw new TypeError(`Expression cannot exceed ${MAX_EXPRESSION_LENGTH} characters.`)
  }
  if (!ALLOWED.test(source)) {
    throw new TypeError('Expression may only contain numbers and + - * / ( ) %.')
  }
  return evaluateTokens(tokenize(source))
}

function extractCalculation(text) {
  if (typeof text !== 'string') return null
  const percentOf = text.match(/(\d+(?:\.\d+)?)\s*%\s*(?:of\s+)?(\d+(?:\.\d+)?)/i)
  if (percentOf) {
    return {
      expression: `${percentOf[2]}*(${percentOf[1]}/100)`,
      display: `${percentOf[1]}% of ${percentOf[2]}`
    }
  }

  const stripped = text
    .replace(/what(?:'s| is)|please|calculate|compute|work out|equals?|result|\?/gi, ' ')
    .replace(/[x×]/g, '*')
    .trim()
  if (ALLOWED.test(stripped) && /\d/.test(stripped) && /[+\-*/%]/.test(stripped)) {
    return { expression: stripped, display: stripped }
  }

  const embedded = text.replace(/[x×]/g, '*').match(/(\d+(?:\.\d+)?(?:\s*[+\-*/]\s*\d+(?:\.\d+)?)+)/)
  if (embedded) {
    return { expression: embedded[1], display: embedded[1] }
  }
  return null
}

function formatNumber(value) {
  if (Number.isInteger(value)) return String(value)
  return String(Number(value.toPrecision(12)))
}

module.exports = {
  MAX_EXPRESSION_LENGTH,
  evaluateExpression,
  extractCalculation,
  formatNumber
}
