import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Leaf, ChevronRight, Car, Plane, Bus, Flame, Zap, Check, Plus } from 'lucide-react'
import PropTypes from 'prop-types'
import AppHeader from '../components/AppHeader'
import BottomNav from '../components/BottomNav'
import BillUploadModal from '../components/BillUploadModal'
import { useFootprint } from '../hooks/useFootprint'
import { calculateTravelCO2, calculateFoodCO2, calculateEnergyCO2 } from '../utils/carbonCalculations'
import '../components/BillUploadModal.css'
import './Calculator.css'

const TRANSPORT_LABELS = ['Never', 'Rarely', 'Weekly', 'Daily', 'Always']

const FOOD_OPTIONS = [
  { value: 'vegan', label: 'Vegan', emoji: '🥦', co2: 0.6 },
  { value: 'vegetarian', label: 'Vegetarian', emoji: '🥗', co2: 0.9 },
  { value: 'pescetarian', label: 'Pescetarian', emoji: '🐟', co2: 1.4 },
  { value: 'meat-eater', label: 'Meat-eater', emoji: '🍖', co2: 2.5 },
]

const ENERGY_OPTIONS = [
  { value: 'renewable', label: 'Renewable', emoji: '☀️' },
  { value: 'mixed', label: 'Mixed Grid', emoji: '⚡' },
  { value: 'fossil', label: 'Fossil Fuels', emoji: '🏭' },
]

