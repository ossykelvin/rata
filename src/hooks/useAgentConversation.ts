import { FormEvent, useState } from 'react'
import type { AgentReply, CharacterState } from '../types'

const initialChat: { role: 'user' | 'rata'; text: string }[] = [
  { role: 'rata', text: 'I\'m running in MVP mode. Try “open notepad”, “what is 36 * 14?”, or “copy Hello Rata to clipboard”.' }
]

export function useAgentConversation() {
  const [input, setInput] = useState('')
  const [chat, setChat] = useState(initialChat)
  const [approval, setApproval] = useState<AgentReply['approval']>()
  const [agentState, setAgentState] = useState<CharacterState>('idle')
  const [lastMessage, setLastMessage] = useState(initialChat[0].text)

  function applyReply(reply: AgentReply) {
    setLastMessage(reply.message)
    setAgentState(reply.state ?? (reply.approval ? 'awaiting_approval' : 'idle'))
    setApproval(reply.approval)
    return reply
  }

  async function sendMessage(value: string) {
    const text = value.trim()
    if (!text) return
    setChat(current => [...current, { role: 'user', text }])
    setAgentState('thinking')
    setLastMessage(`Working on: “${text}”`)
    const reply = await window.rata.agentMessage(text)
    setChat(current => [...current, { role: 'rata', text: reply.message }])
    return applyReply(reply)
  }

  async function sendForm(event: FormEvent) {
    event.preventDefault()
    const value = input.trim()
    if (!value) return
    setInput('')
    await sendMessage(value)
  }

  async function approve() {
    if (!approval) return
    setAgentState('working')
    const reply = await window.rata.approveAction(approval.id)
    setChat(current => [...current, { role: 'rata', text: reply.message }])
    applyReply(reply)
  }

  async function reject() {
    if (!approval) return
    const reply = await window.rata.rejectAction(approval.id)
    setChat(current => [...current, { role: 'rata', text: reply.message }])
    applyReply(reply)
  }

  return {
    input,
    setInput,
    chat,
    approval,
    agentState,
    lastMessage,
    setLastMessage,
    setAgentState,
    sendForm,
    sendMessage,
    approve,
    reject
  }
}

export type AgentConversation = ReturnType<typeof useAgentConversation>
