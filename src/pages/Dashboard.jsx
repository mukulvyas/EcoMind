import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { Cloud, Zap, Leaf, Truck, CheckCircle2, Circle, Bot, TrendingUp } from 'lucide-react'
import AppHeader from '../components/AppHeader'
import BottomNav from '../components/BottomNav'
import './Dashboard.css'

const TREND_DATA = [
  { week: 'W1', co2: 48 }, { week: 'W2', co2: 52 }, { week: 'W3', co2: 44 },
  { week: 'W4', co2: 56 }, { week: 'W5', co2: 40 }, { week: 'W6', co2: 38 },
  { week: 'W7', co2: 35 }, { week: 'W8', co2: 32 },
]

const DONUT_DATA = [
  { name: 'Transport', value: 42, color: '#1D9E75' },
  { name: 'Home Energy', value: 31, color: '#68dbae' },
  { name: 'Food', value: 27, color: '#b7f0d6' },
]

const ACTIONS = [
  {
    id: 1,
    Icon: Truck,
    title: 'Switch to Express Bus',
    desc: 'Replace Tuesday car commute',
    saving: '~1.2 kg CO₂ / week',
    done: true,
  },
  {
    id: 2,
    Icon: Zap,
    title: 'Reduce AC by 2°C',
    desc: 'Set thermostat to 26°C',
    saving: '~0.8 kg CO₂ / week',
    done: false,
  },
  {
    id: 3,
    Icon: Leaf,
    title: 'Meatless Mondays',
    desc: 'One plant-based day per week',
    saving: '~0.6 kg CO₂ / week',
    done: false,
  },
]

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="chart-tooltip">
        <p className="tooltip-label">{label}</p>
        <p className="tooltip-value">{payload[0].value} kg</p>
      </div>
    )
  }
  return null
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState('Quarter')
  const [actions, setActions] = useState(ACTIONS)

  const toggleAction = (id) => {
    setActions(prev => prev.map(a => a.id === id ? { ...a, done: !a.done } : a))
  }

  const completed = actions.filter(a => a.done).length

  return (
    <div className="app-shell">
      <AppHeader rightContent={
        <div className="dash-avatar">
          <span style={{ fontSize: 18 }}>👤</span>
        </div>
      } />

      <div className="page-content">
        <section className="dash-top">
          <h1 className="dash-title">Earth Guardian Dashboard</h1>
          <p className="dash-sub">Welcome back. Your efforts have saved <strong>12kg</strong> of CO₂ this week.</p>
          <div className="streak-badge">
            🔥 5-day green streak!
          </div>
        </section>

        <section className="dash-content">

          {/* Metric Cards Row */}
          <div className="metric-grid">

            {/* Total CO2 */}
            <div className="card metric-card animate-fade-up">
              <div className="metric-header">
                <div>
                  <span className="metric-label">TOTAL CO₂</span>
                  <div className="metric-value">2.4 <span className="metric-unit">tonnes/yr</span></div>
                </div>
                <div className="metric-icon-circle">
                  <Cloud size={20} />
                </div>
              </div>
              <span className="pill pill-primary" style={{ fontSize: 11 }}>
                ↓ 15% below regional average
              </span>
            </div>

            {/* Biggest Category */}
            <div className="card metric-card animate-fade-up" style={{ animationDelay: '0.05s' }}>
              <span className="metric-label">BIGGEST CATEGORY</span>
              <div className="metric-value">Transport</div>
              <div className="bar-chart-mini">
                {[
                  { label: 'Transport', pct: 75 },
                  { label: 'Home Energy', pct: 50 },
                  { label: 'Food', pct: 32 },
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

            {/* Actions Completed */}
            <div className="card metric-card animate-fade-up" style={{ animationDelay: '0.1s' }}>
              <div className="metric-header">
                <div>
                  <span className="metric-label">ACTIONS COMPLETED</span>
                  <div className="metric-value">
                    {completed} <span className="metric-unit">this month</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} className={`action-dot ${i < completed ? 'active' : ''}`} />
                  ))}
                </div>
              </div>
              <p className="metric-note">42% of total impact</p>
            </div>

            {/* CO2 Saved */}
            <div className="card metric-card animate-fade-up" style={{ animationDelay: '0.15s' }}>
              <div className="metric-header">
                <div>
                  <span className="metric-label">CO₂ SAVED</span>
                  <div className="metric-value">124 <span className="metric-unit">kg total</span></div>
                </div>
                <div className="metric-icon-circle metric-icon-green">
                  <Leaf size={20} />
                </div>
              </div>
              <span className="pill pill-primary" style={{ fontSize: 11 }}>
                ↑ 8% more than last week
              </span>
            </div>
          </div>

          {/* Trend Chart */}
          <div className="card chart-card animate-fade-up" style={{ animationDelay: '0.2s' }}>
            <div className="chart-header">
              <div>
                <h3 className="chart-title">Footprint Trend</h3>
                <p className="chart-sub">Weekly performance (8 weeks)</p>
              </div>
              <div className="period-toggle">
                {['Month', 'Quarter'].map(p => (
                  <button
                    key={p}
                    className={`period-btn ${period === p ? 'active' : ''}`}
                    onClick={() => setPeriod(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ width: '100%', height: '180px', minHeight: '180px' }}>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={TREND_DATA} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
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
                    <Pie
                      data={DONUT_DATA}
                      cx={70}
                      cy={70}
                      innerRadius={40}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                      startAngle={90}
                      endAngle={-270}
                    >
                      {DONUT_DATA.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                <div className="donut-center-label">
                  <span className="donut-pct">42%</span>
                  <span className="donut-name">Transport</span>
                </div>
              </div>

              <div className="donut-legend">
                {DONUT_DATA.map(({ name, value, color }) => (
                  <div key={name} className="legend-row">
                    <span className="legend-dot" style={{ background: color }} />
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

            <div className="action-list">
              {actions.map(({ id, Icon, title, desc, saving, done }) => (
                <div key={id} className="action-item">
                  <div className="action-icon-circle">
                    <Icon size={16} />
                  </div>
                  <div className="action-text">
                    <span className="action-title">{title}</span>
                    <span className="action-desc">{desc}</span>
                    <span className="action-saving">{saving}</span>
                  </div>
                  <button
                    className={`action-check ${done ? 'done' : ''}`}
                    onClick={() => toggleAction(id)}
                  >
                    {done ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* AI Insight Card */}
          <div className="card-dark ai-insight-card animate-fade-up" style={{ animationDelay: '0.35s' }}>
            <div className="ai-insight-icon">
              <Bot size={18} />
              <span>EcoCoach Insight</span>
            </div>
            <p className="ai-insight-text">
              "I've noticed your transit emissions peaked on Tuesday. Switching to the express bus
              could save you 15 minutes and 1.2kg of CO₂."
            </p>
            <button className="btn btn-outline-white" style={{ padding: '10px 20px', fontSize: 13 }}
              onClick={() => navigate('/ai-coach')}>
              Talk to EcoCoach
            </button>
          </div>

        </section>
      </div>

      <BottomNav />
    </div>
  )
}
