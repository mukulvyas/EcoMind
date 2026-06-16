// src/__tests__/carbonCalc.test.js
// Vitest unit tests for carbon calculation utilities

import { describe, it, expect } from 'vitest'
import {
  calculateTravelCO2,
  calculateFoodCO2,
  calculateEnergyCO2,
  calculateShoppingCO2,
  calculateTotalFootprint,
  getFootprintRating,
  calculateCO2Saved,
  calculateVsAverage,
  kwhToCO2,
  EMISSION_FACTORS,
} from '../utils/carbonCalculations'

describe('EMISSION_FACTORS', () => {
  it('should have all required keys', () => {
    expect(EMISSION_FACTORS).toHaveProperty('car')
    expect(EMISSION_FACTORS).toHaveProperty('electricityGrid')
    expect(EMISSION_FACTORS).toHaveProperty('flight')
    expect(EMISSION_FACTORS).toHaveProperty('vegan')
    expect(EMISSION_FACTORS).toHaveProperty('omnivore')
  })

  it('car factor should be in expected range', () => {
    expect(EMISSION_FACTORS.car).toBeGreaterThan(0.1)
    expect(EMISSION_FACTORS.car).toBeLessThan(0.5)
  })
})

describe('calculateTravelCO2', () => {
  it('returns a number', () => {
    const result = calculateTravelCO2({ carKm: 100, flights: '0-2', transportFreq: 2 })
    expect(typeof result).toBe('number')
  })

  it('returns 0 or positive value', () => {
    const result = calculateTravelCO2({ carKm: 0, flights: '0-2', transportFreq: 4 })
    expect(result).toBeGreaterThanOrEqual(0)
  })

  it('higher car km = higher CO2', () => {
    const low = calculateTravelCO2({ carKm: 50, flights: '0-2', transportFreq: 2 })
    const high = calculateTravelCO2({ carKm: 300, flights: '0-2', transportFreq: 2 })
    expect(high).toBeGreaterThan(low)
  })

  it('6+ flights = higher than 0-2 flights', () => {
    const few = calculateTravelCO2({ carKm: 100, flights: '0-2', transportFreq: 2 })
    const many = calculateTravelCO2({ carKm: 100, flights: '6+', transportFreq: 2 })
    expect(many).toBeGreaterThan(few)
  })

  it('handles empty input gracefully', () => {
    expect(() => calculateTravelCO2({})).not.toThrow()
  })
})

describe('calculateFoodCO2', () => {
  it('returns a number for all diet types', () => {
    const diets = ['vegan', 'vegetarian', 'flexitarian', 'omnivore']
    diets.forEach(diet => {
      expect(typeof calculateFoodCO2({ diet })).toBe('number')
    })
  })

  it('vegan diet < vegetarian diet < omnivore diet', () => {
    const vegan = calculateFoodCO2({ diet: 'vegan' })
    const veg = calculateFoodCO2({ diet: 'vegetarian' })
    const omni = calculateFoodCO2({ diet: 'omnivore' })
    expect(vegan).toBeLessThan(veg)
    expect(veg).toBeLessThan(omni)
  })

  it('falls back to vegetarian if diet unknown', () => {
    const known = calculateFoodCO2({ diet: 'vegetarian' })
    const unknown = calculateFoodCO2({ diet: 'unknown_diet' })
    expect(unknown).toBe(known)
  })
})

describe('calculateEnergyCO2', () => {
  it('renewable energy < grid energy', () => {
    const renewable = calculateEnergyCO2({ electricityUnits: 200, energySource: 'renewable', solarEnabled: false })
    const grid = calculateEnergyCO2({ electricityUnits: 200, energySource: 'grid', solarEnabled: false })
    expect(renewable).toBeLessThan(grid)
  })

  it('solar reduces CO2', () => {
    const noSolar = calculateEnergyCO2({ electricityUnits: 200, energySource: 'grid', solarEnabled: false })
    const withSolar = calculateEnergyCO2({ electricityUnits: 200, energySource: 'grid', solarEnabled: true })
    expect(withSolar).toBeLessThan(noSolar)
  })

  it('higher units = higher emissions', () => {
    const low = calculateEnergyCO2({ electricityUnits: 100, energySource: 'grid' })
    const high = calculateEnergyCO2({ electricityUnits: 500, energySource: 'grid' })
    expect(high).toBeGreaterThan(low)
  })

  it('handles empty input gracefully', () => {
    expect(() => calculateEnergyCO2({})).not.toThrow()
  })
})

