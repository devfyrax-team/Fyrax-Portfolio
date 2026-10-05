export function DemoBanner() {
  return (
    <div
      role="note"
      style={{
        position: 'fixed', left: '50%', bottom: 14, transform: 'translateX(-50%)', zIndex: 1000,
        background: '#0f2a2e', color: '#fff', padding: '8px 14px', borderRadius: 999, fontSize: 13,
        boxShadow: '0 4px 18px rgba(0,0,0,.25)', display: 'flex', gap: 10, alignItems: 'center', maxWidth: 'calc(100vw - 24px)',
      }}
    >
      <span>Live demo with sample data. Changes are not saved.</span>
      <a href="/projects/hrms" target="_top" style={{ color: '#7dd3c0', whiteSpace: 'nowrap' }}>Back to Fyrax</a>
    </div>
  );
}
