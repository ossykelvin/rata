const crypto = require('node:crypto')
const { extractCalculation } = require('./calculator.cjs')

/**
 * How long a requested approval stays valid. An approval is a snapshot of user
 * intent; once the context around it is gone, clicking "Allow" no longer means
 * what it meant when the card appeared. See REVIEW-001 finding M1.
 */
const APPROVAL_TTL_MS = 5 * 60 * 1000

/**
 * Hard ceiling on approvals held at once. Without it the map grows for as long
 * as a caller keeps asking for confirmable actions and never answering.
 */
const MAX_PENDING_APPROVALS = 20

class MockAgent {
  constructor({
    registry,
    policy,
    settings,
    activity,
    skills = null,
    approvalTtlMs = APPROVAL_TTL_MS,
    maxPendingApprovals = MAX_PENDING_APPROVALS,
    now = () => Date.now()
  }) {
    this.registry = registry
    this.policy = policy
    this.settings = settings
    this.activity = activity
    this.skills = skills
    this.approvalTtlMs = approvalTtlMs
    this.maxPendingApprovals = maxPendingApprovals
    // Injectable so expiry is testable without sleeping.
    this.now = now
    this.pending = new Map()
  }

  /** Drops approvals past their TTL. Called before any read or write. */
  prunePending() {
    const cutoff = this.now() - this.approvalTtlMs
    for (const [id, entry] of this.pending) {
      if (entry.requestedAt <= cutoff) this.pending.delete(id)
    }
  }

  /**
   * Records a pending approval, enforcing the ceiling.
   *
   * At capacity the oldest entry is evicted rather than refusing the new one:
   * refusing would let a flood of requests disable the approval path
   * altogether, which is the more damaging failure. An evicted approval simply
   * reports as expired if the user gets to it later.
   */
  rememberPending(pendingId, entry) {
    this.prunePending()
    while (this.pending.size >= this.maxPendingApprovals) {
      const oldest = this.pending.keys().next()
      if (oldest.done) break
      this.pending.delete(oldest.value)
      this.activity('Approval expired', 'An older approval was dropped to stay within the pending limit.', 'warning')
    }
    this.pending.set(pendingId, { ...entry, requestedAt: this.now() })
  }

  /** Returns a live approval, or undefined if it is missing or expired. */
  takePending(id) {
    this.prunePending()
    const entry = this.pending.get(id)
    if (!entry) return undefined
    this.pending.delete(id)
    return entry
  }

  async handle(message) {
    const text = message.trim()
    const lower = text.toLowerCase()
    this.activity('User request', `Request received (${text.length} characters).`, 'info')

    if (/\b(open|launch|start)\s+(notepad|calculator|calc)\b/i.test(text)) {
      const appName = lower.includes('notepad') ? 'notepad' : 'calculator'
      return this.runTool('system.openApp', { appName }, `Open ${appName}`)
    }

    const copyMatch = text.match(/^copy\s+(.+?)(?:\s+to\s+(?:the\s+)?clipboard)?$/i)
    if (copyMatch) {
      const value = copyMatch[1].replace(/\s+to\s+(?:the\s+)?clipboard$/i, '').trim()
      return this.runTool('clipboard.write', { text: value }, 'Write to clipboard')
    }

    if (/what can you do|help|commands|installed skills/i.test(text)) {
      return this.help()
    }

    const routed = this.skills?.router?.route(text)
    if (routed?.selectedSkillIds?.length) {
      return this.handleSkill(text, routed)
    }

    return {
      message: `MVP mode: I understood “${text}”, but a live AI provider is intentionally not connected yet. Try “open notepad”, “copy Hello to clipboard”, or a calculation such as “what is 36 * 14?”.`,
      state: 'idle'
    }
  }

