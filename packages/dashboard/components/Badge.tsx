type BadgeVariant = 'el' | 'cl' | 'cross' | 'native' | 'muted'

const STYLES: Record<BadgeVariant, string> = {
  el: 'bg-el/10 text-el border-el/30',
  cl: 'bg-cl/10 text-cl border-cl/30',
  cross: 'bg-cross/10 text-cross border-cross/30',
  native: 'bg-native/10 text-native border-native/30',
  muted: 'bg-surface text-muted border-border',
}

export default function Badge({
  label,
  variant = 'muted',
}: {
  label: string
  variant?: BadgeVariant
}) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs border font-mono ${STYLES[variant]}`}>
      {label}
    </span>
  )
}
