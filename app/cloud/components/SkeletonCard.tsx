export function SkeletonCard({ height = 200 }: { height?: number }) {
  return (
    <div style={{ borderRadius: 18, overflow: 'hidden', background: '#FFFFFF', border: '0.5px solid rgba(28,20,16,0.08)' }}>
      <div style={{ height, background: 'linear-gradient(90deg, #EDE9E3 25%, #E4E0D8 50%, #EDE9E3 75%)', backgroundSize: '200% 100%', animation: 'skeleton-shimmer 1.5s infinite' }} />
      <div style={{ padding: '12px 14px 16px' }}>
        <div style={{ height: 14, width: '70%', background: 'linear-gradient(90deg, #EDE9E3 25%, #E4E0D8 50%, #EDE9E3 75%)', backgroundSize: '200% 100%', animation: 'skeleton-shimmer 1.5s infinite', borderRadius: 4, marginBottom: 8 }} />
        <div style={{ height: 10, width: '45%', background: 'linear-gradient(90deg, #EDE9E3 25%, #E4E0D8 50%, #EDE9E3 75%)', backgroundSize: '200% 100%', animation: 'skeleton-shimmer 1.5s infinite', borderRadius: 4 }} />
      </div>
    </div>
  );
}

export function SkeletonPhotoGrid() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 20px' }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonCard key={i} height={120} />
      ))}
    </div>
  );
}

export function SkeletonScrollRow() {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '0 20px', overflow: 'hidden' }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} style={{ minWidth: 152, flexShrink: 0 }}>
          <SkeletonCard height={108} />
        </div>
      ))}
    </div>
  );
}
