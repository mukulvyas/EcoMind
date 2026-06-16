// src/components/BillUploadModal.jsx
// Bottom sheet modal for bill upload → OCR → auto-fill

import { useState, useRef, useCallback } from 'react'
import PropTypes from 'prop-types'
import { X, Upload, Zap, Flame, Car, CheckCircle2, AlertCircle, ShoppingBag } from 'lucide-react'
import { useBillAnalyzer } from '../hooks/useBillAnalyzer'
import { truncateFilename, formatFileSize } from '../utils/formatters'
import './BillUploadModal.css'

const BILL_TYPES = [
  { id: 'electricity', label: 'Electricity', icon: Zap, color: '#f59e0b' },
  { id: 'gas', label: 'LPG/Gas', icon: Flame, color: '#f97316' },
  { id: 'fuel', label: 'Fuel/Vehicle', icon: Car, color: '#6366f1' },
  { id: 'food', label: 'Food/Grocery', icon: ShoppingBag, color: '#1D9E75' },
]

const SUPPORTED_PROVIDERS = [
  'BESCOM', 'BSES', 'Tata Power', 'MSEB', 'Indane', 'HP Gas', 'Bharat Gas', 'HPCL', 'BPCL', 'DMart', 'Amazon Fresh', 'Flipkart Supermart', 'BigBasket'
]

export default function BillUploadModal({ isOpen, onClose, onAnalysisComplete }) {
  const [activeBillType, setActiveBillType] = useState('electricity')
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const fileInputRef = useRef(null)
  const { uploading, progress, result, error, analyzeBill, reset } = useBillAnalyzer()

  const handleClose = useCallback(() => {
    reset()
    setSelectedFile(null)
    setDragOver(false)
    onClose()
  }, [reset, onClose])

  const handleFile = useCallback(
    async (file) => {
      if (!file) return
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain']
      if (!allowedTypes.includes(file.type)) {
        alert('Please upload a JPG, PNG, PDF, or text file.')
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be under 10MB.')
        return
      }
      setSelectedFile(file)
    },
    []
  )

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      handleFile(file)
    },
    [handleFile]
  )

  const handleAnalyze = async () => {
    if (!selectedFile) return
    const analysisResult = await analyzeBill(selectedFile, activeBillType)
    if (analysisResult && onAnalysisComplete) {
      onAnalysisComplete(analysisResult)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="modal-backdrop"
        onClick={handleClose}
        aria-hidden="true"
        role="presentation"
      />

      {/* Bottom sheet */}
      <div
        className="bill-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Analyze your utility bill"
      >
        {/* Handle */}
        <div className="modal-handle" aria-hidden="true" />

        {/* Header */}
        <div className="modal-header">
          <div>
            <h2 className="modal-title">Analyze Your Bill</h2>
            <p className="modal-subtitle">Upload any utility bill to auto-detect carbon data</p>
          </div>
          <button
            className="modal-close-btn"
            onClick={handleClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Bill type tabs */}
        <div className="bill-type-tabs" role="tablist" aria-label="Bill type">
          {BILL_TYPES.map(({ id, label, icon: Icon, color }) => (
            <button
              key={id}
              role="tab"
              aria-selected={activeBillType === id}
              className={`bill-type-tab ${activeBillType === id ? 'active' : ''}`}
              style={activeBillType === id ? { borderColor: color, background: `${color}15`, color } : {}}
              onClick={() => {
                setActiveBillType(id)
                setSelectedFile(null)
                reset()
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Success state */}
        {result ? (
          <div className="bill-success">
            <div className="bill-success-icon">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="bill-success-title">Bill Analyzed!</h3>
            <p className="bill-success-msg">
              Found <strong>{result.units} {result.bill_type === 'food' ? 'items' : 'units'}</strong> → approximately{' '}
              <strong>{result.co2_kg ?? result.co2Kg ?? 0} kg CO₂</strong>
            </p>
            <div className="bill-result-grid">
              {[
                { label: 'Provider', value: result.provider ?? '—' },
                { label: 'Period', value: result.period ?? '—' },
                { label: 'Amount', value: result.amount ? `₹${result.amount}` : '—' },
                { label: 'CO₂', value: (result.co2_kg ?? result.co2Kg) ? `${result.co2_kg ?? result.co2Kg} kg` : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="bill-result-item">
                  <span className="bill-result-label">{label}</span>
                  <span className="bill-result-value">{value}</span>
                </div>
              ))}
            </div>
            <button className="btn btn-primary btn-full" style={{ marginTop: 16 }} onClick={handleClose}>
              ✓ Applied to Calculator
            </button>
          </div>
        ) : (
          <>
            {/* Upload area */}
            <div
              className={`upload-area ${dragOver ? 'drag-over' : ''} ${selectedFile ? 'has-file' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => {
                if (!selectedFile) {
                  const f = new File([
                    "DMart Grocery Receipt\nDate: 2026-06-12\nItems:\n- Rice: 5kg - 350 INR\n- Dal: 2kg - 240 INR\n- Apples: 2kg - 300 INR\n- Potatoes: 5kg - 150 INR\n- Milk: 6L - 360 INR\n- Paneer: 1kg - 400 INR\n- Curd: 2kg - 200 INR\nTotal: 2000 INR"
                  ], "dummy_bill.txt", { type: "text/plain" });
                  handleFile(f);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label="Upload bill area. Click or drag and drop a file."
              onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,application/pdf,text/plain"
                className="sr-only"
                onChange={(e) => handleFile(e.target.files[0])}
                aria-label="Choose file to upload"
              />
              {selectedFile ? (
                <div className="selected-file">
                  <div className="selected-file-icon">📄</div>
                  <div className="selected-file-info">
                    <span className="selected-file-name">{truncateFilename(selectedFile.name)}</span>
                    <span className="selected-file-size">{formatFileSize(selectedFile.size)}</span>
                  </div>
                  <button
                    className="remove-file-btn"
                    onClick={(e) => { e.stopPropagation(); setSelectedFile(null); reset() }}
                    aria-label="Remove selected file"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="upload-icon">
                    <Upload size={28} />
                  </div>
                  <p className="upload-text">Drag &amp; drop or tap to upload</p>
                  <p className="upload-subtext">JPG, PNG, PDF up to 10MB</p>
                </>
              )}
            </div>

            {/* Progress bar */}
            {uploading && (
              <div className="upload-progress-wrap">
                <div className="upload-progress-bar">
                  <div
                    className="upload-progress-fill"
                    style={{ width: `${progress}%` }}
                    role="progressbar"
                    aria-valuenow={progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
                <span className="upload-progress-pct">{progress}%</span>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="upload-error" role="alert">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            {/* Supported providers */}
            <div className="providers-section">
              <p className="providers-label">Supported providers:</p>
              <div className="providers-chips">
                {SUPPORTED_PROVIDERS.map((p) => (
                  <span key={p} className="provider-chip">{p}</span>
                ))}
              </div>
            </div>

            {/* Analyze button */}
            <button
              id="analyze-bill-btn"
              className="btn btn-primary btn-full"
              style={{ marginTop: 8, gap: 8 }}
              onClick={handleAnalyze}
              disabled={!selectedFile || uploading}
              aria-busy={uploading}
              aria-label="Analyze selected bill"
            >
              {uploading ? (
                <>
                  <div className="btn-spinner-sm" aria-hidden="true" />
                  Analyzing...
                </>
              ) : (
                <>
                  Analyze Bill →
                </>
              )}
            </button>
          </>
        )}
      </div>
    </>
  )
}

BillUploadModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onAnalysisComplete: PropTypes.func,
}
