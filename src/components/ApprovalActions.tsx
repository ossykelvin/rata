import type { ApprovalRequest } from '../types'

type Props = {
  approval: ApprovalRequest
  onApprove: () => void
  onReject: () => void
  variant?: 'card' | 'inline'
}

export function ApprovalActions({ approval, onApprove, onReject, variant = 'card' }: Props) {
  const className = variant === 'inline' ? 'approval-inline' : 'approval-card no-drag'
  return (
    <div className={className}>
      {variant === 'inline' && <p className="eyebrow">APPROVAL REQUIRED · {approval.risk}</p>}
      <strong>{approval.title}</strong>
      <p>{approval.detail}</p>
      <div className={variant === 'inline' ? undefined : 'approval-actions'}>
        <button onClick={onReject} className="button-secondary">Cancel</button>
        <button onClick={onApprove} className="button-primary">{variant === 'inline' ? 'Allow once' : 'Allow'}</button>
      </div>
    </div>
  )
}
