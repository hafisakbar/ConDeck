export function BrandMark({ size = 48 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 gap-1"
      style={{ width: size, height: size, gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' }}
    >
      <span className="rounded-[28%] bg-accent" />
      <span className="rounded-[28%] bg-surface-raised" />
      <span className="rounded-[28%] bg-surface-raised" />
      <span className="rounded-[28%] bg-content-subtle" />
    </span>
  );
}