describe('calculateShoppingCO2', () => {
  it('returns a number', () => {
    expect(typeof calculateShoppingCO2(5000)).toBe('number')
  })

  it('higher spend = higher CO2', () => {
    const low = calculateShoppingCO2(1000)
    const high = calculateShoppingCO2(20000)
    expect(high).toBeGreaterThan(low)
  })
})

describe('calculateTotalFootprint', () => {
  const sample = {
    travel: { carKm: 100, flights: '0-2', transportFreq: 3 },
    food: { diet: 'vegetarian' },
    energy: { electricityUnits: 200, energySource: 'grid', solarEnabled: false },
    shopping: { monthlySpend: 5000 },
  }

  it('returns all required fields', () => {
    const result = calculateTotalFootprint(sample)
    expect(result).toHaveProperty('totalCO2')
    expect(result).toHaveProperty('travel')
    expect(result).toHaveProperty('food')
    expect(result).toHaveProperty('energy')
    expect(result).toHaveProperty('shopping')
    expect(result).toHaveProperty('rating')
  })

  it('totalCO2 equals sum of categories', () => {
    const result = calculateTotalFootprint(sample)
    const sum = Math.round((result.travel + result.food + result.energy + result.shopping) * 100) / 100
    expect(result.totalCO2).toBe(sum)
  })

  it('handles empty input gracefully', () => {
    expect(() => calculateTotalFootprint({})).not.toThrow()
  })
})

describe('getFootprintRating', () => {
  it('low CO2 = Excellent', () => {
    expect(getFootprintRating(1.0).label).toBe('Excellent')
  })

  it('moderate CO2 = Good or Average', () => {
    const labels = ['Good', 'Average']
    expect(labels).toContain(getFootprintRating(3.0).label)
  })

  it('high CO2 = High Impact', () => {
    expect(getFootprintRating(10.0).label).toBe('High Impact')
  })

  it('rating includes color', () => {
    const rating = getFootprintRating(2.0)
    expect(rating).toHaveProperty('color')
    expect(rating.color).toMatch(/^#/)
  })
})

describe('calculateCO2Saved', () => {
  it('positive for low footprint user', () => {
    expect(calculateCO2Saved(1.0)).toBeGreaterThan(0)
  })

  it('negative for high footprint user', () => {
    expect(calculateCO2Saved(5.0)).toBeLessThan(0)
  })

  it('zero for exactly India avg', () => {
    expect(calculateCO2Saved(1.9)).toBe(0)
  })
})

describe('calculateVsAverage', () => {
  it('positive for below-avg user', () => {
    expect(calculateVsAverage(1.0)).toBeGreaterThan(0)
  })

  it('negative for above-avg user', () => {
    expect(calculateVsAverage(3.0)).toBeLessThan(0)
  })
})

describe('kwhToCO2', () => {
  it('calculates for Karnataka grid', () => {
    const result = kwhToCO2(100, 'Karnataka')
    expect(result).toBeCloseTo(82, 0)
  })

  it('uses default factor if state unknown', () => {
    const result = kwhToCO2(100, 'UnknownState')
    expect(typeof result).toBe('number')
    expect(result).toBeGreaterThan(0)
  })

  it('scales linearly', () => {
    const half = kwhToCO2(50, 'Karnataka')
    const full = kwhToCO2(100, 'Karnataka')
    expect(full).toBeCloseTo(half * 2, 1)
  })
})
