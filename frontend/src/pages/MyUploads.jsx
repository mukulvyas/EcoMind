// src/pages/MyUploads.jsx
import { useState, useEffect, useCallback } from 'react'
import { X, Zap, Flame, Fuel, ShoppingBag, CheckCircle2, Circle, ChevronDown, ChevronUp } from 'lucide-react'
import PropTypes from 'prop-types'
import { getSessionId } from '../services/api'
import { showToast } from '../components/Toast'
import './MyUploads.css'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080'

function BillIcon({ type }) {
  if (type === 'electricity') return <Zap size={18} className="bill-icon electricity" />
  if (type === 'lpg') return <Flame size={18} className="bill-icon lpg" />
  if (type === 'fuel') return <span className="bill-icon fuel">⛽</span>
  return <ShoppingBag size={18} className="bill-icon food" />
}

BillIcon.propTypes = { type: PropTypes.string }

function StatusBadge({ status, confidence }) {
  const map = {
    verified: { cls: 'badge-verified', label: `✓ Verified${confidence ? ` ${confidence}%` : ''}` },
    suspicious: { cls: 'badge-suspicious', label: `⚠ Suspicious` },
    failed: { cls: 'badge-failed', label: `✗ Failed` },
    pending: { cls: 'badge-pending', label: `⏳ Pending` },
  }
  const { cls, label } = map[status] || map.pending
  return <span className={`status-badge ${cls}`}>{label}</span>
}

StatusBadge.propTypes = { status: PropTypes.string, confidence: PropTypes.number }

// ─── Bills Tab ────────────────────────────────────────────────────────────────
function BillsTab({ sessionId }) {
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`${API}/api/bills/all/${sessionId}`, {
      headers: { 'X-Session-ID': sessionId }
    })
      .then(r => r.json())
      .then(data => setBills(data.bills || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sessionId])

  if (loading) return <div className="tab-loader"><div className="spinner" /></div>

  if (!bills.length) return (
    <div className="empty-state">
      <div className="empty-icon">📄</div>
      <p className="empty-title">No bills uploaded yet</p>
      <p className="empty-sub">Tap + in the AI Coach to upload your first bill.</p>
    </div>
  )

  return (
    <div className="bills-list">
      {bills.map(bill => (
        <div key={bill.bill_id} className="bill-card">
          <div className="bill-card-top">
            <div className="bill-card-left">
              <BillIcon type={bill.bill_type} />
              <div>
                <div className="bill-provider">{bill.provider || 'Unknown'}</div>
                <div className="bill-meta">{bill.period} · {bill.units} units</div>
              </div>
            </div>
            <div className="bill-card-right">
              <div className="bill-co2">{Number(bill.co2_kg).toFixed(1)} <span>kg CO₂</span></div>
              <StatusBadge status={bill.status} confidence={bill.confidence} />
            </div>
          </div>
          {bill.verification_notes && (
            <div className="bill-notes">{bill.verification_notes}</div>
          )}
          <div className="bill-date">Uploaded {new Date(bill.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}</div>
        </div>
      ))}
    </div>
  )
}

BillsTab.propTypes = { sessionId: PropTypes.string }

