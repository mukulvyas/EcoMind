import { useState, useRef, useEffect } from 'react'
import { PlusCircle, SendHorizonal, Sprout, User } from 'lucide-react'
import AppHeader from '../components/AppHeader'
import BottomNav from '../components/BottomNav'
import './AICoach.css'

const BOT_AVATAR = (
  <div className="bot-avatar">
    <Sprout size={16} />
  </div>
)

const USER_AVATAR = (
  <div className="user-avatar">
    <User size={14} />
  </div>
)

const QUICK_REPLIES = [
  'Give me a 30-day plan',
  "What's my biggest emission?",
  'Easy wins for me',
  'How do I offset my carbon?',
]

const INITIAL_MESSAGES = [
  {
    id: 1,
    type: 'bot',
    text: "Hi! I'm EcoMind, your personal carbon coach. I've analyzed your recent lifestyle data and found some interesting trends. Based on your energy usage this month, there are 3 easy wins we could focus on. How can I help you today?",
    time: 'Just now',
  },
]

const BOT_RESPONSES = [
  "That's a great question! Your energy emissions increased because of the heating spikes between Jan 12–18. Reducing your thermostat by just 2°C can lower emissions by ~8% this month.",
  "Your biggest emission source is Transport (42% of your footprint). Switching 2 car trips per week to public transit could save 1.8kg CO₂ weekly.",
  "Here are 3 quick wins: 1️⃣ Bus commute on Tuesdays 2️⃣ Meatless Mondays 3️⃣ Reduce thermostat by 2°C. Together they save ~3.6kg/week!",
  "For a 30-day plan, I'd start with transport (Week 1), then energy (Week 2–3), food (Week 4). Want me to generate the full roadmap?",
  "You can offset your remaining carbon by supporting verified projects on our Offset page — Kerala Reforestation is a great match for your profile!",
]

function TypingIndicator() {
  return (
    <div className="message-row bot">
      {BOT_AVATAR}
      <div className="typing-bubble">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </div>
    </div>
  )
}

export default function AICoach() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [nextId, setNextId] = useState(2)
  const chatRef = useRef(null)
  const textareaRef = useRef(null)

  // Load footprint data from localStorage
  const footprint = (() => {
    try {
      return JSON.parse(localStorage.getItem('ecomind_footprint') || '{}')
    } catch { return {} }
  })()

  const scrollToBottom = () => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }

  useEffect(() => { scrollToBottom() }, [messages, isTyping])

  const sendMessage = (text) => {
    const trimmed = (text || input).trim()
    if (!trimmed) return

    const now = new Date()
    const timeStr = 'Just now'

    // Add user message
    setMessages(prev => [...prev, { id: nextId, type: 'user', text: trimmed, time: timeStr }])
    setNextId(n => n + 1)
    setInput('')

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    // Show typing indicator then bot response
    setIsTyping(true)
    setTimeout(() => {
      setIsTyping(false)
      const response = BOT_RESPONSES[Math.floor(Math.random() * BOT_RESPONSES.length)]
      setMessages(prev => [...prev, { id: nextId + 1, type: 'bot', text: response, time: 'Just now' }])
      setNextId(n => n + 2)
    }, 1800)
  }

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

  const formatTime = (t) => t

  return (
    <div className="app-shell">
      <AppHeader badgeLarge />

      {/* Sidebar scores (desktop) + Chat */}
      <div className="coach-layout">

        {/* Chat area */}
        <div className="chat-wrapper">
          {/* Footprint context banner */}
          {footprint.totalCo2 && (
            <div className="coach-context-bar">
              <span>📊</span>
              <span>Your footprint: <strong>{footprint.totalCo2}T CO₂/yr</strong> · Diet: {footprint.diet || 'N/A'} · Transport: {footprint.transport || 'Daily'}</span>
            </div>
          )}

          {/* Messages */}
          <div className="chat-messages hide-scrollbar" ref={chatRef}>

            {messages.map((msg) => (
              <div key={msg.id}>
                <div className={`message-row ${msg.type}`}>
                  {msg.type === 'bot' && BOT_AVATAR}

                  <div className={`bubble ${msg.type === 'bot' ? 'bubble-bot' : 'bubble-user'}`}>
                    {msg.text}
                  </div>

                  {msg.type === 'user' && USER_AVATAR}
                </div>
                <div className={`msg-time ${msg.type}`}>{msg.time}</div>

                {/* Quick replies only after first bot message */}
                {msg.id === 1 && (
                  <div className="quick-replies">
                    {QUICK_REPLIES.map(qr => (
                      <button
                        key={qr}
                        className="quick-reply-chip"
                        onClick={() => sendMessage(qr)}
                      >
                        {qr}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isTyping && <TypingIndicator />}
          </div>

          {/* Input Bar */}
          <div className="chat-input-bar">
            <button className="input-icon-btn">
              <PlusCircle size={22} strokeWidth={1.75} />
            </button>

            <textarea
              ref={textareaRef}
              className="chat-textarea hide-scrollbar"
              placeholder="Ask EcoMind about your footprint..."
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              rows={1}
            />

            <button
              className="send-btn"
              onClick={() => sendMessage()}
              disabled={!input.trim()}
            >
              <SendHorizonal size={16} />
            </button>
          </div>
          <p className="input-disclaimer">EcoMind can make mistakes. Verify important climate data.</p>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
