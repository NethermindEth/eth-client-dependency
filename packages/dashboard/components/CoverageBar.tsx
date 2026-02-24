export default function CoverageBar({
  el,
  cl,
}: {
  el: number   // 0-1
  cl: number   // 0-1
}) {
  const elPct = Math.round(el * 100)
  const clPct = Math.round(cl * 100)

  return (
    <div className="flex items-center gap-3 text-xs font-mono">
      {elPct > 0 && (
        <div className="flex items-center gap-1.5">
          <div className="w-16 h-1.5 rounded-full bg-surface overflow-hidden">
            <div
              className="h-full bg-el rounded-full"
              style={{ width: `${Math.min(elPct, 100)}%` }}
            />
          </div>
          <span className="text-el w-8">{elPct}%</span>
        </div>
      )}
      {clPct > 0 && (
        <div className="flex items-center gap-1.5">
          <div className="w-16 h-1.5 rounded-full bg-surface overflow-hidden">
            <div
              className="h-full bg-cl rounded-full"
              style={{ width: `${Math.min(clPct, 100)}%` }}
            />
          </div>
          <span className="text-cl w-8">{clPct}%</span>
        </div>
      )}
    </div>
  )
}
