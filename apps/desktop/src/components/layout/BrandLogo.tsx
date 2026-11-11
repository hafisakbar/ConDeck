import logoUrl from '../../assets/logo.png';
import { cn } from '../../lib/cn';

/**
 * The single place the product mark is rendered. Swapping the artwork means
 * replacing `src/assets/logo.png`; every surface follows.
 */
export function BrandLogo({ className }: { className?: string }) {
  return <img src={logoUrl} alt="" aria-hidden className={cn('object-contain', className)} />;
}
