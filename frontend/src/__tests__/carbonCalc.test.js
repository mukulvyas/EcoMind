import { describe, it, expect } from 'vitest'
import { 
  calculateTravelCO2, 
  calculateFoodCO2,
  calculateEnergyCO2,
  calculateShoppingCO2,
  calculateTotalFootprint,
  kwhToCO2
} from '../utils/carbonCalculations'

describe('Carbon Calculations', () => {

  it('calculates expected travel for no car and minimal flights', () => {
    expect(calculateTravelCO2({ carKm: 0, flights: '0-2', transportFreq: 4 })).toBeCloseTo(0.3, 1)
  })

  it('vegan diet has lower footprint than meat-eater', () => {
    expect(calculateFoodCO2({ diet: 'vegan' }))
      .toBeLessThan(calculateFoodCO2({ diet: 'meat-eater' }))
  })

  it('fossil energy increases footprint over renewable', () => {
    const fossil = calculateEnergyCO2({ electricityUnits: 1500, energySource: 'fossil', solarEnabled: false })
    const renewable = calculateEnergyCO2({ electricityUnits: 1500, energySource: 'renewable', solarEnabled: false })
    expect(fossil).toBeGreaterThan(renewable)
  })

  it('more shopping spend increases shopping footprint', () => {
    expect(calculateShoppingCO2(10000))
      .toBeGreaterThan(calculateShoppingCO2(2000))
  })

  it('total CO2 is calculated correctly', () => {
    const res = calculateTotalFootprint({
      travel: { carKm: 100, flights: '0-2', transportFreq: 2 }, 
      food: { diet: 'vegan' }, 
      energy: { electricityUnits: 150, energySource: 'grid', solarEnabled: false }, 
      shopping: { monthlySpend: 5000 }
    })
    expect(res.totalCO2).toBeGreaterThan(0)
  })

  it('Karnataka grid factor gives correct CO2', () => {
    // 200 kWh * 0.82 = 164 kg = 0.164 tonnes
    const kwh = 200
    const factor = 0.82
    expect(kwhToCO2(kwh, 'Karnataka') / 1000).toBeCloseTo(0.164, 3)
  })

})
