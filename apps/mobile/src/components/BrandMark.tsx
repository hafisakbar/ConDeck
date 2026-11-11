import logoUrl from '../assets/logo.png';

export function BrandMark({ size = 48 }: { size?: number }) {
  return (
    <img
      src={logoUrl}
      alt=""
      aria-hidden
      width={size}
      height={size}
      className="shrink-0 rounded-[28%] object-contain"
    />
  );
}
