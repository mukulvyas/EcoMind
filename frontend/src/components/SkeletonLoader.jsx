// src/components/SkeletonLoader.jsx
import PropTypes from 'prop-types'

/**
 * Reusable skeleton loader with green shimmer animation.
 */
export default function SkeletonLoader({ width, height, borderRadius, className, style }) {
  return (
    <div
      className={`skeleton ${className ?? ''}`}
      style={{
        width: width ?? '100%',
        height: height ?? '16px',
        borderRadius: borderRadius ?? '8px',
        ...style,
      }}
      aria-busy="true"
      aria-label="Loading content"
    />
  )
}

SkeletonLoader.propTypes = {
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  borderRadius: PropTypes.string,
  className: PropTypes.string,
  style: PropTypes.object,
}

/**
 * Skeleton for a metric card (2 lines of text).
 */
export function MetricCardSkeleton() {
  return (
    <div className="card metric-card">
      <SkeletonLoader width="60%" height="10px" style={{ marginBottom: 10 }} />
      <SkeletonLoader width="80%" height="28px" style={{ marginBottom: 12 }} />
      <SkeletonLoader width="70%" height="22px" borderRadius="20px" />
    </div>
  )
}

/**
 * Skeleton for a govt data panel.
 */
export function GovtDataSkeleton() {
  return (
    <div className="govt-panel-skeleton">
      <SkeletonLoader width="40%" height="10px" style={{ marginBottom: 8 }} />
      <SkeletonLoader width="60%" height="22px" style={{ marginBottom: 8 }} />
      <SkeletonLoader width="80%" height="12px" />
    </div>
  )
}

/**
 * Skeleton for a chat bubble.
 */
export function ChatBubbleSkeleton() {
  return (
    <div className="message-row bot" style={{ marginBottom: 8 }}>
      <div className="bot-avatar" style={{ background: 'var(--surface-container-high)' }} />
      <div style={{ flex: 1 }}>
        <SkeletonLoader width="80%" height="14px" style={{ marginBottom: 6 }} />
        <SkeletonLoader width="60%" height="14px" style={{ marginBottom: 6 }} />
        <SkeletonLoader width="40%" height="14px" />
      </div>
    </div>
  )
}
