export async function get(host, path = '') {
  const url = `http://${host}/${path}`;
  const resp = await fetch(url);
  const text = await resp.text();
  return { ok: resp.ok, status: resp.status, body: text };
}
