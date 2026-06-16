// src/utils/carbonCalculations.js
// All carbon footprint calculation logic — pure functions for testability

// ─── Emission Factors (India-specific) ──────────────────────────────────────

export const EMISSION_FACTORS = {
  // Transport (kg CO₂ per km)
  car: 0.21,          // average petrol car
  bus: 0.089,         // city bus
  metro: 0.041,       // metro rail
  bike: 0.103,        // motorcycle
  flight: 0.255,      // per km per passenger

  // Food (kg CO₂ per day)
  vegan: 2.89,
  vegetarian: 3.81,
  flexitarian: 4.67,
  omnivore: 7.19,

  // Energy
  electricityGrid: 0.82,  // kg CO₂ per kWh (India avg)
  lpgPerKg: 2.98,         // kg CO₂ per kg LPG
  lpgCylinderKg: 14.2,    // kg per cylinder

  // Shopping (kg CO₂ per ₹1000 spend)
  shopping: 0.18,
}

// ─── Step Calculators ────────────────────────────────────────────────────────

/**
 * Calculate transport CO₂ in tonnes/yr from travel form data.
 * @param {Object} travel - { carKm, flights, transportFreq }
 * @returns {number} tonnes CO₂/yr
 */
export function calculateTravelCO2(travel = {}) {
  const { carKm = 0, flights = '0-2', transportFreq = 2 } = travel

  // Car: weekly km → annual
  const carAnnual = parseFloat(carKm) * 52 * EMISSION_FACTORS.car

  // Flights: mid-range flight ~1200km avg
  const flightMap = { '0-2': 1, '3-5': 4, '6+': 8 }
  const numFlights = flightMap[flights] ?? 1
  const flightAnnual = numFlights * 1200 * EMISSION_FACTORS.flight

  // Public transport offset (higher freq = less car)
  const transitOffset = transportFreq * 0.1 * 52 * (EMISSION_FACTORS.car - EMISSION_FACTORS.bus)

  const total = Math.max(0, (carAnnual + flightAnnual - transitOffset) / 1000)
  return Math.round(total * 100) / 100
}

/**
 * Calculate food CO₂ in tonnes/yr.
 * @param {Object} food - { diet }
 * @returns {number} tonnes CO₂/yr
 */
export function calculateFoodCO2(food = {}) {
  const { diet = 'vegetarian' } = food
  const factor = EMISSION_FACTORS[diet] ?? EMISSION_FACTORS.vegetarian
  const annual = factor * 365 / 1000
  return Math.round(annual * 100) / 100
}

/**
 * Calculate home energy CO₂ in tonnes/yr.
 * @param {Object} energy - { electricityUnits, energySource, solarEnabled }
 * @returns {number} tonnes CO₂/yr
 */
export function calculateEnergyCO2(energy = {}) {
  const { electricityUnits = 150, energySource = 'grid', solarEnabled = false } = energy

  let gridFactor = EMISSION_FACTORS.electricityGrid
  if (energySource === 'renewable') gridFactor = 0.05
  if (energySource === 'mixed') gridFactor = 0.45
  if (solarEnabled) gridFactor *= 0.6

  const annualKwh = parseFloat(electricityUnits) * 12
  const total = (annualKwh * gridFactor) / 1000
  return Math.round(total * 100) / 100
}

/**
 * Calculate shopping CO₂ in tonnes/yr.
 * @param {number} monthlySpend - Monthly shopping spend in ₹
 * @returns {number} tonnes CO₂/yr
 */
export function calculateShoppingCO2(monthlySpend = 5000) {
  const annual = (parseFloat(monthlySpend) * 12 * EMISSION_FACTORS.shopping) / 1000
  return Math.round(annual * 100) / 100
}

/**
 * Calculate total annual footprint from all categories.
 * @param {Object} formData - { travel, food, energy, shopping }
 * @returns {Object} { totalCO2, travel, food, energy, shopping, rating }
 */
export function calculateTotalFootprint(formData = {}) {
  const travel = calculateTravelCO2(formData.travel)
  const food = calculateFoodCO2(formData.food)
  const energy = calculateEnergyCO2(formData.energy)
  const shopping = calculateShoppingCO2(formData.shopping?.monthlySpend)
  const totalCO2 = Math.round((travel + food + energy + shopping) * 100) / 100

  return {
    totalCO2,
    travel,
    food,
    energy,
    shopping,
    rating: getFootprintRating(totalCO2),
  }
}

/**
 * Rate the footprint relative to India and global averages.
 * @param {number} totalCO2 - Total in tonnes/yr
 * @returns {Object} { label, color, percentile }
 */
export function getFootprintRating(totalCO2) {
  if (totalCO2 <= 1.5) return { label: 'Excellent', color: '#1D9E75', percentile: 10 }
  if (totalCO2 <= 2.5) return { label: 'Good', color: '#68dbae', percentile: 30 }
  if (totalCO2 <= 4.0) return { label: 'Average', color: '#f59e0b', percentile: 60 }
  if (totalCO2 <= 6.0) return { label: 'Above Average', color: '#f97316', percentile: 80 }
  return { label: 'High Impact', color: '#ef4444', percentile: 95 }
}

/**
 * Calculate CO₂ saved vs India average.
 * @param {number} userCO2 - User's footprint in T/yr
 * @returns {number} Tonnes saved (positive = better than avg)
 */
export function calculateCO2Saved(userCO2) {
  const INDIA_AVG = 1.9
  return Math.round((INDIA_AVG - userCO2) * 10) / 10
}

/**
 * Calculate percentage below/above India average.
 * @param {number} userCO2
 * @returns {number} Positive = below average (good)
 */
export function calculateVsAverage(userCO2) {
  const INDIA_AVG = 1.9
  return Math.round(((INDIA_AVG - userCO2) / INDIA_AVG) * 100)
}

/**
 * Convert kWh bill units to approximate CO₂.
 * @param {number} units
 * @param {string} state
 * @returns {number} kg CO₂
 */
export function kwhToCO2(units, state = 'Karnataka') {
  const factors = {
    Karnataka: 0.82, Maharashtra: 0.86, Delhi: 0.79,
    'Tamil Nadu': 0.74, Gujarat: 0.89, default: 0.82,
  }
  return Math.round(units * (factors[state] ?? factors.default) * 10) / 10
}
