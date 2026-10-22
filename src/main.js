import './style.css';
import { createWorld } from './world.js';
import { LESSONS, STAGES as LEVELS } from './curriculum.js';
import { DIRECTIONS, parseProgram, initialState, advance, undo, tileLabel, runProgram } from './engine.js';
import { STORAGE_KEY, MAX_BACKUP_BYTES, blankProgress, loadProgress, saveProgress, exportProgress, importProgress, completedLessonNumbers } from './progress.js';

const $=id=>document.getElementById(id);
let storage;
try{storage=window.localStorage;}catch{storage={getItem(){throw Error();},setItem(){throw Error();},removeItem(){throw Error();}};}
const loaded=loadProgress(storage);
let progress=loaded.progress;
let level=LEVELS[progress.stage],state=initialState(level),commands=null,running=false,runToken=0,hintIndex=0;
let installEvent=null,world,flatView,checkpointStageOnly=false,offlineText='',saveWarning=Boolean(loaded.error);
const reduced=()=>progress.reducedMotion||matchMedia('(prefers-reduced-motion: reduce)').matches;
const currentLesson=()=>LESSONS.find(l=>l.number===level.lessonNumber);
const currentPrediction=()=>progress.predictions[level.id]||(progress.stage===0?progress.prediction:null);
const reviewMode=(()=>{try{return window.LANTERN_REVIEW===true||new URL(location.href).searchParams.get('review')==='1';}catch{return false;}})();
function say(text){$('feedback').textContent=text;}
function updateJournalStatus(){const badge=$('journal-status');if(badge)badge.textContent=saveWarning?'Not saved · export':/failed|unavailable/i.test(offlineText)?'Offline not ready':/Ready for|garden ready/i.test(offlineText)?'Offline ready':/Self-contained/.test(offlineText)?'Review · offline':/Development/.test(offlineText)?'Dev preview':'Preparing offline…';}
function setOfflineStatus(text){offlineText=text;$('offline-status').textContent=text;updateJournalStatus();}
function persist(){const saved=saveProgress(storage,progress);progress=saved.progress;saveWarning=Boolean(saved.error);$('save-status').textContent=saved.error||'Saved on this device';updateJournalStatus();return saved.error;}
function cancelRun(){runToken++;running=false;}
function choiceLabel(tile){return `${tileLabel(tile)}${Number.isInteger(tile.heading)?` · ${DIRECTIONS[tile.heading].name}`:''}`;}
function choosePrediction(tile){
  if(!level.predictions?.length||running||state.pc>0||(progress.completed.includes(level.id)&&currentPrediction()))return;
  const matches=level.predictions.filter(p=>p.x===tile.x&&p.z===tile.z&&(!Number.isInteger(tile.heading)||p.heading===tile.heading));
  if(matches.length!==1){say('Choose a tile and direction using the prediction buttons.');return;}
  const selected={...matches[0]};progress.predictions[level.id]=selected;if(progress.stage===0)progress.prediction={...selected};
  world.setPrediction(selected);$('prediction-label').textContent=choiceLabel(selected);
  for(const b of $('prediction-options').querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.choice===choiceLabel(selected)));
  say(`Prediction saved: ${choiceLabel(selected)}. Run and compare.`);persist();renderControls();
}
function buildWorld(){
  if(world)world.destroy();world=createWorld($('world'),{onTileSelect:choosePrediction,reducedMotion:reduced(),flatView});flatView=world.isFlat();
  world.setLevel(level);world.renderState(state,{snap:true});world.setPrediction(currentPrediction());
}
function renderLines(){
  $('code-lines').replaceChildren(...$('program').value.split('\n').map((_,i)=>{const s=document.createElement('span');s.textContent=String(i+1);s.dataset.line=String(i+1);if(state.activeLine===i+1)s.className='is-active';return s;}));
  $('code-lines').scrollTop=$('program').scrollTop;
}
function renderControls(){
  const lesson=currentLesson(),local=lesson.stages.findIndex(s=>s.id===level.id),predicted=(!level.predictions?.length||Boolean(currentPrediction()))&&(!level.checkBeforeRun||progress.stageChecks[level.id]?.correct===true);
  $('run-button').disabled=running||!predicted;$('run-button').textContent=running?'Running…':'Run from dock';
  for(const b of $('prediction-options').querySelectorAll('button'))b.disabled=running||state.pc>0||(progress.completed.includes(level.id)&&Boolean(currentPrediction()));
  $('step-button').disabled=running||!predicted||['blocked','success','complete'].includes(state.status);
  $('reset-button').disabled=!running&&state.pc===0;$('reset-button').textContent=running?'Stop & return':'Back to dock';$('undo-button').disabled=running||!state.history.length;
  $('program').readOnly=level.readonly||running;
  $('continue-button').hidden=!progress.completed.includes(level.id);$('continue-button').disabled=running;
  $('continue-button').textContent=(lesson.choice||local===lesson.stages.length-1)?'Open field journal':'Follow the light →';
  $('hint-button').disabled=hintIndex>=level.hints.length;$('hint-button').textContent=hintIndex>=level.hints.length?'Clues open':`Need a clue?${hintIndex?` (${hintIndex}/${level.hints.length})`:''}`;
  $('chapter-progress').max=LESSONS.length;$('chapter-progress').value=completedLessonNumbers(progress).length;
  $('stage-counter').textContent=lesson.choice?'Your project':`${local+1} of ${lesson.stages.length}`;
  const plant=state.plants?.find(p=>p.x===state.x&&p.z===state.z);
  $('model-label').textContent=`Pip · ${tileLabel(state)} · facing ${DIRECTIONS[state.heading].name}${plant?` · water ${plant.water}/${plant.need}`:''}`;
  renderLines();
}
function recordSuccess(){
  if(!progress.completed.includes(level.id))progress.completed.push(level.id);
  progress.evidence[level.id]={independent:hintIndex===0,clues:hintIndex};
  const prediction=currentPrediction();
  if(prediction){
    const matched=prediction.x===state.x&&prediction.z===state.z&&(!Number.isInteger(prediction.heading)||prediction.heading===state.heading);
    if(progress.stage===0)progress.predictionCorrect=matched;
    say(`${matched?'Your prediction matched.':`You predicted ${choiceLabel(prediction)}; Pip reached ${choiceLabel({...state,heading:Number.isInteger(prediction.heading)?state.heading:undefined})}.`} ${level.success}`);
  }else say(level.success);
  persist();
}
function showState(){
  if(state.status==='success'&&level.verifyAcross){
    const other=LEVELS.find(s=>s.id===level.verifyAcross);let samePlanWorks=false;
    try{samePlanWorks=Boolean(other&&runProgram(other,$('program').value).status==='success');}catch{}
    if(!samePlanWorks)state={...state,status:'complete',message:'This card reaches this light, but not the first garden. Revise one decision that works in both. Your card is safe.'};
  }
  world.renderState(state);
  if(state.status==='success')recordSuccess();
  else if(['blocked','complete'].includes(state.status))say(`${state.message} Undo, edit, or try again.`);
  else if(state.activeLine){const command=state.activeCommand||commands?.[state.pc-1]?.command||'instruction';say(state.message||`Line ${state.activeLine}: ${command}${['step','left','right','water'].includes(command)?'()':''}. Pip is at ${tileLabel(state)}, facing ${DIRECTIONS[state.heading].name}.`);}
  renderControls();
}
function resetTest(message=true){cancelRun();state=initialState(level);commands=null;world.renderState(state,{snap:true});renderControls();if(message)say('Back at the dock. Your program is still here.');}
function parse(){try{commands=parseProgram($('program').value,level.maxCommands,{language:level.language,maxTransitions:level.maxTransitions||200});return true;}catch(error){say(error.message);state={...state,activeLine:error.line||0};renderLines();$('program').focus();return false;}}
async function runAll(){
  resetTest(false);if(!parse())return;running=true;const token=++runToken;renderControls();
  while(token===runToken&&state.pc<commands.length&&!['blocked','success','complete'].includes(state.status)){
    state=advance(level,state,commands);showState();if(['blocked','success','complete'].includes(state.status))break;
    await new Promise(resolve=>setTimeout(resolve,['step','left','right','water'].includes(state.activeCommand||commands[state.pc-1]?.command)?(reduced()?250:650):(reduced()?120:250)));
  }
  if(token===runToken){running=false;renderControls();}
}
function stepOnce(){if(!commands&&!parse())return;state=advance(level,state,commands);showState();}
function notesFor(){
  const lines=['Tiny garden language, not Python. One instruction per line.','step() moves one tile; left() and right() turn in place.'];
  const f=level.language||{};
  if(f.water)lines.push('water() gives one dose to the plant on Pip’s tile.');
  if(f.repeat)lines.push('repeat 3: repeats its indented instructions three times.');
  if(f.sensors)lines.push('dry() checks the plant here. path_clear() checks the tile ahead. Sensors answer true or false.');
  if(f.if)lines.push(`if dry(): runs its indented body only when true.${f.else?' else: chooses the other body when false.':''}`);
  if(f.routines)lines.push('routine tend(): names an indented job. tend() calls it. Defining a job does not run it.');
  if(f.while)lines.push('while dry(): checks again before every repetition. Its body must eventually change the condition.');
  if(f.repeat||f.if||f.routines||f.while)lines.push('Indent each body with two spaces. Tab moves to the next control.');
  return lines.join('\n\n');
}
function closeEnding(){
  $('ending').hidden=true;document.querySelector('.stage').inert=false;document.querySelector('.notebook').inert=false;
  $('lesson-title').setAttribute('tabindex','-1');$('lesson-title').focus({preventScroll:true});
}
function loadStage(index,{focus=true,save=true}={}){
  if(!Number.isInteger(index)||!LEVELS[index])return;
  cancelRun();progress.stage=index;level=LEVELS[index];state=initialState(level);commands=null;hintIndex=progress.hintCounts[level.id]||0;
  $('ending').hidden=true;document.querySelector('.stage').inert=false;document.querySelector('.notebook').inert=false;
  const lesson=currentLesson(),local=lesson.stages.findIndex(s=>s.id===level.id),newVisit=!progress.visitedLessons.includes(lesson.number);
  $('reduce-motion-toggle').checked=progress.reducedMotion;
  $('chapter-label').textContent=`LANTERN GARDEN / ACT ${lesson.act}`;$('scene-title').textContent=level.title;
  if($('lesson-current'))$('lesson-current').textContent=`Lesson ${lesson.number} / ${LESSONS.length}`;
  $('phase-label').textContent=`${String(lesson.number).padStart(2,'0')} / ${level.activityLabel}`;$('lesson-title').textContent=lesson.number===1?level.lesson:lesson.title;
  $('retrieval-copy').textContent=`Recall: ${lesson.retrieval}`;$('story-copy').textContent=level.story;$('goal-copy').textContent=level.goalCopy;$('dialogue-name').textContent='Pip’s field notes';$('dialogue-copy').textContent=level.dialogue;
  $('program').value=level.readonly?level.program:(progress.programs[level.id]??progress.programs[level.carryProgramFrom]??level.program);$('program').maxLength=4000;$('program').readOnly=level.readonly;
  $('program').setAttribute('aria-describedby','command-help goal-copy');$('command-help').textContent=notesFor();
  $('prediction-panel').hidden=!level.predictions?.length&&!level.checkBeforeRun;$('prediction-copy').className=level.checkBeforeRun?'':'visually-hidden';$('prediction-options').setAttribute('aria-label',level.checkBeforeRun?'Sensor observation choices':'Possible final tiles');$('prediction-copy').textContent='Choose before running. A guess is useful.';
  const prediction=currentPrediction();
  $('prediction-options').replaceChildren(...(level.predictions||[]).map(tile=>{const b=document.createElement('button');b.type='button';b.textContent=choiceLabel(tile);b.dataset.choice=choiceLabel(tile);b.dataset.tile=tileLabel(tile);b.setAttribute('aria-pressed',String(prediction&&choiceLabel(prediction)===choiceLabel(tile)));b.addEventListener('click',()=>choosePrediction(tile));return b;}));
  $('prediction-label').textContent=prediction?choiceLabel(prediction):'Choose an ending';
  if(level.checkBeforeRun){
    $('prediction-copy').textContent=level.check.question;
    $('prediction-label').textContent=progress.stageChecks[level.id]?.correct?'Observation saved':'Look before running';
    const entries=level.check.choices.map((choice,index)=>({choice,index}));if(lesson.number%2===0)entries.reverse();
    $('prediction-options').replaceChildren(...entries.map(({choice,index})=>{
      const button=document.createElement('button');button.type='button';button.textContent=choice.label;
      button.setAttribute('aria-pressed',String(progress.stageChecks[level.id]?.choice===index));
      button.addEventListener('click',()=>{
        progress.stageChecks[level.id]={choice:index,correct:choice.correct===true,attempts:(progress.stageChecks[level.id]?.attempts||0)+1};
        for(const item of $('prediction-options').querySelectorAll('button'))item.setAttribute('aria-pressed',String(item===button));
        $('prediction-label').textContent=choice.correct?'Observation saved':'Take another look';
        say(`${choice.correct?'That fits.':'Look again.'} ${choice.feedback}`);persist();renderControls();
      });return button;
    }));
  }

  $('hint-panel').hidden=!hintIndex;$('hint-copy').textContent=hintIndex?level.hints[hintIndex-1]:'';
  $('review-note').textContent='No timer. Trying an idea is part of the job.';
  if(!progress.visitedLessons.includes(lesson.number))progress.visitedLessons.push(lesson.number);
  buildWorld();renderControls();if(save)persist();
  const newConcept=[1,4,5,7,9,10,11,13,14,17].includes(lesson.number);
  say(newVisit&&local===0&&newConcept?level.dialogue:level.predictions?.length&&!prediction?'Start by choosing your prediction. Nothing is graded.':lesson.number>1&&((newVisit&&local===0)||local>0)?`Recall: ${lesson.retrieval}`:'Ready at the dock. Take your time.');
  if(focus){$('lesson-title').setAttribute('tabindex','-1');$('lesson-title').focus({preventScroll:true});}
}
function showEnding(stageOnly=false){
  checkpointStageOnly=stageOnly;cancelRun();renderControls();
  const lesson=currentLesson(),question=stageOnly?level.check:lesson.check;
  $('ending').hidden=false;$('ending').setAttribute('role','dialog');$('ending').setAttribute('aria-modal','true');document.querySelector('.stage').inert=true;document.querySelector('.notebook').inert=true;
  $('ending-title').textContent=stageOnly?'One useful observation.':lesson.number===20?'The garden is yours.':'A light to come back to.';
  $('ending-copy').textContent=stageOnly?'Compare what you expected with what Pip did.':lesson.number===20?'You built, tested, and repaired programs. Next: carry these ideas into real Python.':`${lesson.title} · restored. A quick thought before the next job.`;
  let summary=$('journal-summary');if(!summary){summary=document.createElement('div');summary.id='journal-summary';$('ending-copy').after(summary);}summary.replaceChildren();
  const note=document.createElement('p');note.textContent=stageOnly?'A prediction is a chance to notice something.':`Lesson ${lesson.number} checkpoint · ${lesson.stages.filter(s=>progress.completed.includes(s.id)).length}/${lesson.stages.length} jobs explored.`;summary.append(note);
  const field=document.createElement('fieldset');field.className='recap-question';field.id='recap-question';const legend=document.createElement('legend');legend.textContent=lesson.number===1&&!stageOnly?'One last thought: when right() runs, what changes?':question.question;field.append(legend);
  const choices=document.createElement('div');choices.className='recap-choices';const feedback=document.createElement('p');feedback.id='recap-feedback';feedback.className='recap-feedback';feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');feedback.setAttribute('aria-atomic','true');feedback.textContent='Choose an answer to check your thinking.';
  const entries=question.choices.map((choice,index)=>({choice,index}));if(lesson.number%2===0)entries.reverse();
  for(const {choice,index} of entries){const b=document.createElement('button');b.type='button';b.textContent=choice.label;b.setAttribute('aria-pressed','false');b.setAttribute('aria-describedby','recap-feedback');b.addEventListener('click',()=>{
    for(const item of choices.querySelectorAll('button'))item.setAttribute('aria-pressed',String(item===b));
    const target=stageOnly?progress.stageChecks:progress.checks,key=stageOnly?level.id:lesson.number,attempts=(target[key]?.attempts||0)+1;
    target[key]={choice:index,correct:choice.correct===true,attempts};
    if(!stageOnly&&choice.correct&&!progress.passedLessons.includes(lesson.number))progress.passedLessons.push(lesson.number);
    feedback.textContent=lesson.number===1&&!stageOnly?(choice.correct?'Exactly. A turn changes direction. Only step() moves Pip to another tile.':'Try picturing Pip turning on the spot. The direction changes; the tile stays the same.'):`${choice.correct?'That fits.':'Look again. '} ${choice.feedback}`;
    if(choice.correct&&completedLessonNumbers(progress).length===LESSONS.length)progress.completedAt=new Date().toISOString();
    persist();$('ending-next').disabled=!choice.correct;renderControls();
  });choices.append(b);}field.append(choices,feedback);summary.append(field);
  if(!stageOnly&&lesson.bridge){const bridge=document.createElement('details');bridge.className='disclosure';const heading=document.createElement('summary');heading.textContent=lesson.bridge.title;const copy=document.createElement('p');copy.textContent=lesson.bridge.body;bridge.append(heading,copy);summary.append(bridge);}
  const actions=document.createElement('div');actions.className='journal-actions';const save=document.createElement('button');save.type='button';save.textContent='Save field journal';save.addEventListener('click',downloadSave);actions.append(save);summary.append(actions);
  let back=$('return-garden');if(!back){back=document.createElement('button');back.type='button';back.id='return-garden';back.className='action';back.textContent='Back to the garden';back.addEventListener('click',closeEnding);$('replay-button').after(back);}
  let next=$('ending-next');if(!next){next=document.createElement('button');next.type='button';next.id='ending-next';next.className='action primary';next.addEventListener('click',()=>{if(next.disabled)return;if(checkpointStageOnly){continueStage();}else if(level.lessonNumber===18){closeEnding();showProjectChoice();}else{const nextIndex=LEVELS.findIndex(s=>s.lessonNumber===level.lessonNumber+1);if(nextIndex>=0)loadStage(nextIndex);else{closeEnding();showLessonMap();}}});back.after(next);}
  next.textContent=stageOnly?'Keep exploring':lesson.number===20?'Explore the restored garden':`Start lesson ${lesson.number+1}`;
  next.disabled=!(stageOnly?progress.stageChecks[level.id]?.correct:progress.checks[lesson.number]?.correct);
  $('replay-button').textContent='Try this job again';$('ending-title').setAttribute('tabindex','-1');$('ending-title').focus();
}
function continueStage(){
  if(level.check&&!progress.stageChecks[level.id]?.correct){showEnding(true);return;}
  if(!currentLesson().choice&&LEVELS[progress.stage+1]?.lessonNumber===level.lessonNumber)loadStage(progress.stage+1);else showEnding();
}
function showLessonMap(){
  cancelRun();renderControls();const list=$('lesson-list');list.replaceChildren();const complete=completedLessonNumbers(progress);
  for(let act=1;act<=5;act++){
    const section=document.createElement('section'),title=document.createElement('h3');section.className='lesson-group';title.className='lesson-group-title';title.textContent=`Act ${act} · ${['First light','The nursery','Look and choose','The workshop','Lantern night'][act-1]}`;section.append(title);
    for(const lesson of LESSONS.filter(l=>l.act===act)){
      const button=document.createElement('button');button.type='button';button.className='lesson-choice';const ready=reviewMode||lesson.number===1||complete.includes(lesson.number-1),done=complete.includes(lesson.number);
      button.dataset.lesson=String(lesson.number);button.className=`lesson-choice${done?' is-complete':''}${lesson.number===level.lessonNumber?' is-current':''}${!ready?' is-locked':''}`;const number=document.createElement('span'),name=document.createElement('span'),status=document.createElement('span');number.className='lesson-num';number.textContent=String(lesson.number).padStart(2,'0');name.className='lesson-name';name.textContent=lesson.title;status.className='lesson-status';status.textContent=done?'Restored':!ready?'Later':lesson.number===level.lessonNumber?'Here':'';button.append(number,name,status);button.disabled=!ready;button.setAttribute('aria-label',`Lesson ${lesson.number}: ${lesson.title}${done?', restored':!ready?', available after the preceding checkpoint':''}`);button.setAttribute('aria-current',lesson.number===level.lessonNumber?'step':'false');
      button.addEventListener('click',()=>{closeLessonMap();if(lesson.choice)showProjectChoice();else loadStage(LEVELS.findIndex(s=>s.lessonNumber===lesson.number));});section.append(button);
    }list.append(section);
  }
  const dialog=$('lesson-map');dialog.hidden=false;if(typeof dialog.showModal==='function')dialog.showModal();else{dialog.open=true;dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');document.querySelector('.stage').inert=true;document.querySelector('.notebook').inert=true;}$('lesson-map-close').focus();
}
function showProjectChoice(){
  cancelRun();renderControls();const list=$('lesson-list');list.replaceChildren();const title=document.createElement('h3');title.textContent='Choose your restoration project';list.append(title);
  for(const [index,option] of LESSONS.find(l=>l.number===19).stages.entries()){const button=document.createElement('button');button.type='button';button.className='lesson-choice';button.dataset.stageId=option.id;const number=document.createElement('span'),name=document.createElement('span'),status=document.createElement('span');number.className='lesson-num';number.textContent=String.fromCharCode(65+index);name.className='lesson-name';name.textContent=option.title;status.className='lesson-status';status.textContent='Choose';button.append(number,name,status);button.addEventListener('click',()=>{closeLessonMap();loadStage(LEVELS.findIndex(s=>s.id===option.id));});list.append(button);}
  const dialog=$('lesson-map');dialog.hidden=false;if(typeof dialog.showModal==='function')dialog.showModal();else{dialog.open=true;dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');document.querySelector('.stage').inert=true;document.querySelector('.notebook').inert=true;}$('lesson-map-close').focus();
}
function closeLessonMap(){const dialog=$('lesson-map');if(typeof dialog.close==='function')dialog.close();dialog.open=false;dialog.hidden=true;document.querySelector('.stage').inert=false;document.querySelector('.notebook').inert=false;$('lesson-map-button').focus();}
function downloadSave(){const blob=new Blob([exportProgress(progress)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='lantern-garden-field-journal.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);say('Field journal exported. Keep it if you change devices or clear browser data.');}
$('ending').addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();closeEnding();return;}if(event.key!=='Tab')return;const buttons=[...$('ending').querySelectorAll('button:not([disabled])')];if(!buttons.length)return;const first=buttons[0],last=buttons[buttons.length-1];if(event.shiftKey&&(document.activeElement===first||document.activeElement===$('ending-title'))){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}});
$('run-button').addEventListener('click',runAll);$('step-button').addEventListener('click',stepOnce);$('reset-button').addEventListener('click',()=>resetTest());
$('undo-button').addEventListener('click',()=>{cancelRun();state=undo(state);showState();if(state.pc===0)say('Undid the first command. Pip is back at the dock.');});
$('hint-button').addEventListener('click',()=>{if(hintIndex<level.hints.length){hintIndex++;progress.hintCounts[level.id]=hintIndex;$('hint-panel').hidden=false;$('hint-copy').textContent=level.hints[hintIndex-1];say(`Clue ${hintIndex}: ${level.hints[hintIndex-1]}`);persist();renderControls();}});
$('continue-button').addEventListener('click',continueStage);
$('replay-button').addEventListener('click',()=>{closeEnding();if(!level.readonly){$('program').value='';delete progress.programs[level.id];}resetTest(false);persist();say('A fresh try. Your completed checkpoint is safe.');});
$('program').addEventListener('input',()=>{progress.programs[level.id]=$('program').value;resetTest(false);persist();say('Instructions changed. Pip is ready at the dock.');});
$('program').addEventListener('scroll',()=>{$('code-lines').scrollTop=$('program').scrollTop;});
$('program').addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){event.preventDefault();if(!$('run-button').disabled)runAll();}

});
$('export-button').addEventListener('click',downloadSave);$('import-button').addEventListener('click',()=>$('import-file').click());
$('import-file').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;if(file.size>MAX_BACKUP_BYTES){say('Choose a Lantern Garden save under 1 MB.');event.target.value='';return;}try{const next=importProgress(await file.text());if(!confirm('Replace progress on this device with this field journal? Export your current progress first if you need a backup.'))return;progress=next;persist();loadStage(progress.stage);say('Field journal restored.');}catch{say('That file could not be restored. Your current progress is unchanged.');}finally{event.target.value='';}});
$('erase-button').addEventListener('click',()=>{if(confirm('Erase saved progress on this device? Export a field journal first if you want a backup.')){cancelRun();let removed=true;try{storage.removeItem(STORAGE_KEY);}catch{removed=false;}progress=blankProgress();loadStage(0,{save:false});const error=persist();say(!error?'Saved progress erased. A fresh garden is ready.':removed?'Saved progress erased. New progress cannot be saved; export a field journal before leaving.':'A fresh unsaved chapter is ready, but stored progress could not be erased. The old save may return on reload.');}});
$('progress-button').addEventListener('click',()=>{const controls=$('save-controls');controls.hidden=!controls.hidden;$('progress-button').setAttribute('aria-expanded',String(!controls.hidden));});
$('lesson-map').addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();closeLessonMap();return;}if(event.key!=='Tab')return;const buttons=[...$('lesson-map').querySelectorAll('button:not([disabled])')];if(!buttons.length)return;const first=buttons[0],last=buttons[buttons.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}});
$('lesson-map-button').addEventListener('click',showLessonMap);$('lesson-map-close').addEventListener('click',closeLessonMap);$('lesson-map').addEventListener('cancel',event=>{event.preventDefault();closeLessonMap();});
$('flat-toggle').addEventListener('click',()=>{const requestedFlat=!world.isFlat();flatView=requestedFlat;buildWorld();$('view-status').textContent=!requestedFlat&&flatView?'3D graphics could not start. The flat map is still available, and your route is unchanged.':`${flatView?'Flat map':'3D garden'} view. Pip and your instructions are unchanged.`;});
$('reduce-motion-toggle').checked=progress.reducedMotion;$('reduce-motion-toggle').addEventListener('change',event=>{progress.reducedMotion=event.target.checked;persist();buildWorld();});
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installEvent=event;$('install-button').hidden=false;});
$('install-button').addEventListener('click',async()=>{if(installEvent){await installEvent.prompt();installEvent=null;$('install-button').hidden=true;}});window.addEventListener('appinstalled',()=>{$('install-button').hidden=true;});
async function setupOffline() {
  if(location.protocol==='file:'){ setOfflineStatus('Self-contained review · works offline');$('install-button').hidden=true;return; }
  if(!('serviceWorker' in navigator)){ setOfflineStatus('Offline setup unavailable in this browser');return; }
  if(import.meta.env.DEV){setOfflineStatus('Development preview · offline setup after build');return;}
  setOfflineStatus('Preparing offline files…');
  let preparationTimer;
  try {
    const registration=await Promise.race([
      (async()=>{
        const registration=await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
        const installing=registration.installing || registration.waiting;
        if(installing)await new Promise((resolve,reject)=>{
          const check=()=>{if(installing.state==='activated')resolve();else if(installing.state==='redundant')reject(new Error('Offline files could not be cached'));};
          installing.addEventListener('statechange',check);check();
        });
        await navigator.serviceWorker.ready;
        return registration;
      })(),
      new Promise((_,reject)=>{preparationTimer=setTimeout(()=>reject(new Error('Offline preparation timed out')),45000);})
    ]);
    // A successful worker installation guarantees its precache completed.
    const check=()=>{setOfflineStatus(navigator.onLine ? 'Ready for offline play' : 'Offline · garden ready');};
    if(registration.active)check();else navigator.serviceWorker.addEventListener('controllerchange',check,{once:true});
    window.addEventListener('online',check);window.addEventListener('offline',check);
  } catch { setOfflineStatus('Offline setup failed. Stay online and reload to retry.'); }
  finally {clearTimeout(preparationTimer);}
}
loadStage(progress.stage,{focus:false,save:false});
if(loaded.error){$('save-status').textContent=loaded.error;say(loaded.error);}
setupOffline();
