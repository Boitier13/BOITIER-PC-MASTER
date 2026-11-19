import { TrendingUp, type LucideIcon } from 'lucide-react'

export function Metric({
  icon: Icon,
  label,
  value,
  detail,
  color,
}: {
  icon: LucideIcon
  label: string
  value: string
  detail: string
  color: string
}) {
  return (
    <div className="metric-card">
      <div className={`metric-icon ${color}`}>
        <Icon size={18} />
      </div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
      <div className="metric-spark">
        <TrendingUp size={14} />
      </div>
    </div>
  )
}
