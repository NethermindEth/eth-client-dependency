export default function CoverageBar({
  el,
  cl,
}: {
  el: number   // 0-1
  cl: number   // 0-1
}) {
  const elPct = Math.round(el * 100)
  const clPct = Math.round(cl * 100)
  const tooltip = [
    elPct > 0 ? `EL ${elPct}%` : '',
    clPct > 0 ? `CL ${clPct}%` : '',
  ].filter(Boolean).join(' / ') + ' of network runs this dependency (EL and CL fractions are additive across clients)'

  return (
    <div
      className="flex items-center gap-3 text-xs font-mono"
      title={tooltip}
    >
      {elPct > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-muted text-[10px]">EL</span>
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
          <span className="text-muted text-[10px]">CL</span>
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
