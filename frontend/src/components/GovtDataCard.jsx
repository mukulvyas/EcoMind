import PropTypes from 'prop-types'
import { useState, useEffect, useCallback } from 'react'
import { Zap, Wind, Sun, Globe, Droplets, Fuel, RefreshCw } from 'lucide-react'
import { getGovtData } from '../services/api'
import { GovtDataSkeleton } from './SkeletonLoader'
import './GovtDataCard.css'

// ─── AQI color mapping (matches backend logic) ────────────────────────────
function getAqiStyle(aqi) {
  if (!aqi || aqi === 'N/A') return { color: '#eab308', bg: '#fef9c3', label: 'Moderate' }
  const n = parseInt(aqi)
  if (n < 50)  return { color: '#10b981', bg: '#ecfdf5', label: 'Good' }
  if (n < 100) return { color: '#eab308', bg: '#fef9c3', label: 'Moderate' }
  if (n < 150) return { color: '#f97316', bg: '#fff7ed', label: 'Sensitive' }
  if (n < 200) return { color: '#ef4444', bg: '#fee2e2', label: 'Unhealthy' }
  return { color: '#9333ea', bg: '#f3e8ff', label: 'Very Unhealthy' }
}

// ─── Source tag ────────────────────────────────────────────────────────────
function SourceTag({ text }) {
  return (
    <span style={{
      fontSize: '9px',
      color: 'var(--on-surface-variant)',
      opacity: 0.65,
      display: 'block',
      marginTop: '6px',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
    }}>
      {text}
    </span>
  )
}
SourceTag.propTypes = { text: PropTypes.string.isRequired }

