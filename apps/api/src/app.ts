import { Hono, type MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import type { ScopeBeaconDatabase } from './db.js';
import { createSessionToken, hashPassword, hashToken, SESSION_COOKIE, SESSION_TTL_SECONDS, verifyPassword } from './security.js';

type User = { id: string; name: string; email: string };
type Env = { Variables: { user: User } };
type ProjectRow = { id: string; user_id: string; name: string; client_name: string; description: string; status: 'active' | 'on-hold' | 'completed'; share_token: string | null; created_at: string; updated_at: string };
const now = () => new Date().toISOString();
const userShape = (row: any): User => ({ id: row.id, name: row.name, email: row.email });

function addActivity(db: ScopeBeaconDatabase, projectId: string, userId: string, message: string) {
  db.prepare('INSERT INTO activity (id, project_id, user_id, message, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(randomUUID(), projectId, userId, message, now());
}

function ownedProject(db: ScopeBeaconDatabase, projectId: string, userId: string): ProjectRow | undefined {
  return db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(projectId, userId) as ProjectRow | undefined;
}

export function createApp(db: ScopeBeaconDatabase, options: { secureCookies?: boolean } = {}) {
  const app = new Hono<Env>();
  const secureCookies = options.secureCookies ?? process.env.NODE_ENV === 'production';

  const requireUser: MiddlewareHandler<Env> = async (c, next) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (!token) return c.json({ error: 'Authentication required.' }, 401);
    const session = db.prepare(`
      SELECT users.id, users.name, users.email
      FROM sessions JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ? AND sessions.expires_at > ?
    `).get(hashToken(token), now()) as any;
    if (!session) {
      deleteCookie(c, SESSION_COOKIE, { path: '/' });
      return c.json({ error: 'Session expired. Please sign in again.' }, 401);
    }
    c.set('user', userShape(session));
    await next();
  };

  function issueSession(c: any, userId: string) {
    const token = createSessionToken();
    const timestamp = now();
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
    db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
      .run(hashToken(token), userId, expiresAt, timestamp);
    setCookie(c, SESSION_COOKIE, token, {
      httpOnly: true, sameSite: 'Lax', secure: secureCookies, path: '/', maxAge: SESSION_TTL_SECONDS,
    });
  }

  app.get('/api/health', (c) => c.json({ status: 'ok', service: 'scopebeacon-api', timestamp: now() }));

  app.post('/api/auth/register', async (c) => {
    const schema = z.object({
      name: z.string().trim().min(2).max(80),
      email: z.string().trim().email().max(254),
      password: z.string().min(10).max(128),
    });
    const parsed = schema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'Enter a name, valid email and password of at least 10 characters.' }, 400);
    const { name, email, password } = parsed.data;
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string } | undefined;
    if (existing) return c.json({ error: 'An account with this email already exists.' }, 409);
    const id = randomUUID();
    db.prepare('INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, name, email, hashPassword(password), now());
    issueSession(c, id);
    return c.json({ user: { id, name, email } }, 201);
  });

  app.post('/api/auth/login', async (c) => {
    const schema = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(128) });
    const parsed = schema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'Enter a valid email and password.' }, 400);
    const row = db.prepare('SELECT * FROM users WHERE email = ?').get(parsed.data.email) as any;
    if (!row || !verifyPassword(parsed.data.password, row.password_hash)) return c.json({ error: 'Email or password is incorrect.' }, 401);
    issueSession(c, row.id);
    return c.json({ user: userShape(row) });
  });

  app.post('/api/auth/logout', (c) => {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
    deleteCookie(c, SESSION_COOKIE, { httpOnly: true, sameSite: 'Lax', secure: secureCookies, path: '/' });
    return c.json({ success: true });
  });

  app.get('/api/auth/me', requireUser, (c) => c.json({ user: c.get('user') }));

  app.get('/api/projects', requireUser, (c) => {
    const user = c.get('user');
    const projects = db.prepare(`
      SELECT p.*,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done') AS completed_task_count,
        (SELECT COUNT(*) FROM milestones m WHERE m.project_id = p.id) AS milestone_count
      FROM projects p WHERE p.user_id = ? ORDER BY p.updated_at DESC
    `).all(user.id);
    return c.json({ projects });
  });

  app.post('/api/projects', requireUser, async (c) => {
    const schema = z.object({
      name: z.string().trim().min(2).max(100),
      clientName: z.string().trim().max(100).optional().default(''),
      description: z.string().trim().max(1000).optional().default(''),
    });
    const parsed = schema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'Project name must be between 2 and 100 characters.' }, 400);
    const user = c.get('user');
    const id = randomUUID();
    const timestamp = now();
    db.prepare('INSERT INTO projects (id, user_id, name, client_name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, user.id, parsed.data.name, parsed.data.clientName, parsed.data.description, timestamp, timestamp);
    addActivity(db, id, user.id, 'Project created');
    return c.json({ project: ownedProject(db, id, user.id) }, 201);
  });

  app.get('/api/projects/:id', requireUser, (c) => {
    const user = c.get('user');
    const project = ownedProject(db, c.req.param('id'), user.id);
    if (!project) return c.json({ error: 'Project not found.' }, 404);
    const tasks = db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY CASE priority WHEN \'high\' THEN 0 WHEN \'normal\' THEN 1 ELSE 2 END, created_at DESC').all(project.id);
    const milestones = db.prepare('SELECT * FROM milestones WHERE project_id = ? ORDER BY COALESCE(due_date, \'9999-12-31\'), created_at').all(project.id);
    const activity = db.prepare('SELECT id, message, created_at FROM activity WHERE project_id = ? ORDER BY created_at DESC LIMIT 12').all(project.id);
    return c.json({ project, tasks, milestones, activity });
  });

  app.patch('/api/projects/:id', requireUser, async (c) => {
    const user = c.get('user');
    const project = ownedProject(db, c.req.param('id'), user.id);
    if (!project) return c.json({ error: 'Project not found.' }, 404);
    const schema = z.object({
      name: z.string().trim().min(2).max(100).optional(),
      clientName: z.string().trim().max(100).optional(),
      description: z.string().trim().max(1000).optional(),
      status: z.enum(['active', 'on-hold', 'completed']).optional(),
    }).refine((v) => Object.keys(v).length > 0);
    const parsed = schema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'No valid project changes supplied.' }, 400);
    const next = { name: parsed.data.name ?? project.name, clientName: parsed.data.clientName ?? project.client_name, description: parsed.data.description ?? project.description, status: parsed.data.status ?? project.status };
    db.prepare('UPDATE projects SET name = ?, client_name = ?, description = ?, status = ?, updated_at = ? WHERE id = ?')
      .run(next.name, next.clientName, next.description, next.status, now(), project.id);
    addActivity(db, project.id, user.id, 'Project details updated');
    return c.json({ project: ownedProject(db, project.id, user.id) });
  });

  app.delete('/api/projects/:id', requireUser, (c) => {
    const user = c.get('user');
    const project = ownedProject(db, c.req.param('id'), user.id);
    if (!project) return c.json({ error: 'Project not found.' }, 404);
    db.prepare('DELETE FROM projects WHERE id = ?').run(project.id);
    return c.json({ success: true });
  });

  app.post('/api/projects/:id/tasks', requireUser, async (c) => {
    const user = c.get('user');
    const project = ownedProject(db, c.req.param('id'), user.id);
    if (!project) return c.json({ error: 'Project not found.' }, 404);
    const schema = z.object({ title: z.string().trim().min(2).max(180), priority: z.enum(['low','normal','high']).default('normal'), dueDate: z.string().date().nullable().optional() });
    const parsed = schema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'Enter a task title and valid optional due date.' }, 400);
    const id = randomUUID(); const timestamp = now();
    db.prepare('INSERT INTO tasks (id, project_id, title, priority, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, project.id, parsed.data.title, parsed.data.priority, parsed.data.dueDate ?? null, timestamp, timestamp);
    db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(timestamp, project.id);
    addActivity(db, project.id, user.id, `Task added: ${parsed.data.title}`);
    return c.json({ task: db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) }, 201);
  });

  app.patch('/api/projects/:id/tasks/:taskId', requireUser, async (c) => {
    const user = c.get('user');
    const project = ownedProject(db, c.req.param('id'), user.id);
    if (!project) return c.json({ error: 'Project not found.' }, 404);
    const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND project_id = ?').get(c.req.param('taskId'), project.id) as any;
    if (!task) return c.json({ error: 'Task not found.' }, 404);
    const schema = z.object({ title: z.string().trim().min(2).max(180).optional(), status: z.enum(['todo','in-progress','done']).optional(), priority: z.enum(['low','normal','high']).optional(), dueDate: z.string().date().nullable().optional() }).refine((v) => Object.keys(v).length > 0);
    const parsed = schema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'No valid task changes supplied.' }, 400);
    const next = { title: parsed.data.title ?? task.title, status: parsed.data.status ?? task.status, priority: parsed.data.priority ?? task.priority, dueDate: parsed.data.dueDate === undefined ? task.due_date : parsed.data.dueDate };
    const timestamp = now();
    db.prepare('UPDATE tasks SET title = ?, status = ?, priority = ?, due_date = ?, updated_at = ? WHERE id = ?')
      .run(next.title, next.status, next.priority, next.dueDate, timestamp, task.id);
    db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(timestamp, project.id);
    if (parsed.data.status) addActivity(db, project.id, user.id, `Task ${parsed.data.status === 'done' ? 'completed' : 'updated'}: ${next.title}`);
    return c.json({ task: db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id) });
  });

  app.post('/api/projects/:id/milestones', requireUser, async (c) => {
    const user = c.get('user');
    const project = ownedProject(db, c.req.param('id'), user.id);
    if (!project) return c.json({ error: 'Project not found.' }, 404);
    const schema = z.object({ title: z.string().trim().min(2).max(140), dueDate: z.string().date().nullable().optional() });
    const parsed = schema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'Enter a milestone title and valid optional due date.' }, 400);
    const id = randomUUID(); const timestamp = now();
    db.prepare('INSERT INTO milestones (id, project_id, title, due_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, project.id, parsed.data.title, parsed.data.dueDate ?? null, timestamp, timestamp);
    db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(timestamp, project.id);
    addActivity(db, project.id, user.id, `Milestone added: ${parsed.data.title}`);
    return c.json({ milestone: db.prepare('SELECT * FROM milestones WHERE id = ?').get(id) }, 201);
  });

  app.patch('/api/projects/:id/milestones/:milestoneId', requireUser, async (c) => {
    const user = c.get('user');
    const project = ownedProject(db, c.req.param('id'), user.id);
    if (!project) return c.json({ error: 'Project not found.' }, 404);
    const milestone = db.prepare('SELECT * FROM milestones WHERE id = ? AND project_id = ?').get(c.req.param('milestoneId'), project.id) as any;
    if (!milestone) return c.json({ error: 'Milestone not found.' }, 404);
    const schema = z.object({ status: z.enum(['upcoming','in-progress','complete']).optional(), title: z.string().trim().min(2).max(140).optional(), dueDate: z.string().date().nullable().optional() }).refine((v) => Object.keys(v).length > 0);
    const parsed = schema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'No valid milestone changes supplied.' }, 400);
    const next = { status: parsed.data.status ?? milestone.status, title: parsed.data.title ?? milestone.title, dueDate: parsed.data.dueDate === undefined ? milestone.due_date : parsed.data.dueDate };
    const timestamp = now();
    db.prepare('UPDATE milestones SET status = ?, title = ?, due_date = ?, updated_at = ? WHERE id = ?').run(next.status, next.title, next.dueDate, timestamp, milestone.id);
    db.prepare('UPDATE projects SET updated_at = ? WHERE id = ?').run(timestamp, project.id);
    addActivity(db, project.id, user.id, `Milestone updated: ${next.title}`);
    return c.json({ milestone: db.prepare('SELECT * FROM milestones WHERE id = ?').get(milestone.id) });
  });

  app.post('/api/projects/:id/share', requireUser, async (c) => {
    const user = c.get('user');
    const project = ownedProject(db, c.req.param('id'), user.id);
    if (!project) return c.json({ error: 'Project not found.' }, 404);
    const schema = z.object({ enabled: z.boolean() });
    const parsed = schema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'Specify whether sharing should be enabled.' }, 400);
    const token = parsed.data.enabled ? (project.share_token ?? randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '')) : null;
    db.prepare('UPDATE projects SET share_token = ?, updated_at = ? WHERE id = ?').run(token, now(), project.id);
    addActivity(db, project.id, user.id, parsed.data.enabled ? 'Client progress sharing enabled' : 'Client progress sharing disabled');
    return c.json({ enabled: Boolean(token), token, url: token ? `/share/${token}` : null });
  });

  app.get('/api/public/:token', (c) => {
    const project = db.prepare('SELECT id, name, client_name, description, status, created_at, updated_at FROM projects WHERE share_token = ?')
      .get(c.req.param('token')) as any;
    if (!project) return c.json({ error: 'Shared project not found or sharing is disabled.' }, 404);
    const milestones = db.prepare('SELECT title, due_date, status FROM milestones WHERE project_id = ? ORDER BY COALESCE(due_date, \'9999-12-31\'), created_at').all(project.id);
    const taskSummary = db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS completed FROM tasks WHERE project_id = ?").get(project.id) as any;
    return c.json({ project, milestones, progress: { totalTasks: taskSummary.total, completedTasks: taskSummary.completed ?? 0 } });
  });

  app.notFound((c) => c.json({ error: 'Route not found.' }, 404));
  app.onError((error, c) => {
    console.error('[scopebeacon-api]', error);
    return c.json({ error: 'An unexpected server error occurred.' }, 500);
  });
  return app;
}
