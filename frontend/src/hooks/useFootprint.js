// src/hooks/useFootprint.js
// Footprint data hook — reads/writes footprint history via backend REST API

import { useState, useEffect, useCallback } from 'react'
import { getHistory, calculateFootprint } from '../services/api'

/**
 * @returns {{
 *   footprints: Array,
 *   latestFootprint: Object|null,
 *   loading: boolean,
 *   error: string|null,
 *   saveFootprint: (data: Object) => Promise<Object>,
 *   refresh: () => void,
 * }}
 */
export function useFootprint() {
  const [footprints, setFootprints] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadFootprints = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getHistory()
      if (res && res.entries) {
        // Map backend snake_case properties to frontend camelCase
        const mapped = res.entries.map((entry, idx) => ({
          id: entry.id || String(idx),
          totalCO2: entry.total_co2,
          travel: entry.travel,
          food: entry.food,
          energy: entry.energy,
          shopping: entry.shopping,
          createdAt: entry.timestamp ? { seconds: Math.floor(new Date(entry.timestamp).getTime() / 1000) } : null,
          ...entry
        }))
        setFootprints(mapped)
      }
    } catch (err) {
      console.error('Error fetching footprint history:', err)
      setError('Failed to load footprint data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFootprints()
  }, [loadFootprints])

  const saveFootprint = useCallback(
    async (formData) => {
      const result = await calculateFootprint(formData)
      await loadFootprints() // Refresh list after saving
      return result
    },
    [loadFootprints]
  )

  return {
    footprints,
    latestFootprint: footprints[0] ?? null,
    loading,
    error,
    saveFootprint,
    refresh: loadFootprints
  }
}

