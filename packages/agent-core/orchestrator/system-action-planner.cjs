'use strict'

const PLAN_VERSION = 1
const ALLOWED_APP_NAMES = Object.freeze(['notepad', 'calculator'])
const SYSTEM_ACTION_HINT =
  /\b(?:open|launch|start|run|bring\s+up)\b[\s\S]{0,80}\b(?:app|application|program|notepad|text\s+editor|calculator|calc)\b/i

const SYSTEM_ACTION_PROMPT = [
  'Classify one explicit Windows application-launch request.',
  'Return exactly one JSON object and no markdown or prose.',
  'The only executable shape is:',
  '{"version":1,"action":"system.openApp","input":{"appName":"notepad"}}',
  'Allowed appName values are only "notepad" and "calculator".',
  'Map "text editor" to "notepad" and "calc" to "calculator".',
  'For every other request, unsupported application, ambiguity, path, URL,',
  'argument, script, shell, PowerShell, elevation, or command, return:',
  '{"version":1,"action":"none"}',
  'Never return source code, command text, paths, arguments, or extra keys.'
].join(' ')

class SystemActionPlanError extends Error {
  constructor(code) {
    super(code)
    this.name = 'SystemActionPlanError'
    this.code = code
  }
}

function looksLikeSystemActionRequest(value) {
  return typeof value === 'string' && value.length <= 2_000 && SYSTEM_ACTION_HINT.test(value)
}

function hasExactKeys(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const keys = Object.keys(value).sort()
  const wanted = [...expected].sort()
  return keys.length === wanted.length && keys.every((key, index) => key === wanted[index])
}

function stripSingleJsonFence(value) {
  const match = value.match(/^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/i)
  return match ? match[1] : value
}

function parseSystemActionPlan(raw) {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 512) {
    throw new SystemActionPlanError('invalid-plan-envelope')
  }

  let value
  try {
    value = JSON.parse(stripSingleJsonFence(raw.trim()))
  } catch {
    throw new SystemActionPlanError('invalid-plan-json')
  }

  if (value?.action === 'none') {
    if (!hasExactKeys(value, ['version', 'action']) || value.version !== PLAN_VERSION) {
      throw new SystemActionPlanError('invalid-none-plan')
    }
    return null
  }

  if (!hasExactKeys(value, ['version', 'action', 'input']) || value.version !== PLAN_VERSION) {
    throw new SystemActionPlanError('invalid-action-plan')
  }
  if (value.action !== 'system.openApp' || !hasExactKeys(value.input, ['appName'])) {
    throw new SystemActionPlanError('unsupported-action-plan')
  }
  if (!ALLOWED_APP_NAMES.includes(value.input.appName)) {
    throw new SystemActionPlanError('unsupported-application')
  }

  return Object.freeze({
    toolId: 'system.openApp',
    input: Object.freeze({ appName: value.input.appName }),
    title: `Open ${value.input.appName}`
  })
}

async function planSystemAction({ provider, request }) {
  if (!provider || typeof provider.generate !== 'function') {
    throw new SystemActionPlanError('provider-unavailable')
  }
  const result = await provider.generate({
    prompt: request,
    messages: [
      { role: 'system', content: SYSTEM_ACTION_PROMPT },
      { role: 'user', content: request }
    ]
  })
  return { proposal: parseSystemActionPlan(result.text), providerResult: result }
}

module.exports = {
  ALLOWED_APP_NAMES,
  PLAN_VERSION,
  SYSTEM_ACTION_PROMPT,
  SystemActionPlanError,
  looksLikeSystemActionRequest,
  parseSystemActionPlan,
  planSystemAction,
  stripSingleJsonFence,
  hasExactKeys
}
