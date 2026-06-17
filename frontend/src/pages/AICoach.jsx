// src/pages/AICoach.jsx
// Agentic AI Coach powered by Claude (via Python FastAPI backend)

import { useState, useRef, useEffect, useCallback } from 'react'
import { PlusCircle, SendHorizonal, Sprout, User, ChevronDown, CheckCircle2, Circle } from 'lucide-react'
import PropTypes from 'prop-types'
import AppHeader from '../components/AppHeader'
import BottomNav from '../components/BottomNav'
import { useFootprint } from '../hooks/useFootprint'
import { getGovtData, sendChatMessage, getActionPlan, fetchActiveActionPlan, toggleActionItem } from '../services/api'
import { showToast } from '../components/Toast'
import './AICoach.css'

const QUICK_REPLIES = [
  'Give me a 30-day plan',
  "What's my biggest emission?",
  'Easy wins for me',
  'How do I offset my carbon?',
]

// ─── Action Plan Card ─────────────────────────────────────────────────────────
function ActionPlanCard({ plan, onPlanUpdate }) {
  const planId = plan?.plan_id
  const actions = plan?.actions || (Array.isArray(plan) ? plan : [])
  const [claiming, setClaiming] = useState(null)
  const [claimText, setClaimText] = useState('')

  if (!Array.isArray(actions) || actions.length === 0) return null

  const doneCount = actions.filter(a => a.completed).length
  const totalCount = actions.length

  const handleToggle = async (item) => {
    if (!item.completed && !claiming) {
      setClaiming(item.day)
      setClaimText('')
      return
    }
    if (item.completed) {
      await submitToggle(item, false, '')
    }
  }

  const submitToggle = async (item, completed, claim) => {
    setClaiming(null)
    if (!planId) {
      showToast('No active plan found to update.', 'error')
      return
    }
    try {
      const data = await toggleActionItem(planId, item.day, completed, claim)
      if (data.verification?.verified || !completed) {
        showToast(
          completed
            ? `✓ ${data.verification?.co2_saved_kg?.toFixed(1) || 0}kg CO₂ saved — verified!`
            : 'Action unchecked.',
          completed ? 'success' : 'info'
        )
        if (onPlanUpdate) {
          onPlanUpdate()
        }
      } else {
        showToast(data.verification?.message || 'Tell us more about how you completed this.', 'warning')
      }
    } catch (err) {
      showToast('Something went wrong, try again.', 'error')
    }
  }

  return (
    <div className="action-plan-bubble">
      <div className="action-plan-bubble-header">
        <span>🗓️ Your 30-Day Green Plan</span>
        <span className="action-plan-count">{doneCount}/{totalCount} done</span>
      </div>
      <div className="action-plan-items">
        {actions.slice(0, 6).map((item) => {
          const co2Saving = item.co2_saving_kg ?? item.co2Saving ?? 0
          return (
            <div key={item.day} className={`plan-item ${item.completed ? 'completed' : ''}`}>
              <button
                className={`plan-check ${item.completed ? 'done' : ''}`}
                onClick={() => handleToggle(item)}
                aria-label={`${item.completed ? 'Unmark' : 'Complete'} day ${item.day}`}
                aria-pressed={!!item.completed}
              >
                {item.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
              </button>
              <div className="plan-item-text" style={{ flex: 1 }}>
                <span className="plan-day">Day {item.day}</span>
                <span className="plan-action">{item.action}</span>
                {co2Saving > 0 && (
                  <span className="plan-saving">↓ {co2Saving} kg CO₂</span>
                )}
                {claiming === item.day && (
                  <div className="claim-input-wrap">
                    <input
                      className="claim-input"
                      placeholder="Tell us how you did it…"
                      value={claimText}
                      onChange={e => setClaimText(e.target.value)}
                      autoFocus
                    />
                    <div className="claim-btns">
                      <button className="claim-btn claim-confirm" onClick={() => submitToggle(item, true, claimText)}>
                        Submit
                      </button>
                      <button className="claim-btn claim-cancel" onClick={() => setClaiming(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
        {actions.length > 6 && (
          <p className="plan-more">+ {actions.length - 6} more actions</p>
        )}
      </div>
    </div>
  )
}

ActionPlanCard.propTypes = {
  plan: PropTypes.oneOfType([PropTypes.array, PropTypes.object]),
  onPlanUpdate: PropTypes.func,
}

// ─── Sub-components ───────────────────────────────────────────────────────────
const BotAvatar = () => (
  <div className="bot-avatar" aria-hidden="true">
    <Sprout size={16} />
  </div>
)

const UserAvatar = () => (
  <div className="user-avatar" aria-hidden="true">
    <User size={14} />
  </div>
)

function TypingIndicator() {
  return (
    <div className="message-row bot" role="status" aria-label="EcoMind is typing">
      <BotAvatar />
      <div className="typing-bubble" aria-hidden="true">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function AICoach() {
  const { footprints } = useFootprint()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [actionPlan, setActionPlan] = useState(null)
  const [govtData, setGovtData] = useState(null)
  const chatRef = useRef(null)
  const textareaRef = useRef(null)
  const nextId = useRef(1)

  const refreshPlan = useCallback(() => {
    fetchActiveActionPlan().then(res => {
      if (res.plan) {
        try {
          const planData = typeof res.plan === 'string' ? JSON.parse(res.plan) : res.plan
          if (planData && planData.plan_id) {
            setActionPlan(planData)
          } else if (Array.isArray(planData) && planData.length > 0) {
            setActionPlan({ actions: planData })
          }
        } catch(e) {}
      }
    }).catch(() => {})
  }, [])


  // Load initial greeting
  useEffect(() => {
    const greeting = {
      id: nextId.current++,
      type: 'bot',
      text: `Hi! I'm EcoMind, your personal carbon coach. I've analyzed your recent lifestyle data and found some interesting trends. Based on your energy usage this month, there are 3 easy wins we could focus on. How can I help you today?`,
      time: 'Just now',
      showQuickReplies: true,
    }
    setMessages([greeting])

    // Fetch active action plan on load
    refreshPlan()
  }, [refreshPlan])

  // Load govt data in background
  useEffect(() => {
    getGovtData('Bengaluru').then(setGovtData).catch(() => {})
  }, [])

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages, isTyping])

  const sendMessage = useCallback(
    async (text) => {
      const trimmed = (text || input).trim()
      if (!trimmed || isTyping) return

      const userMsg = { id: nextId.current++, type: 'user', text: trimmed, time: 'Just now' }
      setMessages(prev => [...prev, userMsg])
      setInput('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'

      setIsTyping(true)

      // Check if user is requesting a 30-day plan
      const isRequestingPlan = trimmed.toLowerCase().includes('30-day') || trimmed.toLowerCase().includes('action plan') || trimmed.toLowerCase().includes('plan')

      try {
        const history = messages.slice(-10).map(m => ({
          role: m.type === 'user' ? 'user' : 'assistant',
          content: m.text,
        }))
        history.push({ role: 'user', content: trimmed })

        if (isRequestingPlan) {
          const res = await getActionPlan(history)
          let planData = null
          try {
            planData = typeof res.plan === 'string' ? JSON.parse(res.plan) : res.plan
          } catch (e) {
            console.error('Failed to parse action plan JSON:', e)
          }

          if (planData) {
            const actions = Array.isArray(planData) ? planData : (planData.actions || [])
            const plan_id = res.plan_id || planData.plan_id
            if (actions.length > 0) {
              setActionPlan({ plan_id, actions })
              const botMsg = {
                id: nextId.current++,
                type: 'bot',
                text: "I've generated a customized 30-day carbon reduction plan based on your carbon footprint. You can view and track your progress in the plan card below!",
                time: 'Just now',
              }
              setMessages(prev => [...prev, botMsg])
            } else {
              // Fallback general chat if plan is empty
              const resChat = await sendChatMessage(history)
              const isError = resChat.reply?.includes('Too many requests')
              const botMsg = {
                id: nextId.current++,
                type: 'bot',
                isError,
                text: resChat.reply || "I'm thinking about your plan. Could you ask me again in a moment?",
                time: 'Just now',
              }
              setMessages(prev => [...prev, botMsg])
            }
          } else {
            // Fallback general chat if plan failed to parse
            const resChat = await sendChatMessage(history)
            const isError = resChat.reply?.includes('Too many requests')
            const botMsg = {
              id: nextId.current++,
              type: 'bot',
              isError,
              text: resChat.reply || "I'm thinking about your plan. Could you ask me again in a moment?",
              time: 'Just now',
            }
            setMessages(prev => [...prev, botMsg])
          }
        } else {
          // Standard chatbot conversation
          const res = await sendChatMessage(history)
          const isError = res.reply?.includes('Too many requests')
          const botMsg = {
            id: nextId.current++,
            type: 'bot',
            isError,
            text: res.reply || "I'm thinking about your question. Could you rephrase it?",
            time: 'Just now',
          }
          setMessages(prev => [...prev, botMsg])
        }
      } catch (err) {
        const errMsg = {
          id: nextId.current++,
          type: 'bot',
          isError: true,
          text: 'Too many requests right now. Please wait a moment and try again.',
          time: 'Just now',
        }
        setMessages(prev => [...prev, errMsg])
      } finally {
        setIsTyping(false)
      }
    },
    [input, isTyping, messages]
  )

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleTextareaChange = (e) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  const latestFootprint = footprints[0]

  return (
    <div className="app-shell">
      <AppHeader badgeLarge />

      <div className="coach-layout">
        <div className="chat-wrapper">
          {/* Context banner */}
          {latestFootprint && (
            <div className="coach-context-bar" role="status">
              <span aria-hidden="true">📊</span>
              <span>
                Your footprint: <strong>{latestFootprint.totalCO2}T CO₂/yr</strong>
                {' '}· Diet: {latestFootprint.food ? `${latestFootprint.food}T food` : 'N/A'}
                {' '}· Travel: {latestFootprint.travel ? `${latestFootprint.travel}T` : 'N/A'}
              </span>
            </div>
          )}

          {/* Messages */}
          <div
            className="chat-messages hide-scrollbar"
            ref={chatRef}
            role="log"
            aria-live="polite"
            aria-label="Conversation with EcoMind AI Coach"
          >
            {messages.map((msg) => (
              <div key={msg.id}>
                <div className={`message-row ${msg.type}`}>
                  {msg.type === 'bot' && <BotAvatar />}
                  <div
                    className={`bubble ${msg.type === 'bot' ? (msg.isError ? 'bubble-error' : 'bubble-bot') : 'bubble-user'}`}
                    role={msg.type === 'bot' ? 'article' : undefined}
                  >
                    {msg.isError && <span className="error-icon" aria-hidden="true">⚠️</span>}
                    {msg.type === 'bot' && !msg.isError ? msg.text.replace(/[*_~`#]/g, '') : msg.text}
                  </div>
                  {msg.type === 'user' && <UserAvatar />}
                </div>
                <div className={`msg-time ${msg.type}`}>{msg.time}</div>

                {/* Quick replies after greeting */}
                {msg.showQuickReplies && (
                  <div className="quick-replies" role="group" aria-label="Quick reply options">
                    {QUICK_REPLIES.map(qr => (
                      <button
                        key={qr}
                        className="quick-reply-chip"
                        onClick={() => sendMessage(qr)}
                        aria-label={`Quick reply: ${qr}`}
                      >
                        {qr}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Action Plan Card */}
            {actionPlan && (
              <div className="message-row bot">
                <BotAvatar />
                <ActionPlanCard plan={actionPlan} onPlanUpdate={refreshPlan} />
              </div>
            )}

            {isTyping && <TypingIndicator />}
          </div>

          {/* Input */}
          <div className="chat-input-bar" role="form" aria-label="Message input">
            <button
              className="input-icon-btn"
              aria-label="Attach file"
              title="Attach a bill for analysis"
            >
              <PlusCircle size={22} strokeWidth={1.75} />
            </button>

            <textarea
              ref={textareaRef}
              id="ai-coach-input"
              className="chat-textarea hide-scrollbar"
              placeholder="Ask EcoMind about your footprint..."
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              rows={1}
              aria-label="Type your message"
              aria-multiline="true"
              disabled={isTyping}
            />

            <button
              id="send-message-btn"
              className="send-btn"
              onClick={() => sendMessage()}
              disabled={!input.trim() || isTyping}
              aria-label="Send message"
            >
              <SendHorizonal size={16} aria-hidden="true" />
            </button>
          </div>
          <p className="input-disclaimer" role="note">
            EcoMind can make mistakes. Verify important climate data.
          </p>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}

