const FRESH_HOURS = 25
const STALE_HOURS = 72

export default function FreshnessBar({ generatedAt }: { generatedAt: string }) {
  const date = new Date(generatedAt)
  const now = new Date()
  const diffH = Math.round((now.getTime() - date.getTime()) / 3_600_000)

  return (
    <div className="flex items-center gap-2 text-xs text-muted border border-border rounded px-3 py-1.5 bg-surface">
      <span className={`w-1.5 h-1.5 rounded-full ${diffH < FRESH_HOURS ? 'bg-cl' : diffH < STALE_HOURS ? 'bg-native' : 'bg-red-500'}`} />
      <span>Last collected: {date.toUTCString().replace(' GMT', ' UTC')}</span>
      <span className="text-border">·</span>
      <span>{diffH < 24 ? `${diffH}h ago` : `${Math.round(diffH / 24)}d ago`}</span>
    </div>
  )
}
