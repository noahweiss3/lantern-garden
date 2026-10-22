import { readFileSync, readdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { parseAst } from 'rollup/parseAst';

const dist='dist',portable='artifacts/Lantern-Garden-Review.html';
const walk=path=>readdirSync(path,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(join(path,entry.name)):[join(path,entry.name)]);
const files=walk(dist).filter(path=>relative(dist,path)!=='sw.js');
const worker=readFileSync(join(dist,'sw.js'),'utf8');
const assets=JSON.parse(worker.match(/const ASSETS=(\[.*?\]);/)?.[1]||'null');
assert.ok(Array.isArray(assets),'Generated worker has its asset manifest');
const expected=['./',...files.map(path=>'./'+relative(dist,path).replaceAll('\\','/'))];
assert.deepEqual([...assets].sort(),expected.sort(),'Every built file is precached, with no extra entries');
const hash=createHash('sha256');for(const path of files)hash.update(readFileSync(path));
const cache='lantern-garden-'+hash.digest('hex').slice(0,12);
assert.ok(worker.includes(`const CACHE='${cache}'`),'Cache key matches actual build bytes');

const tagAttributes = /(?<name>[^\s=/>]+)(?:\s*=\s*(?:"(?<double>[^"]*)"|'(?<single>[^']*)'|(?<bare>[^\s"'=<>`]+)))?/g;
const decode=value=>value.replace(/&#(x[0-9a-f]+|[0-9]+);/gi,(_,n)=>String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n))).replace(/&(amp|quot|apos|lt|gt);/g,(_,name)=>({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'}[name]));
function attributes(text){const result={};for(const match of text.matchAll(tagAttributes)){const name=match.groups.name.toLowerCase();assert.ok(!Object.hasOwn(result,name),'No duplicate HTML attribute');result[name]=decode(match.groups.double??match.groups.single??match.groups.bare??'');}return result;}
const scriptPattern=/<script\b((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/script>/gi;
const stylePattern=/<style\b((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/style>/gi;
function tags(html){const bare=html.replace(scriptPattern,(_,a)=>`<script ${a}></script>`).replace(stylePattern,(_,a)=>`<style ${a}></style>`);return [...bare.matchAll(/<([a-z][a-z\d:-]*)\b((?:"[^"]*"|'[^']*'|[^'">])*)>/gi)].map(match=>({name:match[1].toLowerCase(),attrs:attributes(match[2])}));}
function uniqueIds(items){const ids=items.filter(tag=>Object.hasOwn(tag.attrs,'id')).map(tag=>tag.attrs.id);assert.equal(ids.length,new Set(ids).size,'Static HTML IDs are unique');}
const production=readFileSync(join(dist,'index.html'),'utf8'),html=readFileSync(portable,'utf8');
const productionTags=tags(production),reviewTags=tags(html);uniqueIds(productionTags);uniqueIds(reviewTags);
assert.ok(!production.includes('window.LANTERN_REVIEW=true'),'Production does not enable reviewer navigation');
assert.ok(html.includes('<script>window.LANTERN_REVIEW=true;</script>'),'Portable enables reviewer navigation');
for(const tag of reviewTags){
  assert.ok(!(tag.name==='link'&&tag.attrs.rel?.split(/\s+/).includes('manifest')),'Portable does not require an installation manifest');
  for(const key of ['src','href'])if(Object.hasOwn(tag.attrs,key))assert.ok(/^(?:data:|#)/.test(tag.attrs[key]),'Portable has no required external HTML resource');
}
for(const style of html.matchAll(stylePattern)){
  assert.ok(!/@import\b/i.test(style[2]),'Portable CSS has no imports');
  for(const url of style[2].matchAll(/\burl\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi))assert.ok(/^(?:data:|#)/.test((url[1]??url[2]??url[3]).trim()),'Portable CSS has no external resource');
}
const modules=[...html.matchAll(scriptPattern)].filter(match=>attributes(match[1]).type==='module');
assert.equal(modules.length,1,'Portable contains one inline module');
const temporary=mkdtempSync(join(tmpdir(),'lantern-build-'));
try{const path=join(temporary,'review.mjs');writeFileSync(path,modules[0][2]);const result=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});assert.equal(result.status,0,result.stderr||'Portable module parses');}
finally{rmSync(temporary,{recursive:true,force:true});}
const tree=parseAst(modules[0][2]),pending=[tree];
while(pending.length){const node=pending.pop();if(!node||typeof node!=='object')continue;
  assert.ok(!['ImportExpression','ImportDeclaration','ExportAllDeclaration'].includes(node.type)&&!(node.type==='ExportNamedDeclaration'&&node.source),'Portable module has no imports or re-exports');
  for(const value of Object.values(node))if(Array.isArray(value))pending.push(...value);else if(value&&typeof value==='object')pending.push(value);
}
for(const size of [192,512]){const png=readFileSync(join(dist,`icon-${size}.png`));assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);}
console.log(JSON.stringify({cache,precacheEntries:assets.length,portableBytes:Buffer.byteLength(html),moduleSyntax:'passed',externalHtmlResources:0}));
