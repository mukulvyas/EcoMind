// src/hooks/useBillAnalyzer.js
// Bill upload and analysis hook using backend REST API

import { useState, useCallback } from 'react'
import { uploadBill } from '../services/api'

/**
 * @returns {{
 *   uploading: boolean,
 *   progress: number,
 *   result: Object|null,
 *   error: string|null,
 *   analyzeBill: (file: File, billType: string) => Promise<Object|null>,
 *   reset: () => void,
 * }}
 */
export function useBillAnalyzer() {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const reset = useCallback(() => {
    setUploading(false)
    setProgress(0)
    setResult(null)
    setError(null)
  }, [])

  const analyzeBill = useCallback(
    async (file, billType = 'electricity') => {
      if (!file) {
        setError('No file selected.')
        return null
      }

      setUploading(true)
      setProgress(20)
      setError(null)

      try {
        setProgress(50)
        const res = await uploadBill(file, billType)
        setProgress(85)
        
        if (!res || !res.bill_data) {
          throw new Error('Could not extract data from the bill. Please try a clearer image.')
        }
        
        setProgress(100)
        setResult(res.bill_data)
        setUploading(false)
        return res.bill_data
      } catch (err) {
        setError(err.message ?? 'Analysis failed. Please try again.')
        setUploading(false)
        return null
      }
    },
    []
  )

  return { uploading, progress, result, error, analyzeBill, reset }
}

