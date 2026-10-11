/** Decorative spatial mark. CSS keeps a static version when motion is reduced. */
export function PolarisMark({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`polaris-orbit ${compact ? "polaris-orbit-compact" : ""}`}
      aria-hidden="true"
    >
      <div className="orbit-grid" />
      <div className="orbit-track orbit-track-one" />
      <div className="orbit-track orbit-track-two" />
      <div className="orbit-track orbit-track-three" />
      <div className="orbit-axis" />
      <div className="polaris-star">
        <span />
      </div>
      <span className="orbit-point orbit-point-one" />
      <span className="orbit-point orbit-point-two" />
      <span className="orbit-caption">UNA OPERACIÓN CONECTADA</span>
    </div>
  );
}
