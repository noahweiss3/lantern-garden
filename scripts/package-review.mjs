import { readFileSync,writeFileSync,readdirSync,mkdirSync,existsSync } from 'node:fs';
const html=readFileSync('dist/index.html','utf8');
const jsFile=html.match(/<script[^>]*src="([^"]+)"[^>]*><\/script>/)?.[1];
const cssFile=html.match(/<link[^>]*href="([^"]+\.css)"[^>]*>/)?.[1];
if(!jsFile||!cssFile)throw Error('Build did not produce expected JS/CSS');
const js=readFileSync(`dist/${jsFile.replace(/^\.\//,'')}`,'utf8').replace(/<\/script/gi,'<\\/script');
const css=readFileSync(`dist/${cssFile.replace(/^\.\//,'')}`,'utf8');
const icon=existsSync('dist/icon.svg') ? readFileSync('dist/icon.svg','utf8') : null;
let result=html.replace('<head>','<head><script>window.LANTERN_REVIEW=true;</script>').replace(/<script[^>]*src="[^"]+"[^>]*><\/script>/,()=>`<script type="module">${js}</script>`)
.replace(/<link[^>]*href="[^"]+\.css"[^>]*>/,()=>`<style>${css}</style>`)
.replace(/<link[^>]*rel="manifest"[^>]*>/g,'')
.replace(/<link[^>]*rel="icon"[^>]*>/g,()=>icon ? `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(icon)}">` : '');
mkdirSync('artifacts',{recursive:true});writeFileSync('artifacts/Lantern-Garden-Review.html',result);
console.log(`Standalone review packaged: ${Buffer.byteLength(result)} bytes`);