  help() {
    const skillNames = this.skills?.registry?.list?.().map(skill => skill.name) || []
    const skillLine = skillNames.length
      ? ` Installed skill packs: ${skillNames.slice(0, 8).join(', ')}${skillNames.length > 8 ? ', and more in Control Center' : ''}.`
      : ''
    return {
      message: `In this MVP I can open Notepad or Calculator, write approved text to your clipboard, evaluate arithmetic, keep an audit trail, and demonstrate the permission gate.${skillLine} Mail, calendar, browser control, native UI Automation and live AI providers remain handover milestones.`,
      state: 'idle'
    }
  }

  async handleSkill(text, routed) {
    const skillId = routed.selectedSkillIds[0]
    this.activity('Skill selected', `${skillId}: ${routed.shortReason}`, 'info')

    if (skillId === 'calculator') {
      const parsed = extractCalculation(text)
      if (!parsed) {
        return {
          message: 'Calculator is ready. Give me an expression such as “what is 36 * 14?” or “calculate 15% of 2400”.',
          state: 'idle'
        }
      }
      return this.runTool('calculator.evaluate', { expression: parsed.expression }, `Calculate ${parsed.display}`)
    }

    if (routed.missingTools.length) {
      return {
        message: `${routed.skill?.name || skillId} is installed, but its tools are not registered yet (${routed.missingTools.join(', ')}). Skills cannot bypass the Tool Registry.`,
        state: 'idle'
      }
    }

    return {
      message: `${routed.skill?.name || skillId} matched this request, but the mock agent has no live provider to continue. The skill prompt stays unloaded until a provider adapter is added.`,
      state: 'idle'
    }
  }

  async runTool(id, input, title) {
    // Metadata only. The executor is reachable solely via registry.execute().
    const tool = this.registry.describe(id)
    let validatedInput = input
    if (tool) {
      try {
        validatedInput = this.registry.validate(id, input)
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Invalid tool input.'
        this.activity('Blocked action', `${id}: ${reason}`, 'warning')
        return { message: `I blocked that action: ${reason}`, state: 'error' }
      }
    }
    const decision = this.policy.evaluate(tool, validatedInput, this.settings())
    if (decision.decision === 'deny') {
      this.activity('Blocked action', `${id}: ${decision.reason}`, 'warning')
      return { message: `I blocked that action: ${decision.reason}`, state: 'error' }
    }
    if (decision.decision === 'confirm') {
      const pendingId = crypto.randomUUID()
      this.rememberPending(pendingId, { id, input: validatedInput, title })
      this.activity('Approval requested', `${title} requires approval.`, 'warning')
      return {
        message: 'I can do that, but this action needs your approval.',
        state: 'awaiting_approval',
        approval: {
          id: pendingId,
          title,
          detail: id === 'clipboard.write' ? `Copy “${validatedInput.text}” to your clipboard.` : JSON.stringify(validatedInput),
          risk: tool.risk
        }
      }
    }
    return this.execute(id, validatedInput)
  }

  async approve(id) {
    const pending = this.takePending(id)
    if (!pending) return { message: 'That approval has expired or was already handled.', state: 'error' }
    this.activity('Approval granted', pending.title, 'success')
    return this.execute(pending.id, pending.input)
  }

  async reject(id) {
    const pending = this.takePending(id)
    this.activity('Approval rejected', pending?.title || id, 'warning')
    return { message: 'Cancelled. I did not make the change.', state: 'idle' }
  }

  async execute(id, input) {
    try {
      this.activity('Tool started', `${id}`, 'info')
      const result = await this.registry.execute(id, input)
      this.activity('Tool completed', `${id}: ${result.summary}`, 'success')
      return { message: result.message, state: 'success' }
    } catch (error) {
      this.activity('Tool failed', `${id}: ${error.message}`, 'error')
      return { message: `I couldn't complete that action: ${error.message}`, state: 'error' }
    }
  }
}

module.exports = { MockAgent, APPROVAL_TTL_MS, MAX_PENDING_APPROVALS }
