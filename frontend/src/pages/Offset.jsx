import { useState, useEffect } from 'react'
import { Search, Settings, MapPin, ArrowRight } from 'lucide-react'
import AppHeader from '../components/AppHeader'
import BottomNav from '../components/BottomNav'
import './Offset.css'

const FILTERS = [
  'All Projects',
  'Forestry',
  'Renewable',
  'Blue Carbon',
  'Wind Energy',
  'Methane Capture',
  'Mountain Ecosystems',
]

const PROJECTS = [
  {
    id: 1,
    name: 'Kerala Reforestation',
    location: 'Kerala, India',
    price: '₹800/t',
    category: 'Verified Gold Standard',
    categoryColor: '#1D9E75',
    filterKey: 'Forestry',
    annualOffset: '12,500',
    progress: 68,
    emoji: '🌴',
    gradient: 'linear-gradient(135deg, #1a8c4e 0%, #0d5c30 100%)',
    desc: "Tropical reforestation across Kerala's degraded forest landscapes.",
  },
  {
    id: 2,
    name: 'Solar Farm – Rajasthan',
    location: 'Rajasthan, India',
    price: '₹650/t',
    category: 'Clean Energy',
    categoryColor: '#f59e0b',
    filterKey: 'Renewable',
    annualOffset: '45,000',
    progress: 82,
    emoji: '☀️',
    gradient: 'linear-gradient(135deg, #d97706 0%, #92400e 100%)',
    desc: 'Large-scale solar energy displacing coal-fired generation in the Thar desert.',
  },
  {
    id: 3,
    name: 'Sundarbans Mangroves',
    location: 'West Bengal, India',
    price: '₹1,100/t',
    category: 'Blue Carbon',
    categoryColor: '#0ea5e9',
    filterKey: 'Blue Carbon',
    annualOffset: '8,200',
    progress: 45,
    emoji: '🌊',
    gradient: 'linear-gradient(135deg, #0369a1 0%, #0c4a6e 100%)',
    desc: 'Protecting and restoring mangrove ecosystems in the Sundarbans delta.',
  },
  {
    id: 4,
    name: 'Western Ghats Wind',
    location: 'Maharashtra, India',
    price: '₹580/t',
    category: 'Wind Energy',
    categoryColor: '#8b5cf6',
    filterKey: 'Wind Energy',
    annualOffset: '32,000',
    progress: 91,
    emoji: '💨',
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #4c1d95 100%)',
    desc: 'Wind turbine farms harnessing the Western Ghats ridge line winds.',
  },
  {
    id: 5,
    name: 'Bengaluru Biogas',
    location: 'Karnataka, India',
    price: '₹720/t',
    category: 'Methane Capture',
    categoryColor: '#f97316',
    filterKey: 'Methane Capture',
    annualOffset: '18,400',
    progress: 57,
    emoji: '♻️',
    gradient: 'linear-gradient(135deg, #ea580c 0%, #7c2d12 100%)',
    desc: "Capturing biogas from Bengaluru's organic waste to generate clean power.",
  },
  {
    id: 6,
    name: 'Himalayan Re-wilding',
    location: 'Uttarakhand, India',
    price: '₹950/t',
    category: 'Mountain Ecosystems',
    categoryColor: '#6366f1',
    filterKey: 'Mountain Ecosystems',
    annualOffset: '5,800',
    progress: 34,
    emoji: '🏔️',
    gradient: 'linear-gradient(135deg, #4338ca 0%, #1e1b4b 100%)',
    desc: 'Restoring alpine biodiversity and reintroducing native species in the Himalayas.',
  },
]

export default function Offset() {
  const [activeFilter, setActiveFilter] = useState('All Projects')
  const [search, setSearch] = useState('')
  const [offsetted, setOffsetted] = useState({})

  // Set page title for SEO and problem-statement traceability
  useEffect(() => { document.title = 'Offset Projects | EcoMind' }, [])

  const filtered = PROJECTS.filter(p => {
    const matchFilter = activeFilter === 'All Projects' || p.filterKey === activeFilter
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                        p.location.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const handleOffset = (id) => {
    setOffsetted(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="app-shell">
      <AppHeader rightContent={
        <button className="offset-settings-btn">
          <Settings size={20} />
        </button>
      } />

      <div className="page-content">
        {/* Hero */}
        <section className="offset-hero">
          <div className="offset-hero-bg" />
          <div className="offset-hero-content">
            <h1 className="offset-hero-title">Offset Your Impact</h1>
            <p className="offset-hero-sub">
              Support verified high-impact projects worldwide to balance your carbon footprint.
              Precision-tracked and transparently reported.
            </p>
          </div>
        </section>

        {/* Search */}
        <div className="offset-search-wrap">
          <div className="search-bar">
            <Search size={16} className="search-icon" />
            <input
              className="search-input"
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Filter Chips */}
        <div className="filter-chips hide-scrollbar">
          {FILTERS.map(f => (
            <button
              key={f}
              className={`filter-chip ${activeFilter === f ? 'active' : ''}`}
              onClick={() => setActiveFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Results Count */}
        <div className="results-count">
          {filtered.length} project{filtered.length !== 1 ? 's' : ''} found
        </div>

        {/* Project Cards */}
        <div className="offset-projects">
          {filtered.map((project, idx) => (
            <div
              key={project.id}
              className="project-card animate-fade-up"
              style={{ animationDelay: `${idx * 0.06}s` }}
            >
              {/* Image Banner */}
              <div className="project-image" style={{ background: project.gradient }}>
                <div className="project-emoji">{project.emoji}</div>
                <span
                  className="project-badge"
                  style={{ background: project.categoryColor }}
                >
                  {project.category}
                </span>
              </div>

              {/* Card Body */}
              <div className="project-body">
                <div className="project-name-row">
                  <h3 className="project-name">{project.name}</h3>
                  <span className="project-price">{project.price}</span>
                </div>

                <div className="project-location">
                  <MapPin size={12} />
                  <span>{project.location}</span>
                </div>

                <p className="project-desc">{project.desc}</p>

                <div className="project-offset-row">
                  <span className="project-offset-label">Annual Offset:</span>
                  <span className="project-offset-value">{project.annualOffset} tonnes</span>
                </div>

                <div className="project-progress-wrap">
                  <div className="project-progress-track">
                    <div
                      className="project-progress-fill"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                  <span className="project-progress-pct">{project.progress}% funded</span>
                </div>

                <button
                  className={`btn ${offsetted[project.id] ? 'btn-offset-done' : 'btn-primary'} btn-full`}
                  style={{ marginTop: 16, fontSize: 14 }}
                  onClick={() => handleOffset(project.id)}
                >
                  {offsetted[project.id] ? '✓ Offset Added' : 'Offset Now'}
                  {!offsetted[project.id] && <ArrowRight size={16} />}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <footer className="calc-footer" style={{ marginTop: 8 }}>
          <div className="footer-logo">
            <span style={{ color: 'var(--primary)', fontSize: 18 }}>🌿</span>
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

      <BottomNav />
    </div>
  )
}
