// Demo mode: every /api call is answered from recorded sample data (fixtures.json), so the app runs with no backend.
// Changes (approving, adding, editing) are accepted but not stored: a reload shows the original sample data.
import fixtures from './fixtures.json';

const data = fixtures as Record<string, unknown>;
const byPath = new Map<string, unknown>();
for (const [key, value] of Object.entries(data)) {
  const path = key.split('?')[0];
  if (!byPath.has(path)) byPath.set(path, value);
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function lookup(path: string): unknown | undefined {
  if (path in data) return data[path];
  const bare = path.split('?')[0];
  return byPath.get(bare);
}

export function installDemoApi() {
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname + input.search : input.url;
    if (!url.startsWith('/api/')) return realFetch(input, init);
    const path = url.slice(4);
    const method = (init?.method ?? 'GET').toUpperCase();
    await new Promise((r) => setTimeout(r, 120)); // a touch of latency so loading states look natural

    if (path.endsWith('/auth/refresh')) return json({ accessToken: 'demo' });
    if (method === 'GET') {
      if (/\/(pdf|file|export\.csv|template)$/.test(path.split('?')[0]) || path.includes('.csv')) {
        return new Response('Demo file: downloads contain no real data.', { status: 200, headers: { 'Content-Type': 'text/plain' } });
      }
      const hit = lookup(path);
      return hit === undefined ? json({ error: 'This screen has no sample data in the demo.' }, 404) : json(hit);
    }
    // Writes: accept and echo, nothing is saved.
    return json({ ok: true, id: 'demo', demo: true });
  };
}
