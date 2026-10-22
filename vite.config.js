import { defineConfig } from 'vite';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
function walk(path,prefix='') { return readdirSync(path,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(join(path,d.name),`${prefix}${d.name}/`):[`${prefix}${d.name}`]); }
export default defineConfig({base:'./',build:{target:'es2020',chunkSizeWarningLimit:650},plugins:[{
  name:'offline-shell',closeBundle(){
    const files=walk('dist').filter(f=>f!=='sw.js');
    const hash=createHash('sha256');for(const f of files)hash.update(readFileSync(join('dist',f)));
    const version=hash.digest('hex').slice(0,12);
    const worker=`const CACHE='lantern-garden-${version}';\nconst ASSETS=${JSON.stringify(['./',...files.map(f=>'./'+f)])};\nself.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));});\nself.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('lantern-garden-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});\nself.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).catch(()=>event.request.mode==='navigate'?caches.match(new URL('./index.html',self.registration.scope)):Response.error())));});\n`;
    writeFileSync('dist/sw.js',worker);
  }
}]});
