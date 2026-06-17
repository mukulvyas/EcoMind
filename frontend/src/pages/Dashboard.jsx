import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { Cloud, Zap, Leaf, Truck, CheckCircle2, Circle, Bot, Plus, Clock, Database } from 'lucide-react'
import PropTypes from 'prop-types'
import AppHeader from '../components/AppHeader'
import BottomNav from '../components/BottomNav'
import GovtDataCard from '../components/GovtDataCard'
import BillUploadModal from '../components/BillUploadModal'
import { MetricCardSkeleton } from '../components/SkeletonLoader'
import MyUploads from './MyUploads'
import { showToast } from '../components/Toast'
import { useFootprint } from '../hooks/useFootprint'
import { formatShortDate, formatCO2 } from '../utils/formatters'
import { calculateVsAverage } from '../utils/carbonCalculations'
import { fetchActiveActionPlan, toggleActionItem } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import './Dashboard.css'
import '../components/BillUploadModal.css'
import '../components/GovtDataCard.css'

// Static mock actions (these can be moved to Firestore in v2)
const INITIAL_ACTIONS = [
  { id: 1, Icon: Truck, title: 'Switch to Express Bus', desc: 'Replace Tuesday car commute', saving: '~1.2 kg CO₂ / week', done: true },
  { id: 2, Icon: Zap, title: 'Reduce AC by 2°C', desc: 'Set thermostat to 26°C', saving: '~0.8 kg CO₂ / week', done: false },
  { id: 3, Icon: Leaf, title: 'Meatless Mondays', desc: 'One plant-based day per week', saving: '~0.6 kg CO₂ / week', done: false },
]

const DONUT_COLORS = ['#1D9E75', '#68dbae', '#b7f0d6']

// ─── Sub-components ──────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="chart-tooltip">
        <p className="tooltip-label">{label}</p>
        <p className="tooltip-value">{payload[0].value}T CO₂</p>
      </div>
    )
  }
  return null
}

CustomTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.array,
  label: PropTypes.string,
}

function HistoryCard({ entry, index }) {
  return (
    <div className="history-card animate-fade-up" style={{ animationDelay: `${index * 0.05}s` }}>
      <div className="history-card-left">
        <div className="history-dot" style={{ background: index === 0 ? 'var(--primary)' : 'var(--surface-container-high)' }} />
        <div>
          <span className="history-date">{formatShortDate(entry.createdAt)}</span>
          <span className="history-value">{entry.totalCO2}T CO₂/yr</span>
        </div>
      </div>
      <span
        className="pill"
        style={{
          background: entry.totalCO2 <= 2 ? 'var(--primary-container)' : 'rgba(249,115,22,0.12)',
          color: entry.totalCO2 <= 2 ? 'var(--primary)' : '#f97316',
          fontSize: 11,
        }}
      >
        {entry.totalCO2 <= 2 ? '↓ Good' : '↑ High'}
      </span>
    </div>
  )
}

