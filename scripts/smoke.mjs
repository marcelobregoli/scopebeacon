import { randomUUID } from 'node:crypto';
const base = process.env.SMOKE_URL ?? 'http://127.0.0.1:5173';
const homeResponse = await fetch(base + '/');
const homeHtml = await homeResponse.text();
if (!homeResponse.ok || !homeHtml.includes('ScopeBeacon')) throw new Error('Frontend root route failed');
const deepResponse = await fetch(base + '/demo');
if (!deepResponse.ok || !(await deepResponse.text()).includes('ScopeBeacon')) throw new Error('Frontend deep-link fallback failed');
const jsPath = homeHtml.match(/src="([^"]+\.js)"/)?.[1];
if (jsPath) { const asset = await fetch(base + jsPath); if (!asset.ok) throw new Error('Frontend JS asset failed: ' + asset.status); }
async function request(path, method = 'GET', body, cookie) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  const response = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); }
  catch { throw new Error("Expected JSON from " + path + "; HTTP " + response.status + "; type " + response.headers.get('content-type') + "; body " + raw.slice(0, 180)); }
  return { status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
const email = 'smoke-' + randomUUID() + '@scopebeacon.local';
const registered = await request('/api/auth/register', 'POST', { name: 'Smoke Test', email, password: 'correct-horse-battery' });
if (registered.status !== 201) throw new Error('Registration failed: ' + JSON.stringify(registered.data));
const cookie = registered.cookie;
const created = await request('/api/projects', 'POST', { name: 'ScopeBeacon smoke test', clientName: 'Sample Client', description: 'Automated end-to-end verification.' }, cookie);
if (created.status !== 201) throw new Error('Project creation failed');
const id = created.data.project.id;
const task = await request('/api/projects/' + id + '/tasks', 'POST', { title: 'Internal task must stay private' }, cookie);
const milestone = await request('/api/projects/' + id + '/milestones', 'POST', { title: 'Prototype approved' }, cookie);
const share = await request('/api/projects/' + id + '/share', 'POST', { enabled: true }, cookie);
const publicPath = '/api/public/' + share.data.token;
const publicView = await request(publicPath);
if (publicView.status !== 200 || publicView.data.progress.totalTasks !== 1 || 'tasks' in publicView.data || 'activity' in publicView.data || JSON.stringify(publicView.data).includes('Internal task')) throw new Error('Public privacy check failed');
await request('/api/projects/' + id + '/tasks/' + task.data.task.id, 'PATCH', { status: 'done' }, cookie);
const updated = await request(publicPath);
if (updated.data.progress.completedTasks !== 1) throw new Error('Progress aggregation failed');
await request('/api/projects/' + id + '/share', 'POST', { enabled: false }, cookie);
const revoked = await request(publicPath);
if (revoked.status !== 404) throw new Error('Share revocation failed');
console.log(JSON.stringify({ registration: registered.status, project: created.status, task: task.status, milestone: milestone.status, publicView: publicView.status, publicProgress: updated.data.progress, privateTaskExcluded: true, shareRevocation: revoked.status }, null, 2));
