import { Badge } from '@/components/ui/badge';
import { getRiskLevel } from '@/lib/tydro';
import { cn } from '@/lib/utils';

/**
 * hl.eco-style risk label for a Tydro position, derived from the health
 * factor via the shared getRiskLevel helper (one source of truth for the
 * Conservative / Balanced / Aggressive / At Risk bands).
 *
 * Tailwind purges dynamic class names, so each risk color maps to an
 * explicit static string matching the badge styling used across the app.
 */
const RISK_TONES: Record<'green' | 'yellow' | 'orange' | 'red', string> = {
  green: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  yellow: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  orange: 'border-orange-400/30 bg-orange-400/10 text-orange-300',
  red: 'border-rose-400/30 bg-rose-500/10 text-rose-300',
};

export function RiskBadge({
  healthFactor,
  className,
}: {
  healthFactor: number;
  className?: string;
}) {
  const risk = getRiskLevel(healthFactor);

  return (
    <Badge
      variant="outline"
      title={`${risk.label} — ${risk.description}`}
      className={cn('shrink-0 font-display text-[10px]', RISK_TONES[risk.color], className)}
    >
      {risk.label}
    </Badge>
  );
}
