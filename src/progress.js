import { LESSONS, STAGES } from './curriculum.js';
export const STORAGE_KEY = 'lantern-garden-progress';
export const VERSION = 3;
export const MAX_BACKUP_BYTES = 1000000;
export function blankProgress() {
  return {version:VERSION,stage:0,completed:[],programs:{},hintCounts:{},prediction:null,predictions:{},predictionCorrect:null,checks:{},stageChecks:{},evidence:{},passedLessons:[],visitedLessons:[],completedAt:null,updatedAt:null,reducedMotion:false};
}
const date = value => typeof value==='string' && !Number.isNaN(Date.parse(value)) ? value : null;
function prediction(value,level) {
  if(!value || !Number.isInteger(value.x) || !Number.isInteger(value.z) || !level.tiles.some(t=>t.x===value.x && t.z===value.z))return null;
  const p={x:value.x,z:value.z};
  if(Number.isInteger(value.heading)&&value.heading>=0&&value.heading<4)p.heading=value.heading;
  return p;
}
function answer(value,question) {
  if(!value || !question?.choices || !Number.isInteger(value.choice) || !question.choices[value.choice])return null;
  return {choice:value.choice,correct:question.choices[value.choice].correct===true,attempts:Number.isInteger(value.attempts)?Math.max(1,Math.min(1000,value.attempts)):1};
}
export function validateProgress(raw) {
  if(!raw || typeof raw!=='object' || Array.isArray(raw))throw Error('This does not look like a Lantern Garden save.');
  if(![1,2,VERSION].includes(raw.version))throw Error('This save version is not supported. Keep your original file.');
  const base=blankProgress(),legacy=raw.version<3,levels=legacy?STAGES.slice(0,3):STAGES;
  base.stage=Number.isInteger(raw.stage)?Math.max(0,Math.min(levels.length-1,raw.stage)):0;
  base.completed=Array.isArray(raw.completed)?levels.map(l=>l.id).filter(id=>raw.completed.includes(id)):[];
  for(const level of levels){
    const id=level.id;
    if(typeof raw.programs?.[id]==='string'&&raw.programs[id].length<=4000)base.programs[id]=raw.programs[id];
    const count=raw.hintCounts?.[id];
    if(Number.isInteger(count)&&count>=0)base.hintCounts[id]=Math.min(level.hints.length,count);
    const p=prediction(raw.predictions?.[id],level);if(p)base.predictions[id]=p;
    const a=answer(raw.stageChecks?.[id],level.check);if(a)base.stageChecks[id]=a;
    const e=raw.evidence?.[id];
    if(e&&base.completed.includes(id))base.evidence[id]={independent:e.independent===true,clues:Number.isInteger(e.clues)?Math.max(0,Math.min(level.hints.length,e.clues)):0};
  }
  base.prediction=prediction(raw.prediction,STAGES[0]);
  if(base.prediction&&!base.predictions[STAGES[0].id])base.predictions[STAGES[0].id]={...base.prediction};
  if(base.predictions[STAGES[0].id])base.prediction={...base.predictions[STAGES[0].id]};
  base.predictionCorrect=typeof raw.predictionCorrect==='boolean'?raw.predictionCorrect:null;
  if(!legacy)for(const lesson of LESSONS){const a=answer(raw.checks?.[lesson.number],lesson.check);if(a)base.checks[lesson.number]=a;}
  base.passedLessons=legacy?[]:LESSONS.map(l=>l.number).filter(n=>base.checks[n]?.correct||(Array.isArray(raw.passedLessons)&&raw.passedLessons.includes(n)));
  base.visitedLessons=Array.isArray(raw.visitedLessons)?LESSONS.map(l=>l.number).filter(n=>raw.visitedLessons.includes(n)):[];
  for(const field of ['completedAt','updatedAt'])base[field]=date(raw[field]);
  base.reducedMotion=raw.reducedMotion===true;
  return base;
}
export function completedLessonNumbers(progress) {
  return LESSONS.filter(l=>(l.choice?l.choice.stageIds.filter(id=>progress.completed.includes(id)).length>=(l.choice.minimum||1):l.stages.every(s=>progress.completed.includes(s.id)))&&(progress.checks[l.number]?.correct||progress.passedLessons?.includes(l.number))).map(l=>l.number);
}
export function loadProgress(storage) {
  try {const raw=storage.getItem(STORAGE_KEY);return {progress:raw?validateProgress(JSON.parse(raw)):blankProgress(),error:null};}
  catch {return {progress:blankProgress(),error:'Your saved progress could not be opened. You can start again or import a backup.'};}
}
export function saveProgress(storage,progress,now=new Date().toISOString()) {
  const next=validateProgress({...progress,version:VERSION,updatedAt:now});
  try {storage.setItem(STORAGE_KEY,JSON.stringify(next));return {progress:next,error:null};}
  catch {return {progress:next,error:'Saving is unavailable in this browser. Export a backup before leaving.'};}
}
export function exportProgress(progress){return JSON.stringify({app:'Lantern Garden',...validateProgress(progress)},null,2);}
export function importProgress(text){
  if(typeof text!=='string'||text.length>MAX_BACKUP_BYTES)throw Error('Please choose a Lantern Garden JSON backup under 1 MB.');
  const raw=JSON.parse(text);if(raw.app!=='Lantern Garden')throw Error('Please choose a Lantern Garden progress backup.');
  return validateProgress(raw);
}