// ─── Action Plan Tab ──────────────────────────────────────────────────────────
function ActionPlanTab({ sessionId }) {
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [claiming, setClaiming] = useState(null)
  const [claimText, setClaimText] = useState('')

  const fetchPlan = useCallback(() => {
    setLoading(true)
    fetch(`${API}/api/chat/action-plan/${sessionId}`, {
      headers: { 'X-Session-ID': sessionId }
    })
      .then(r => r.json())
      .then(data => setPlan(data.plan || null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sessionId])

  useEffect(() => { fetchPlan() }, [fetchPlan])

  const handleToggle = async (action) => {
    if (!action.completed && !claiming) {
      setClaiming(action.day)
      setClaimText('')
      return
    }
    if (action.completed) {
      // Untoggle directly
      await submitToggle(action, false, '')
    }
  }

  const submitToggle = async (action, completed, claim) => {
    setClaiming(null)
    try {
      const res = await fetch(
        `${API}/api/chat/action/${sessionId}/${plan.plan_id}/${action.day}`,
        {
          method: 'PATCH',
          headers: { 
            'Content-Type': 'application/json',
            'X-Session-ID': sessionId
          },
          body: JSON.stringify({ completed, user_claim: claim })
        }
      )
      const data = await res.json()
      if (data.verification?.verified || !completed) {
        showToast(
          completed
            ? `✓ ${data.verification?.co2_saved_kg?.toFixed(1) || 0}kg CO₂ saved — verified!`
            : 'Action unchecked.',
          completed ? 'success' : 'info'
        )
        fetchPlan()
      } else {
        showToast(data.verification?.message || 'Tell us more about how you completed this.', 'warning')
      }
    } catch {
      showToast('Something went wrong, try again.', 'error')
    }
  }

  if (loading) return <div className="tab-loader"><div className="spinner" /></div>
  if (!plan || !plan.actions) return (
    <div className="empty-state">
      <div className="empty-icon">🗓️</div>
      <p className="empty-title">No action plan yet</p>
      <p className="empty-sub">Ask the AI Coach "Give me a 30-day plan" to generate one.</p>
    </div>
  )

  const actions = plan.actions || []
  const filtered = filter === 'all' ? actions : actions.filter(a => a.difficulty === filter)
  const done = plan.completed_actions || 0
  const total = plan.total_actions || 30
  const saved = plan.co2_saved_so_far_kg || 0
  const pct = Math.round((done / total) * 100)

  return (
    <div className="plan-tab">
      {/* Progress Header */}
      <div className="plan-header">
        <div className="plan-progress-row">
          <span className="plan-progress-text">{done}/{total} actions done</span>
          <span className="plan-co2-badge">🌿 {saved.toFixed(1)}kg CO₂ saved</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="filter-tabs">
        {['all','easy','medium','hard'].map(f => (
          <button key={f} className={`filter-tab ${filter===f?'active':''}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Action List */}
      <div className="plan-actions">
        {filtered.map(action => (
          <div key={action.day} className={`plan-action-row ${action.completed ? 'completed' : ''}`}>
            <button
              className={`plan-check-btn ${action.completed ? 'done' : ''}`}
              onClick={() => handleToggle(action)}
              aria-label={`${action.completed ? 'Unmark' : 'Complete'} day ${action.day}`}
            >
              {action.completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
            </button>
            <div className="plan-action-content">
              <div className="plan-action-row-top">
                <span className="plan-day-num">Day {action.day}</span>
                <span className={`difficulty-tag tag-${action.difficulty}`}>{action.difficulty}</span>
                <span className="co2-tag">↓{action.co2_saving_kg}kg</span>
              </div>
              <p className="plan-action-text">{action.action}</p>

              {/* Claim input */}
              {claiming === action.day && (
                <div className="claim-input-wrap">
                  <input
                    className="claim-input"
                    placeholder="Tell us how you did it…"
                    value={claimText}
                    onChange={e => setClaimText(e.target.value)}
                    autoFocus
                  />
                  <div className="claim-btns">
                    <button className="claim-btn claim-confirm" onClick={() => submitToggle(action, true, claimText)}>
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
        ))}
      </div>
    </div>
  )
}

ActionPlanTab.propTypes = { sessionId: PropTypes.string }

// ─── History Tab ──────────────────────────────────────────────────────────────
function HistoryTab({ sessionId }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`${API}/api/footprint/history/${sessionId}`, {
      headers: { 'X-Session-ID': sessionId }
    })
      .then(r => r.json())
      .then(data => setHistory(Array.isArray(data) ? data : data.history || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sessionId])

  if (loading) return <div className="tab-loader"><div className="spinner" /></div>
  if (!history.length) return (
    <div className="empty-state">
      <div className="empty-icon">📊</div>
      <p className="empty-title">No history yet</p>
      <p className="empty-sub">Complete the calculator to see your footprint history.</p>
    </div>
  )

  return (
    <div className="history-list">
      {history.map((entry, i) => {
        const prev = history[i + 1]
        const trend = prev
          ? entry.total_co2 > prev.total_co2 ? 'worse' : 'better'
          : null
        const total = entry.total_co2 || entry.totalCO2 || 0
        const travel = entry.travel || 0
        const food = entry.food || 0
        const energy = entry.energy || 0
        const shopping = entry.shopping || 0
        const date = entry.created_at
          ? new Date(entry.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
          : 'Unknown date'

        return (
          <div key={i} className="history-card">
            <div className="history-top">
              <div>
                <div className="history-date">{date}</div>
                <div className="history-total">{Number(total).toFixed(2)} T CO₂/yr</div>
              </div>
              {trend && (
                <span className={`trend-badge trend-${trend}`}>
                  {trend === 'worse' ? '↑ Higher' : '↓ Lower'}
                </span>
              )}
            </div>
            <div className="history-bars">
              {[
                { label: 'Travel', val: travel, color: '#f59e0b' },
                { label: 'Food', val: food, color: '#10b981' },
                { label: 'Energy', val: energy, color: '#3b82f6' },
                { label: 'Shopping', val: shopping, color: '#8b5cf6' },
              ].map(({ label, val, color }) => (
                <div key={label} className="history-bar-row">
                  <span className="history-bar-label">{label}</span>
                  <div className="history-bar-track">
                    <div
                      className="history-bar-fill"
                      style={{ width: `${Math.min((val / (total || 1)) * 100, 100)}%`, background: color }}
                    />
                  </div>
                  <span className="history-bar-val">{Number(val).toFixed(1)}T</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

HistoryTab.propTypes = { sessionId: PropTypes.string }

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function MyUploads({ onClose }) {
  const [tab, setTab] = useState('bills')
  const sessionId = getSessionId()

  return (
    <div className="uploads-overlay" role="dialog" aria-modal="true" aria-label="My Uploads">
      <div className="uploads-modal">
        {/* Header */}
        <div className="uploads-header">
          <h2 className="uploads-title">My Data</h2>
          <button className="uploads-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="uploads-tabs" role="tablist">
          {['bills','plan','history'].map(t => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={`uploads-tab ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'bills' ? '⚡ Bills' : t === 'plan' ? '🗓️ Action Plan' : '📊 History'}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="uploads-body">
          {tab === 'bills' && <BillsTab sessionId={sessionId} />}
          {tab === 'plan' && <ActionPlanTab sessionId={sessionId} />}
          {tab === 'history' && <HistoryTab sessionId={sessionId} />}
        </div>
      </div>
    </div>
  )
}

MyUploads.propTypes = { onClose: PropTypes.func.isRequired }
