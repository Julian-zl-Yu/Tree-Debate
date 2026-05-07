import type { Stance } from '../api/types';

export function StanceBadge({ stance }: { stance: Stance }) {
  return <span className={`stance stance-${stance.toLowerCase()}`}>{stance}</span>;
}