// ─── Panel wrapper ─────────────────────────────────────────────────────────
function Panel({ iconBg, iconColor, Icon, label, loading, badge, children }) {
  return (
    <div className="govt-panel">
      <div className="govt-panel-icon" style={{ background: iconBg }}>
        <Icon size={14} style={{ color: iconColor }} />
      </div>
      <div className="govt-panel-content">
        <div className="govt-panel-header-row">
          <span className="govt-panel-label">{label}</span>
          {badge}
        </div>
        {loading ? <GovtDataSkeleton /> : children}
      </div>
    </div>
  )
}
Panel.propTypes = {
  iconBg: PropTypes.string.isRequired,
  iconColor: PropTypes.string.isRequired,
  Icon: PropTypes.elementType.isRequired,
  label: PropTypes.string.isRequired,
  loading: PropTypes.bool,
  badge: PropTypes.node,
  children: PropTypes.node,
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function GovtDataCard({ userProfile }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]  = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const city  = userProfile?.city  ?? 'Bengaluru'
  const state = userProfile?.state ?? 'Karnataka'

  const load = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)

    const cacheKey = `ecomind_govt_v2_${city}`
    if (!forceRefresh) {
      const cached = localStorage.getItem(cacheKey)
      if (cached) {
        try {
          const { ts, payload } = JSON.parse(cached)
          if (Date.now() - ts < 3_600_000) { // 1-hour TTL
            setData(payload)
            setLoading(false)
            setRefreshing(false)
            return
          }
        } catch { /* stale / corrupt — re-fetch */ }
      }
    }

    try {
      const result = await getGovtData(city, state)
      if (result) {
        setData(result)
        localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), payload: result }))
      }
    } catch {
      setError('Failed to load climate data.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [city, state])

  useEffect(() => { load() }, [load])

  // ── Derived values ────────────────────────────────────────────────────
  const aqiVal   = data?.aqi?.aqi ?? 89
  const aqiStyle = getAqiStyle(aqiVal)

  const india   = data?.national?.india_per_capita_co2_2023  ?? 1.9
  const world   = data?.national?.global_average_per_capita  ?? 4.7
  const usa     = data?.national?.us_per_capita              ?? 14.9
  const maxBar  = usa + 1

  const petrol  = data?.fuel_prices?.petrol_per_litre  ?? data?.fuel_prices?.petrol  ?? '—'
  const diesel  = data?.fuel_prices?.diesel_per_litre  ?? data?.fuel_prices?.diesel  ?? '—'
  const lpg     = data?.fuel_prices?.lpg_per_cylinder  ?? data?.fuel_prices?.lpg     ?? '—'

  const gridFactor = data?.grid?.factor_kg_per_kwh ?? '—'
  const gridTrend  = data?.grid?.trend ?? ''

  const temp      = data?.weather?.temperature          ?? '—'
  const weatherTip = data?.weather?.tip ?? '—'

  const crudeMmt  = data?.petroleum?.crude_processed_mmt ?? 21.4
  const perPerson = data?.petroleum?.per_person_kg_co2   ?? 48.6

  return (
    <div className="card govt-card animate-fade-up">
      {/* Header */}
      <div className="govt-header">
        <div className="govt-title-group">
          <span className="govt-live-dot" aria-hidden="true" />
          <h3 className="chart-title" style={{ margin: 0 }}>India Climate Intelligence</h3>
        </div>
        <button
          className="govt-refresh-btn"
          onClick={() => load(true)}
          disabled={refreshing}
          aria-label="Refresh climate data"
        >
          <RefreshCw size={14} className={refreshing ? 'spinning' : ''} />
        </button>
      </div>

      {error && <div className="govt-error" role="alert">{error}</div>}

      <div className="govt-panels">

        {/* ── Panel 1: Grid Factor ─────────────────────────────────── */}
        <Panel iconBg="#fef3c7" iconColor="#f59e0b" Icon={Zap}
               label={`Your Grid — ${state}`} loading={loading}>
          <span className="govt-panel-value">
            {gridFactor} kg CO₂/kWh
          </span>
          {gridTrend && (
            <span className="govt-panel-meta" style={{ color: '#10b981' }}>
              {gridTrend}
            </span>
          )}
          <SourceTag text="CEA 2023-24" />
        </Panel>

        {/* ── Panel 2: Air Quality ─────────────────────────────────── */}
        <Panel iconBg={aqiStyle.bg} iconColor={aqiStyle.color} Icon={Wind}
               label={`Air Quality — ${city}`} loading={loading}>
          <span className="govt-panel-value">
            AQI {aqiVal}&nbsp;
            <span className="govt-aqi-chip"
                  style={{ background: aqiStyle.bg, color: aqiStyle.color }}>
              {aqiStyle.label}
            </span>
          </span>
          <span className="govt-panel-meta">
            Main pollutant: {data?.aqi?.pollutant ?? 'PM2.5'}
          </span>
          <span className="govt-panel-meta" style={{ fontSize: '11px', marginTop: '2px' }}>
            {data?.aqi?.health_tip ?? ''}
          </span>
          <SourceTag text="CPCB 2023" />
        </Panel>

        {/* ── Panel 3: Weather Tip ─────────────────────────────────── */}
        <Panel
          iconBg="#fce7f3" iconColor="#ec4899" Icon={Sun}
          label={`Today — ${temp}°C`}
          loading={loading}
          badge={
            <span className="govt-live-badge">LIVE</span>
          }
        >
          <span className="govt-panel-value">{temp}°C</span>
          <span className="govt-panel-meta">{weatherTip}</span>
          <SourceTag text="Open-Meteo Live" />
        </Panel>

        {/* ── Panel 4: India vs World ───────────────────────────────── */}
        <Panel iconBg="#dbeafe" iconColor="#3b82f6" Icon={Globe}
               label="India vs World" loading={loading}>
          {[
            { label: 'India',  val: india, color: '#10b981' },
            { label: 'Global', val: world, color: '#f97316' },
            { label: 'USA',    val: usa,   color: '#ef4444' },
          ].map(({ label: lbl, val, color }) => (
            <div key={lbl} className="govt-budget-row" style={{ marginBottom: '4px' }}>
              <span className="govt-budget-label">{lbl}</span>
              <div className="govt-budget-track">
                <div className="govt-budget-fill"
                     style={{ width: `${(val / maxBar) * 100}%`, background: color }} />
              </div>
              <span className="govt-budget-val">{val}T</span>
            </div>
          ))}
          <SourceTag text="MoEFCC NDC 2023" />
        </Panel>

        {/* ── Panel 5: Petroleum ───────────────────────────────────── */}
        <Panel iconBg="#f0fdf4" iconColor="#1D9E75" Icon={Droplets}
               label="India Oil & Carbon" loading={loading}>
          <span className="govt-panel-value">{crudeMmt} MMT crude processed</span>
          <span className="govt-panel-meta">
            Your share ~{perPerson} kg CO₂ this month
          </span>
          <SourceTag text="PPAC MoPNG" />
        </Panel>

        {/* ── Panel 6: Fuel Prices ─────────────────────────────────── */}
        <Panel iconBg="#e0e7ff" iconColor="#6366f1" Icon={Fuel}
               label={`Fuel in ${city}`} loading={loading}>
          <span className="govt-panel-value" style={{ fontSize: '13px' }}>
            Petrol ₹{petrol}/L &nbsp;·&nbsp; Diesel ₹{diesel}/L
          </span>
          <span className="govt-panel-meta">
            LPG ₹{lpg}/cylinder
          </span>
          <span className="govt-panel-meta" style={{ marginTop: '2px' }}>
            1L petrol = 2.31 kg CO₂
          </span>
          {data?.fuel_prices?.insight && (
            <span className="govt-panel-meta" style={{ marginTop: '2px', fontStyle: 'italic' }}>
              {data.fuel_prices.insight}
            </span>
          )}
          <SourceTag text="PPAC June 2024" />
        </Panel>

      </div>

      <p className="govt-source-note">
        Sources: CEA · CPCB · MoEFCC · Open-Meteo · PPAC · Live Data
      </p>
    </div>
  )
}

GovtDataCard.propTypes = {
  userProfile: PropTypes.shape({
    city: PropTypes.string,
    state: PropTypes.string,
  }),
}
