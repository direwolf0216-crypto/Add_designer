'use client';

// Replaces the root layout when it fails, so it must render its own document and inline styles.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  console.error(error);
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#f8fafc', color: '#0f172a', margin: 0 }}>
        <main role="alert" style={{ maxWidth: 420, margin: '15vh auto', padding: 32, textAlign: 'center', background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0' }}>
          <h1 style={{ fontSize: 18, margin: 0 }}>Something went wrong</h1>
          <p style={{ color: '#64748b', fontSize: 14 }}>The app hit an unexpected error.</p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ marginTop: 16, padding: '8px 16px', borderRadius: 12, border: 0, background: '#0f172a', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