export default function Calculator() {
  const navigate = useNavigate()
  const { saveFootprint } = useFootprint()
  const [step, setStep] = useState(1)
  const [showResults, setShowResults] = useState(false)
  const [showBillModal, setShowBillModal] = useState(false)
  const [saving, setSaving] = useState(false)

  // Set page title for SEO and problem-statement traceability
  useEffect(() => { document.title = 'Carbon Calculator | EcoMind' }, [])

  // Form State
  const [carKm, setCarKm] = useState('')
  const [flights, setFlights] = useState('')
  const [transport, setTransport] = useState(3) // 0-4
  const [diet, setDiet] = useState('')
  const [localFoodPct, setLocalFoodPct] = useState(2)
  const [energySource, setEnergySource] = useState('')
  const [homeSize, setHomeSize] = useState('')
  const [renewableToggle, setRenewableToggle] = useState(false)
  const [score, setScore] = useState(null)

  const goNext = () => {
    if (step < 3) setStep(step + 1)
    else computeScore()
  }

  const goBack = () => {
    if (step > 1) setStep(step - 1)
  }

  const computeScore = async () => {
    setSaving(true)
    try {
      const payload = {
        car_km: parseFloat(carKm) || 80.0,
        flights: flights === '3-5' ? 4 : flights === '6+' ? 7 : 1,
        diet_type: diet === 'vegan' ? 'vegan' : diet === 'pescetarian' ? 'mixed' : diet === 'meat-eater' ? 'meat-heavy' : 'vegetarian',
        electricity_bill: parseFloat(homeSize) || 2500.0,
        ac_usage: false,
        cooking_fuel: 'lpg',
        online_orders: 2
      }
      
      const res = await saveFootprint(payload)
      if (res && res.total_co2 !== undefined) {
        setScore(res.total_co2)
        // Store in localStorage for quick reference
        const localData = {
          totalCO2: res.total_co2,
          travel: res.travel,
          food: res.food,
          energy: res.energy,
          shopping: res.shopping,
          carKm: parseFloat(carKm) || 80.0,
          flights,
          transport: TRANSPORT_LABELS[transport],
          diet: diet || 'vegetarian',
          energySource: renewableToggle ? 'renewable' : energySource || 'mixed',
        }
        localStorage.setItem('ecomind_footprint', JSON.stringify(localData))
      } else {
        throw new Error('Invalid calculation response')
      }
    } catch (err) {
      console.warn('Backend calculation failed, using local fallback:', err)
      // Local calculation fallback
      const travelData = { carKm: parseFloat(carKm) || 80, flights: flights || '0-2', transportFreq: transport }
      const foodData = { diet: diet || 'vegetarian' }
      const energyData = { electricityUnits: parseFloat(homeSize) / 6 || 150, energySource: renewableToggle ? 'renewable' : energySource || 'mixed', solarEnabled: renewableToggle }

      const travel = calculateTravelCO2(travelData)
      const food = calculateFoodCO2(foodData)
      const energy = calculateEnergyCO2(energyData)
      const total = Math.round((travel + food + energy) * 10) / 10
      setScore(total)

      const localData = {
        totalCO2: total,
        travel,
        food,
        energy,
        shopping: 0.18,
        carKm: travelData.carKm,
        flights,
        transport: TRANSPORT_LABELS[transport],
        diet: diet || 'vegetarian',
        energySource: energyData.energySource,
      }
      localStorage.setItem('ecomind_footprint', JSON.stringify(localData))
    } finally {
      setSaving(false)
      setShowResults(true)
    }
  }

  const STEP_LABELS = ['Travel', 'Food', 'Energy']

  return (
    <div className="app-shell">
      <AppHeader />

      <div className="page-content">
        {/* Hero */}
        <section className="calc-hero">
          <div className="calc-hero-bg" />
          <div className="calc-hero-content animate-fade-up">
            <h1 className="calc-hero-title">
              Know your impact.<br />Change your future.
            </h1>
            <p className="calc-hero-sub">
              Discover your carbon footprint with precision sustainability tools designed for the modern climate advocate.
            </p>
          </div>
        </section>

        {/* Form Card */}
        <section className="calc-form-section">
          <div className="card calc-form-card animate-fade-up" style={{ animationDelay: '0.1s' }}>

            {!showResults ? (
              <>
                {/* Step Indicator */}
                <div className="step-indicator" role="list" aria-label="Calculator steps">
                  {STEP_LABELS.map((label, i) => {
                    const num = i + 1
                    const isDone = step > num
                    const isActive = step === num
                    return (
                      <div key={num} className="step-indicator-row" role="listitem">
                        <button
                          className={`step-circle ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
                          onClick={() => num < step && setStep(num)}
                          style={{ cursor: num < step ? 'pointer' : 'default' }}
                          aria-current={isActive ? 'step' : undefined}
                          aria-label={`Step ${num}: ${label}${isDone ? ' (completed)' : isActive ? ' (current)' : ''}`}
                          aria-disabled={num > step}
                        >
                          {isDone ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : num}
                        </button>
                        <span className={`step-label ${isActive ? 'active' : isDone ? 'done' : ''}`}>
                          {label}
                        </span>
                        {i < 2 && <div className={`step-line ${step > num ? 'done' : ''}`} aria-hidden="true" />}
                      </div>
                    )
                  })}
                </div>

                {/* Step 1: Travel */}
                {step === 1 && (
                  <div className="step-content animate-fade-up">
                    <div className="form-group">
                      <label className="form-label">
                        <Car size={14} /> Car Usage (km / week)
                      </label>
                      <div className="input-wrap">
                        <input
                          id="car-km"
                          className="input-field"
                          type="number"
                          placeholder="e.g. 150"
                          value={carKm}
                          onChange={e => setCarKm(e.target.value)}
                          style={{ paddingRight: '44px' }}
                        />
                        <span className="input-suffix">km</span>
                      </div>
                      <p className="input-hint">Average user: 80km / week</p>
                    </div>

                    <div className="form-group">
                      <label className="form-label" id="flights-label">
                        <Plane size={14} aria-hidden="true" /> Flights / year
                      </label>
                      <div className="toggle-group" role="group" aria-labelledby="flights-label">
                        {['0-2', '3-5', '6+'].map(opt => (
                          <button
                            key={opt}
                            className={`toggle-btn ${flights === opt ? 'selected' : ''}`}
                            onClick={() => setFlights(opt)}
                            aria-pressed={flights === opt}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="form-group">
                      <div className="slider-header">
                        <label className="form-label" style={{ margin: 0 }} id="transport-label">
                          <Bus size={14} aria-hidden="true" /> Public Transport Frequency
                        </label>
                        <span className="slider-value" aria-live="polite">{TRANSPORT_LABELS[transport]}</span>
                      </div>
                      <input
                        id="transport-slider"
                        className="range-slider"
                        type="range"
                        min={0}
                        max={4}
                        step={1}
                        value={transport}
                        onChange={e => setTransport(Number(e.target.value))}
                        aria-labelledby="transport-label"
                        aria-valuemin={0}
                        aria-valuemax={4}
                        aria-valuenow={transport}
                        aria-valuetext={TRANSPORT_LABELS[transport]}
                      />
                      <div className="slider-labels" aria-hidden="true">
                        {TRANSPORT_LABELS.map(l => <span key={l}>{l}</span>)}
                      </div>
                    </div>

                    <button className="btn btn-primary btn-full" onClick={goNext}>
                      Next Step <ArrowRight size={18} />
                    </button>
                  </div>
                )}

                {/* Step 2: Food */}
                {step === 2 && (
                  <div className="step-content animate-fade-up">
                    <div className="form-group">
                      <label className="form-label" id="diet-label">Diet Type</label>
                      <div className="diet-grid" role="group" aria-labelledby="diet-label">
                        {FOOD_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            className={`diet-card ${diet === opt.value ? 'selected' : ''}`}
                            onClick={() => setDiet(opt.value)}
                            aria-pressed={diet === opt.value}
                            aria-label={`${opt.label} diet — approximately ${opt.co2} tonnes CO₂ per year`}
                          >
                            <span className="diet-emoji" aria-hidden="true">{opt.emoji}</span>
                            <span className="diet-label">{opt.label}</span>
                            <span className="diet-co2" aria-hidden="true">~{opt.co2}t CO₂</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="form-group">
                      <div className="slider-header">
                        <label className="form-label" style={{ margin: 0 }}>Local / Seasonal Food %</label>
                        <span className="slider-value">{localFoodPct * 20}%</span>
                      </div>
                      <input
                        className="range-slider"
                        type="range"
                        min={0}
                        max={5}
                        step={1}
                        value={localFoodPct}
                        onChange={e => setLocalFoodPct(Number(e.target.value))}
                      />
                      <div className="slider-labels">
                        <span>0%</span>
                        <span>50%</span>
                        <span>100%</span>
                      </div>
                    </div>

                    <div className="step-buttons">
                      <button className="btn btn-outline" onClick={goBack}>Back</button>
                      <button className="btn btn-primary" onClick={goNext}>Next Step <ArrowRight size={18} /></button>
                    </div>
                  </div>
                )}

                {/* Step 3: Energy */}
                {step === 3 && (
                  <div className="step-content animate-fade-up">
                    <div className="form-group">
                      <label className="form-label" id="energy-label"><Zap size={14} aria-hidden="true" /> Energy Source</label>
                      <div className="energy-options" role="group" aria-labelledby="energy-label">
                        {ENERGY_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            className={`energy-card ${energySource === opt.value ? 'selected' : ''}`}
                            onClick={() => setEnergySource(opt.value)}
                            aria-pressed={energySource === opt.value}
                            aria-label={`${opt.label} energy source`}
                          >
                            <span style={{ fontSize: 24 }} aria-hidden="true">{opt.emoji}</span>
                            <span>{opt.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label"><Flame size={14} /> Monthly Electricity Bill (₹)</label>
                      <div className="input-wrap">
                        <input
                          className="input-field"
                          type="number"
                          placeholder="e.g. 2500"
                          value={homeSize}
                          onChange={e => setHomeSize(e.target.value)}
                          style={{ paddingRight: '44px' }}
                        />
                        <span className="input-suffix">₹</span>
                      </div>
                    </div>

                    <div className="toggle-row">
                      <span className="form-label" style={{ margin: 0 }} id="renewable-label">Renewable Provider?</span>
                      <button
                        className={`toggle-switch ${renewableToggle ? 'on' : ''}`}
                        onClick={() => setRenewableToggle(!renewableToggle)}
                        role="switch"
                        aria-checked={renewableToggle}
                        aria-labelledby="renewable-label"
                      >
                        <span className="toggle-thumb" aria-hidden="true" />
                      </button>
                    </div>

                    <div className="step-buttons">
                      <button className="btn btn-outline" onClick={goBack}>Back</button>
                      <button className="btn btn-primary" onClick={goNext}>
                        Calculate <Zap size={18} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Results */
              <div className="results-section animate-fade-up">
                <div className="score-circle-wrap">
                  <svg
                    width="160"
                    height="160"
                    className="score-svg"
                    role="img"
                    aria-label={`Your carbon footprint: ${score} tonnes CO₂ per year`}
                  >
                    <circle cx="80" cy="80" r="68" fill="none" stroke="#e8e8ea" strokeWidth="10" />
                    <circle
                      cx="80" cy="80" r="68"
                      fill="none"
                      stroke="var(--primary)"
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 68}`}
                      strokeDashoffset={`${2 * Math.PI * 68 * (1 - Math.min(score / 8, 1))}`}
                      transform="rotate(-90 80 80)"
                      style={{ transition: 'stroke-dashoffset 1.5s ease-out' }}
                    />
                  </svg>
                  <div className="score-center" aria-hidden="true">
                    <span className="score-number">{score}</span>
                    <span className="score-unit">tonnes/yr</span>
                  </div>
                </div>

                <h3 className="results-title">Your Impact Score</h3>
                <p className="results-sub">
                  {score < 2 ? "Excellent! You're in the top 10% globally." :
                   score < 4 ? "You're performing better than 60% of global citizens." :
                   "There's room to improve — your AI Coach can help!"}
                </p>

                <div className="comparison-bars">
                  {[
                    { label: 'India Average', value: 1.9, max: 8 },
                    { label: 'You', value: score, max: 8, isYou: true },
                    { label: 'World Average', value: 4.7, max: 8 },
                  ].map(({ label, value, max, isYou }) => (
                    <div key={label} className="compare-row">
                      <div className="compare-label-row">
                        <span className={isYou ? 'compare-you' : 'compare-label'}>{label}</span>
                        <span className={isYou ? 'compare-you' : 'compare-label'}>{value}T</span>
                      </div>
                      <div className="progress-track">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${(value / max) * 100}%`,
                            background: isYou ? 'var(--primary)' : '#bccac1'
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  className="btn btn-primary btn-full"
                  onClick={() => navigate('/ai-coach')}
                  style={{ marginTop: 24 }}
                >
                  Get My AI Action Plan <ArrowRight size={18} />
                </button>
                <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--on-surface-variant)', marginTop: 8 }}>
                  Custom reduction roadmap generated in 3.4 seconds.
                </p>
              </div>
            )}
          </div>

          {/* Info Card */}
          <div className="info-card animate-fade-up" style={{ animationDelay: '0.2s' }}>
            <div className="info-card-content">
              <span className="pill pill-primary" style={{ marginBottom: 12, display: 'inline-flex' }}>Real-time Data</span>
              <h3 className="info-card-title">Why tracking matters?</h3>
              <p className="info-card-body">
                Precision tracking is the first step toward significant ecological restoration.
                Understand your data to drive change.
              </p>
            </div>
            <div className="info-card-img-wrap">
              <div className="info-card-phone">
                <div className="info-card-phone-screen">
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🌿</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)' }}>2.4T</div>
                  <div style={{ fontSize: 11, color: 'var(--on-surface-variant)' }}>CO₂/year</div>
                </div>
              </div>
            </div>
          </div>

          {/* Offset CTA Card */}
          <div className="card-dark-deep offset-cta-card animate-fade-up" style={{ animationDelay: '0.3s', marginTop: 16 }}>
            <div className="offset-cta-icon">
              <Leaf size={22} />
            </div>
            <h3 className="offset-cta-title">Offset with Verified Projects</h3>
            <p className="offset-cta-body">
              Connect with global carbon removal initiatives vetted by EcoMind's proprietary AI analysis.
            </p>
            <button
              className="offset-cta-link"
              onClick={() => navigate('/offset')}
            >
              Explore Projects <ChevronRight size={16} />
            </button>
          </div>
        </section>

        {/* Footer */}
        <footer className="calc-footer">
          <div className="footer-logo">
            <Leaf size={16} style={{ color: 'var(--primary)' }} />
            <span>EcoMind</span>
          </div>
          <div className="footer-links">
            {['About', 'Privacy', 'Terms', 'Contact'].map(l => (
              <a key={l} href="#" className="footer-link">{l}</a>
            ))}
          </div>
          <p className="footer-copy">© 2024 EcoMind Platform. All rights reserved.</p>
        </footer>
      </div>

      {/* Floating Action Button */}
      <button
        id="calculator-fab"
        className="fab-btn"
        onClick={() => setShowBillModal(true)}
        aria-label="Upload utility bill for auto-fill"
        title="Analyze a bill"
      >
        <Plus size={24} aria-hidden="true" />
      </button>

      {/* Bill Upload Modal */}
      <BillUploadModal
        isOpen={showBillModal}
        onClose={() => setShowBillModal(false)}
        onAnalysisComplete={(result) => {
          // Auto-fill calculator fields from OCR result
          const isFood = result?.bill_type === 'food' || 
            ['dmart', 'amazon', 'flipkart', 'bigbasket', 'retail'].some(prov => 
              result?.provider?.toLowerCase().includes(prov)
            );

          if (isFood) {
            const co2Val = result.co2_kg ?? result.co2Kg ?? 0;
            if (co2Val > 40) {
              setDiet('meat-eater');
            } else if (co2Val > 20) {
              setDiet('pescetarian');
            } else {
              setDiet('vegetarian');
            }
          } else if (result?.units) {
            setHomeSize(String(Math.round(result.units * 6)))
          }
          setShowBillModal(false)
        }}
      />

      <BottomNav />
    </div>
  )
}
