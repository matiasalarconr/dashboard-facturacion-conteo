// Intermediario entre el panel (GitHub Pages) y la API de GitHub.
// Guarda la clave de GitHub como secreto (GITHUB_TOKEN) para que el panel suba y elimine
// reportes sin pedir clave. Solo permite tocar archivos .xlsx dentro de excels/.
//
//   GET    /files              -> lista de excels/ [{ name, sha, size }]
//   PUT    /file?name=X.xlsx   -> cuerpo: { message, content (base64), sha? } tal cual lo espera GitHub
//   DELETE /file?name=X.xlsx   -> elimina el archivo (busca su sha)
//   GET    /runs?sha=COMMIT    -> estado de la Action que publica el panel para ese commit

const REPO = 'matiasalarconr/dashboard-facturacion-conteo';
const BRANCH = 'main';
const ORIGINS = ['https://matiasalarconr.github.io', 'http://localhost:8765'];
const MAX_BYTES = 70 * 1024 * 1024; // ~50 MB de Excel en base64
const NAME_OK = /^[\w.\-]{1,150}\.xlsx$/i;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
    const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!env.GITHUB_TOKEN) return json({ error: 'Falta configurar la clave de GitHub en el intermediario.' }, 500);

    const gh = (path, init = {}) => fetch('https://api.github.com/repos/' + REPO + path, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer ' + env.GITHUB_TOKEN,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'dashboard-facturacion-upload',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
    const pass = async (r) => {
      const body = await r.text();
      if (r.ok) return new Response(body, { status: r.status, headers: { ...cors, 'Content-Type': 'application/json' } });
      const msg = r.status === 401 ? 'La clave de GitHub del intermediario no es válida o expiró.'
        : r.status === 403 || r.status === 404 ? 'La clave de GitHub del intermediario no tiene permiso sobre el repositorio.'
        : r.status === 409 || r.status === 422 ? 'El archivo cambió mientras se subía. Inténtalo de nuevo.'
        : 'GitHub respondió ' + r.status + '.';
      return json({ error: msg, status: r.status }, r.status === 422 ? 409 : r.status);
    };

    const url = new URL(request.url);
    try {
      if (url.pathname === '/files' && request.method === 'GET') {
        const r = await gh('/contents/excels?ref=' + BRANCH);
        if (r.status === 404) return json([]);
        if (!r.ok) return pass(r);
        return json((await r.json()).filter(f => f.type === 'file').map(f => ({ name: f.name, sha: f.sha, size: f.size })));
      }

      if (url.pathname === '/runs' && request.method === 'GET') {
        const sha = url.searchParams.get('sha') || '';
        if (!/^[0-9a-f]{40}$/.test(sha)) return json({ error: 'Commit inválido.' }, 400);
        return pass(await gh('/actions/runs?head_sha=' + sha));
      }

      if (url.pathname === '/file') {
        const name = url.searchParams.get('name') || '';
        if (!NAME_OK.test(name)) return json({ error: 'Nombre de archivo no permitido (debe ser .xlsx).' }, 400);
        const path = '/contents/excels/' + encodeURIComponent(name);

        if (request.method === 'PUT') {
          const len = +request.headers.get('Content-Length') || 0;
          if (len > MAX_BYTES) return json({ error: 'El archivo es demasiado grande.' }, 413);
          const body = await request.arrayBuffer();
          if (body.byteLength > MAX_BYTES) return json({ error: 'El archivo es demasiado grande.' }, 413);
          return pass(await gh(path, { method: 'PUT', body }));
        }

        if (request.method === 'DELETE') {
          const cur = await gh(path + '?ref=' + BRANCH);
          if (cur.status === 404) return json({ error: 'El archivo ya no existe en el repositorio. Recarga la página.' }, 404);
          if (!cur.ok) return pass(cur);
          const { sha } = await cur.json();
          return pass(await gh(path, { method: 'DELETE', body: JSON.stringify({ message: 'Eliminar reporte ' + name, sha, branch: BRANCH }) }));
        }
      }

      return json({ error: 'Ruta no encontrada.' }, 404);
    } catch (e) {
      return json({ error: 'Error del intermediario: ' + e.message }, 502);
    }
  },
};
