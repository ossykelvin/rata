import { RataAvatar } from '../../components/RataAvatar'
import { ApprovalActions } from '../../components/ApprovalActions'
import type { ControlCenterContextValue, ControlPageRegistration } from './model'

export function ChatPage({ ctx }: { ctx: ControlCenterContextValue }) {
  const { conversation } = ctx
  return (
    <section className="chat-layout">
      <div className="chat-card">
        <div className="chat-scroll">
          {conversation.chat.map((item, index) => (
            <div key={`${item.role}-${index}`} className={`chat-message chat-${item.role}`}>
              {item.role === 'rata' && <div className="mini-r">R</div>}
              <p>{item.text}</p>
            </div>
          ))}
          {conversation.approval && (
            <ApprovalActions
              variant="inline"
              approval={conversation.approval}
              onApprove={conversation.approve}
              onReject={conversation.reject}
            />
          )}
        </div>
        <form className="chat-composer" onSubmit={conversation.sendForm}>
          <input value={conversation.input} onChange={e => conversation.setInput(e.target.value)} placeholder="Ask Rata to do something…" />
          <button className="button-primary" type="submit">Send</button>
        </form>
      </div>
      <aside className="chat-side">
        <RataAvatar state={conversation.agentState} />
        <h3>Agent state</h3>
        <span className={`state-chip state-${conversation.agentState}`}>{conversation.agentState.replaceAll('_', ' ')}</span>
        <p>Production models are intentionally not wired in this MVP. Replace the mock provider behind the agent interface. Skills may reason; only registered tools may act.</p>
      </aside>
    </section>
  )
}

export const controlPage: ControlPageRegistration = {
  id: 'chat',
  icon: '✦',
  label: 'Chat',
  order: 20,
  render: ctx => <ChatPage ctx={ctx} />
}