HistoryCard.propTypes = {
  entry: PropTypes.shape({
    createdAt: PropTypes.any,
    totalCO2: PropTypes.number,
  }).isRequired,
  index: PropTypes.number.isRequired,
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, signInWithGoogle, signOut, isAnonymous } = useAuth()
  const userProfile = user ? { displayName: user.displayName, photoURL: user.photoURL } : { displayName: 'Eco Citizen', photoURL: null }
  const { footprints, latestFootprint, loading: footprintLoading } = useFootprint()

  const [period, setPeriod] = useState('Quarter')
  const [actions, setActions] = useState(INITIAL_ACTIONS)
  const [showHistory, setShowHistory] = useState(false)
  const [showBillModal, setShowBillModal] = useState(false)
  const [showMyUploads, setShowMyUploads] = useState(false)

  const [dbPlan, setDbPlan] = useState(null)
  const [claiming, setClaiming] = useState(null)
  const [claimText, setClaimText] = useState('')

  const fetchPlan = useCallback(() => {
    fetchActiveActionPlan().then(res => {
      if (res.plan) {
        try {
          const planData = typeof res.plan === 'string' ? JSON.parse(res.plan) : res.plan
          if (planData && planData.actions) {
            setDbPlan(planData)
          }
        } catch(e) {}
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    fetchPlan()
  }, [fetchPlan])

  const handleToggleAction = async (actionItem) => {
    if (dbPlan) {
      if (!actionItem.done && !claiming) {
        setClaiming(actionItem.day)
        setClaimText('')
        return
      }
      setClaiming(null)
      try {
        const completed = !actionItem.done
        const claim = completed ? claimText : ''
        const data = await toggleActionItem(dbPlan.plan_id, actionItem.day, completed, claim)
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
      } catch (err) {
        showToast('Something went wrong, try again.', 'error')
      }
    } else {
      setActions(prev => prev.map(a => a.id === actionItem.id ? { ...a, done: !a.done } : a))
    }
  }

  const completed = useMemo(() => {
    if (dbPlan) {
      return dbPlan.completed_actions ?? 0
    }
    return actions.filter(a => a.done).length
  }, [dbPlan, actions])

  const co2SavedDisplay = useMemo(() => {
    if (dbPlan) {
      return `${dbPlan.co2_saved_so_far_kg ?? 0}`
    }
    return '124'
  }, [dbPlan])

  const displayActions = useMemo(() => {
    if (dbPlan && dbPlan.actions && dbPlan.actions.length > 0) {
      return dbPlan.actions.slice(0, 3).map(a => ({
        id: a.day,
        day: a.day,
        category: a.category,
        Icon: a.category === 'travel' ? Truck : a.category === 'energy' ? Zap : Leaf,
        title: a.action,
        desc: `Day ${a.day} Challenge`,
        saving: `↓ ${a.co2_saving_kg} kg CO₂`,
        done: !!a.completed
      }))
    }
    return INITIAL_ACTIONS
  }, [dbPlan])

  // Build chart data from real Firestore footprints, fall back to mock
  const chartData = useMemo(() => {
    if (footprints.length >= 2) {
      return [...footprints].reverse().map((f, i) => ({
        week: formatShortDate(f.createdAt) || `W${i + 1}`,
        co2: Math.round((f.totalCO2 ?? 0) * 100) / 100,
      }))
    }
    // Fallback mock data if user has < 2 entries
    return [
      { week: 'W1', co2: 2.8 }, { week: 'W2', co2: 3.1 }, { week: 'W3', co2: 2.6 },
      { week: 'W4', co2: 3.3 }, { week: 'W5', co2: 2.4 }, { week: 'W6', co2: 2.3 },
      { week: 'W7', co2: 2.1 }, { week: 'W8', co2: 1.9 },
    ]
  }, [footprints])

  const donutData = useMemo(() => {
    if (!latestFootprint) return [
      { name: 'Transport', value: 42 }, { name: 'Home Energy', value: 31 }, { name: 'Food', value: 27 },
    ]
    const total = latestFootprint.totalCO2 || 1
    return [
      { name: 'Transport', value: Math.round((latestFootprint.travel / total) * 100) },
      { name: 'Home Energy', value: Math.round((latestFootprint.energy / total) * 100) },
      { name: 'Food', value: Math.round((latestFootprint.food / total) * 100) },
    ]
  }, [latestFootprint])

  const vsAvg = latestFootprint ? calculateVsAverage(latestFootprint.totalCO2) : -15
  const totalCO2Display = latestFootprint ? formatCO2(latestFootprint.totalCO2) : '2.4T'

  return (
    <div className="app-shell">
      <AppHeader rightContent={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="my-uploads-btn"
            onClick={() => setShowMyUploads(true)}
            aria-label="View my uploads and data"
            title="My Data"
          >
            <Database size={16} />
            <span>My Data</span>
          </button>
          {isAnonymous ? (
            <button onClick={signInWithGoogle} className="btn btn-outline" style={{ padding: '4px 10px', fontSize: 12, display: 'flex', gap: 4, alignItems: 'center' }}>
              <span role="img" aria-label="google">G</span> Sign in
            </button>
          ) : (
            <button onClick={signOut} className="btn btn-outline" style={{ padding: '4px 10px', fontSize: 12 }}>
              Sign out
            </button>
          )}
          {userProfile?.photoURL ? (
            <img
              src={userProfile.photoURL}
              alt={userProfile.displayName ?? 'User avatar'}
              className="dash-avatar-img"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="dash-avatar" aria-label="User profile">
              <span style={{ fontSize: 18 }}>👤</span>
            </div>
          )}
        </div>
      } />

      <div className="page-content">
        <section className="dash-top">
          <h1 className="dash-title">
            Earth Guardian Dashboard
            {!isAnonymous && <span style={{ marginLeft: 6, color: '#1D9E75', fontSize: 18 }} title="Verified Google Account">✓</span>}
          </h1>
          <p className="dash-sub">
            Welcome back{userProfile?.displayName ? `, ${userProfile.displayName.split(' ')[0]}` : ''}. 
            {' '}Your efforts have saved <strong>12kg</strong> of CO₂ this week.
          </p>
          <div className="streak-badge" role="status" aria-label="5-day green streak">
            🔥 5-day green streak!
          </div>
        </section>

        <section className="dash-content">

          {/* Metric Cards */}
          <div className="metric-grid" aria-label="Key metrics">
            {footprintLoading ? (
              <>
                <MetricCardSkeleton />
                <MetricCardSkeleton />
                <MetricCardSkeleton />
                <MetricCardSkeleton />
              </>
            ) : (
              <>
                <div className="card metric-card animate-fade-up">
                  <div className="metric-header">
                    <div>
                      <span className="metric-label">TOTAL CO₂</span>
                      <div className="metric-value">
                        {latestFootprint?.totalCO2 ?? '2.4'}{' '}
                        <span className="metric-unit">tonnes/yr</span>
                      </div>
                    </div>
                    <div className="metric-icon-circle"><Cloud size={20} aria-hidden="true" /></div>
                  </div>
                  <span className="pill pill-primary" style={{ fontSize: 11 }}>
                    {vsAvg > 0 ? '↓' : '↑'} {Math.abs(vsAvg)}% {vsAvg > 0 ? 'below' : 'above'} regional avg
                  </span>
                </div>

                <div className="card metric-card animate-fade-up" style={{ animationDelay: '0.05s' }}>
                  <span className="metric-label">BIGGEST CATEGORY</span>
                  <div className="metric-value">Transport</div>
                  <div className="bar-chart-mini">
                    {[
                      { label: 'Transport', pct: donutData[0]?.value ?? 42 },
                      { label: 'Home Energy', pct: donutData[1]?.value ?? 31 },
                      { label: 'Food', pct: donutData[2]?.value ?? 27 },
                    ].map(({ label, pct }) => (
                      <div key={label} className="bar-mini-row">
                        <span className="bar-mini-label">{label}</span>
                        <div className="bar-mini-track">
                          <div className="bar-mini-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card metric-card animate-fade-up" style={{ animationDelay: '0.1s' }}>
                  <div className="metric-header">
                    <div>
                      <span className="metric-label">ACTIONS COMPLETED</span>
                      <div className="metric-value">{completed} <span className="metric-unit">this month</span></div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} className={`action-dot ${i < completed ? 'active' : ''}`} aria-hidden="true" />
                      ))}
                    </div>
                  </div>
                  <p className="metric-note">42% of total impact</p>
                </div>

                <div className="card metric-card animate-fade-up" style={{ animationDelay: '0.15s' }}>
                  <div className="metric-header">
                    <div>
                      <span className="metric-label">CO₂ SAVED</span>
                      <div className="metric-value">{co2SavedDisplay} <span className="metric-unit">kg total</span></div>
                    </div>
                    <div className="metric-icon-circle metric-icon-green">
                      <Leaf size={20} aria-hidden="true" />
                    </div>
                  </div>
                  <span className="pill pill-primary" style={{ fontSize: 11 }}>↑ 8% more than last week</span>
                </div>
              </>
            )}
          </div>

          {/* History Tab */}
          {footprints.length > 0 && (
            <div className="card animate-fade-up" style={{ animationDelay: '0.18s' }}>
              <div className="action-plan-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock size={16} style={{ color: 'var(--primary)' }} aria-hidden="true" />
                  <h3 className="chart-title" style={{ margin: 0 }}>Footprint History</h3>
                </div>
                <button
                  className="action-view-all"
                  onClick={() => setShowHistory(v => !v)}
                  aria-expanded={showHistory}
                >
                  {showHistory ? 'Show less' : `See all ${footprints.length}`}
                </button>
              </div>
              <div className="history-list">
                {(showHistory ? footprints : footprints.slice(0, 3)).map((entry, idx) => (
                  <HistoryCard key={entry.id} entry={entry} index={idx} />
                ))}
              </div>
            </div>
          )}

          {/* Trend Chart */}
          <div className="card chart-card animate-fade-up" style={{ animationDelay: '0.2s' }}>
            <div className="chart-header">
              <div>
                <h3 className="chart-title">Footprint Trend</h3>
                <p className="chart-sub">
                  {footprints.length >= 2 ? `Last ${footprints.length} entries` : 'Weekly performance (8 weeks)'}
                </p>
              </div>
              <div className="period-toggle" role="group" aria-label="Time period">
                {['Month', 'Quarter'].map(p => (
                  <button
                    key={p}
                    id={`period-${p.toLowerCase()}`}
                    className={`period-btn ${period === p ? 'active' : ''}`}
                    onClick={() => setPeriod(p)}
                    aria-pressed={period === p}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ width: '100%', height: '180px', minHeight: '180px' }}>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1D9E75" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#1D9E75" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="co2"
                    stroke="#1D9E75"
                    strokeWidth={2.5}
                    fill="url(#trendGrad)"
                    dot={{ fill: '#1D9E75', strokeWidth: 0, r: 4 }}
                    activeDot={{ r: 6, fill: '#1D9E75' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Donut Chart */}
          <div className="card chart-card animate-fade-up" style={{ animationDelay: '0.25s' }}>
            <h3 className="chart-title">Category Split</h3>
            <p className="chart-sub">Carbon source distribution</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
              <div style={{ width: '140px', height: '140px', minWidth: '140px', minHeight: '140px', position: 'relative', flexShrink: 0 }}>
                <PieChart width={140} height={140}>
                  <Pie data={donutData} cx={70} cy={70} innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value" startAngle={90} endAngle={-270}>
                    {donutData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i]} />)}
                  </Pie>
                </PieChart>
                <div className="donut-center-label">
                  <span className="donut-pct">{donutData[0]?.value ?? 42}%</span>
                  <span className="donut-name">Transport</span>
                </div>
              </div>
              <div className="donut-legend" role="list">
                {donutData.map(({ name, value }, i) => (
                  <div key={name} className="legend-row" role="listitem">
                    <span className="legend-dot" style={{ background: DONUT_COLORS[i] }} aria-hidden="true" />
                    <span className="legend-name">{name}</span>
                    <span className="legend-pct">{value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Plan */}
          <div className="card animate-fade-up" style={{ animationDelay: '0.3s' }}>
            <div className="action-plan-header">
              <h3 className="chart-title" style={{ margin: 0 }}>My Action Plan</h3>
              <button className="action-view-all" onClick={() => navigate('/ai-coach')}>View all tasks</button>
            </div>
            <div className="action-list" role="list">
              {displayActions.map((item) => (
                <div key={item.id} className={`action-item ${item.done ? 'done' : ''}`} role="listitem">
                  <div className="action-icon-circle" aria-hidden="true"><item.Icon size={16} /></div>
                  <div className="action-text" style={{ flex: 1 }}>
                    <span className="action-title">{item.title}</span>
                    <span className="action-desc">{item.desc}</span>
                    <span className="action-saving">{item.saving}</span>
                    {claiming === item.day && (
                      <div className="claim-input-wrap" style={{ marginTop: 8 }}>
                        <input
                          className="claim-input"
                          placeholder="Tell us how you did it…"
                          value={claimText}
                          onChange={e => setClaimText(e.target.value)}
                          autoFocus
                          style={{
                            width: '100%',
                            padding: '6px 10px',
                            border: '1.5px solid var(--primary)',
                            borderRadius: '8px',
                            fontSize: '12px',
                            outline: 'none',
                            background: 'var(--surface-container-low)',
                            color: 'var(--on-surface)',
                            marginBottom: '4px'
                          }}
                        />
                        <div className="claim-btns" style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="claim-btn claim-confirm"
                            onClick={() => handleToggleAction(item)}
                            style={{ flex: 1, padding: '6px', fontSize: '11px', fontWeight: '600', border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'var(--primary)', color: '#fff' }}
                          >
                            Submit
                          </button>
                          <button
                            className="claim-btn claim-cancel"
                            onClick={() => setClaiming(null)}
                            style={{ flex: 1, padding: '6px', fontSize: '11px', fontWeight: '600', border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'var(--surface-container)', color: 'var(--on-surface-variant)' }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    className={`action-check ${item.done ? 'done' : ''}`}
                    onClick={() => handleToggleAction(item)}
                    aria-label={`${item.done ? 'Unmark' : 'Complete'} action: ${item.title}`}
                    aria-pressed={item.done}
                  >
                    {item.done ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Govt Data Card */}
          <GovtDataCard userProfile={userProfile} />

          {/* AI Insight */}
          <div className="card-dark ai-insight-card animate-fade-up" style={{ animationDelay: '0.4s' }}>
            <div className="ai-insight-icon">
              <Bot size={18} aria-hidden="true" />
              <span>EcoCoach Insight</span>
            </div>
            <p className="ai-insight-text">
              "I've noticed your transit emissions peaked on Tuesday. Switching to the express bus
              could save you 15 minutes and 1.2kg of CO₂."
            </p>
            <button
              className="btn btn-outline-white"
              style={{ padding: '10px 20px', fontSize: 13 }}
              onClick={() => navigate('/ai-coach')}
              aria-label="Open AI Coach"
            >
              Talk to EcoCoach
            </button>
          </div>

        </section>
      </div>

      {/* Floating Action Button */}
      <button
        id="dashboard-fab"
        className="fab-btn"
        onClick={() => setShowBillModal(true)}
        aria-label="Upload utility bill for analysis"
        title="Analyze a bill"
      >
        <Plus size={24} aria-hidden="true" />
      </button>

      {/* Bill Upload Modal */}
      <BillUploadModal
        isOpen={showBillModal}
        onClose={() => setShowBillModal(false)}
        onAnalysisComplete={(result) => {
          setShowBillModal(false)
          if (result?.verification) {
            const v = result.verification
            if (v.status === 'verified') {
              showToast(`✓ Bill verified — ${Number(v.corrected_co2_kg || 0).toFixed(1)}kg CO₂ found`, 'success')
            } else if (v.status === 'suspicious') {
              showToast('⚠ Bill data seems unusual — check the details', 'warning')
            } else {
              showToast('Bill uploaded but could not be fully analyzed.', 'warning')
            }
          } else {
            showToast('Bill analyzed and saved!', 'success')
          }
        }}
      />

      {/* My Uploads Modal */}
      {showMyUploads && <MyUploads onClose={() => setShowMyUploads(false)} />}

      <BottomNav />
    </div>
  )
}
