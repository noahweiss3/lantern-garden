import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Static fixture checks only, not browser, hardware, or real offline validation.
const repository=fileURLToPath(new URL('../',import.meta.url));
const verifier=join(repository,'scripts/verify-build.mjs');
const portable='artifacts/Lantern-Garden-Review.html';
const fixtureModule='const garden = { ready: true }; console.log(garden.ready);';
const fixtureHtml=`<!doctype html><html><head><script>window.LANTERN_REVIEW=true;</script><style>body{color:green}</style></head><body><main id="garden">Ready</main><script type="module">${fixtureModule}</script></body></html>`;
const builtFiles=['assets/app.css','assets/app.js','icon-192.png','icon-512.png','index.html'];

function write(root,name,contents){const path=join(root,name);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,contents);}
function sealBuild(root,{assets=['./',...builtFiles.map(name=>'./'+name)],cache}={}){
  const hash=createHash('sha256');
  for(const name of builtFiles)hash.update(readFileSync(join(root,'dist',name)));
  const key=cache??'lantern-garden-'+hash.digest('hex').slice(0,12);
  write(root,'dist/sw.js',`const CACHE='${key}';\nconst ASSETS=${JSON.stringify(assets)};\n`);
  return key;
}
function fixture(callback){
  const root=mkdtempSync(join(tmpdir(),'garden-build-verification-'));
  try{
    write(root,'dist/index.html','<!doctype html><html><head><link rel="stylesheet" href="./assets/app.css"></head><body><main id="garden">Ready</main><script type="module" src="./assets/app.js"></script></body></html>');
    write(root,'dist/assets/app.js',fixtureModule);
    write(root,'dist/assets/app.css','body{color:green}');
    for(const size of [192,512])copyFileSync(join(repository,'public',`icon-${size}.png`),join(root,'dist',`icon-${size}.png`));
    write(root,portable,fixtureHtml);
    const cache=sealBuild(root);
    return callback(root,cache);
  }finally{rmSync(root,{recursive:true,force:true});}
}
function verify(root){return spawnSync(process.execPath,[verifier],{cwd:root,encoding:'utf8',timeout:10000});}
function rejects(root,reason){const result=verify(root);assert.equal(result.error,undefined);assert.notEqual(result.status,0,`Verifier unexpectedly accepted fixture: ${reason}\n${result.stdout}`);return result;}
function changePortable(root,change){write(root,portable,change(readFileSync(join(root,portable),'utf8')));}

test('build verification: coherent generated dist and standalone portable fixture pass',()=>fixture((root,cache)=>{
  const result=verify(root);assert.equal(result.error,undefined);assert.equal(result.status,0,result.stderr);
  const report=JSON.parse(result.stdout);
  assert.equal(report.cache,cache);assert.equal(report.precacheEntries,builtFiles.length+1);
  assert.equal(report.portableBytes,Buffer.byteLength(fixtureHtml));assert.equal(report.moduleSyntax,'passed');assert.equal(report.externalHtmlResources,0);
}));

test('build verification: changed build bytes with a stale cache key fail',()=>fixture(root=>{
  write(root,'dist/assets/app.js',fixtureModule+'\n// changed build bytes');
  assert.match(rejects(root,'stale cache').stderr,/Cache key matches actual build bytes/);
}));

test('build verification: omitted or extra precache resources fail',()=>{
  for(const assets of [['./',...builtFiles.slice(1).map(name=>'./'+name)],['./',...builtFiles.map(name=>'./'+name),'./missing.js']])fixture(root=>{
    sealBuild(root,{assets});assert.match(rejects(root,'incorrect precache manifest').stderr,/Every built file is precached/);
  });
});

test('build verification: portable external image dependency fails for double, single and unquoted attributes',()=>{
  for(const src of ['"https://example.invalid/garden.png"',"'https://example.invalid/garden.png'",'https://example.invalid/garden.png'])fixture(root=>{
    changePortable(root,html=>html.replace('</body>',`<img src=${src}></body>`));rejects(root,`external image with src=${src}`);
  });
});

test('build verification: portable external script dependency fails',()=>fixture(root=>{
  changePortable(root,html=>html.replace('</body>','<script src="https://example.invalid/garden.js"></script></body>'));
  rejects(root,'external script alongside inline module');
}));

test('build verification: duplicate static IDs fail in production and portable HTML',()=>{
  for(const target of ['dist/index.html',portable])fixture(root=>{
    const html=readFileSync(join(root,target),'utf8').replace('</body>','<section id="garden"></section></body>');write(root,target,html);
    if(target.startsWith('dist/'))sealBuild(root);
    assert.match(rejects(root,`duplicate IDs in ${target}`).stderr,/Static HTML IDs are unique/);
  });
});

test('build verification: duplicate single-quoted static IDs fail',()=>fixture(root=>{
  changePortable(root,html=>html.replace('</body>',"<section id='garden'></section></body>"));rejects(root,'duplicate single-quoted ID');
}));

test('build verification: portable inline module syntax errors fail',()=>fixture(root=>{
  changePortable(root,html=>html.replace(fixtureModule,'const garden = ;'));
  assert.match(rejects(root,'invalid module syntax').stderr,/SyntaxError/);
}));

test('build verification: portable dynamic imports fail, including comments before the argument',()=>{
  for(const module of ["import('./garden.js');","import /* bundle split */ ('./garden.js');"])fixture(root=>{
    changePortable(root,html=>html.replace(fixtureModule,module));rejects(root,`dynamic import: ${module}`);
  });
});

test('build verification: portable static imports and re-exports fail',()=>{
  for(const module of ["import { garden } from './garden.js'; console.log(garden);","import './garden.js';","export { garden } from './garden.js';"])fixture(root=>{
    changePortable(root,html=>html.replace(fixtureModule,module));rejects(root,`external module dependency: ${module}`);
  });
});

test('build verification: portable CSS remote and relative resources fail across style elements',()=>{
  for(const style of ['body{background:url(https://example.invalid/garden.png)}','body{background:url(./garden.png)}','@import "./garden.css";'])fixture(root=>{
    changePortable(root,html=>html.replace('</head>',`<style>${style}</style></head>`));rejects(root,`CSS dependency: ${style}`);
  });
});

test('build verification: portable data URL and fragment resources remain allowed',()=>fixture(root=>{
  changePortable(root,html=>html.replace('</body>','<a href="#garden">Garden</a><img src="data:image/png;base64,aGVsbG8="></body>'));
  const result=verify(root);assert.equal(result.status,0,result.stderr);
}));

test('build verification: module checks parse rather than execute and ignore import-like strings or comments',()=>fixture(root=>{
  const module=`const help = "import('./garden.js')"; /* import './garden.js'; */\nthrow new Error('Fixture must not execute');`;
  changePortable(root,html=>html.replace(fixtureModule,module));
  const result=verify(root);assert.equal(result.status,0,result.stderr);
}));

test('build verification: reviewer mode is required only in the portable artifact',()=>{
  fixture(root=>{changePortable(root,html=>html.replace('<script>window.LANTERN_REVIEW=true;</script>',''));assert.match(rejects(root,'missing portable reviewer mode').stderr,/Portable enables reviewer navigation/);});
  fixture(root=>{write(root,'dist/index.html',readFileSync(join(root,'dist/index.html'),'utf8').replace('<head>','<head><script>window.LANTERN_REVIEW=true;</script>'));sealBuild(root);assert.match(rejects(root,'production reviewer mode enabled').stderr,/Production does not enable reviewer navigation/);});
});
