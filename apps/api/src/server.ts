import 'dotenv/config';
import {serve} from '@hono/node-server';
import {serveStatic} from '@hono/node-server/serve-static';
import {createApp} from './app.js';
import {createDatabase} from './db.js';

if (process.env.NODE_ENV === 'production' && !process.env.RATE_LIMIT_SECRET) {
  throw new Error('RATE_LIMIT_SECRET must be configured before running the API in production.');
}
const port=Number(process.env.PORT??8787);
const db=createDatabase();
const app=createApp(db);
app.use('/assets/*',serveStatic({root:'./dist'}));
for(const route of ['/','/login','/signup','/demo','/share/*','/projects/*']) app.get(route,serveStatic({path:'./dist/index.html'}));
serve({fetch:app.fetch,port,hostname:'127.0.0.1'},info=>{
 console.log('ScopeBeacon full-stack server listening on http://127.0.0.1:'+info.port);
});
