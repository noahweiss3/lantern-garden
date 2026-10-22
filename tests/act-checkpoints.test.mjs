import test from 'node:test';
import assert from 'node:assert/strict';
import { LESSONS, STAGES } from '../src/curriculum.js';
import { initialState, runProgram, undo, parseProgram, ProgramError } from '../src/engine.js';

// Deliberately size-independent: runs against each separately committed act checkpoint.
test('act checkpoint: every currently implemented activity meets its actual goal and reverses completely',()=>{
  assert.ok(LESSONS.length>=4&&LESSONS.length<=20);
  for(const level of STAGES){
    const authored=structuredClone(level),start=initialState(level);
    let state=runProgram(level,level.solution);
    assert.equal(state.status,'success',level.id);
    assert.deepEqual([state.x,state.z],[level.goal.x,level.goal.z],level.id);
    assert.ok(state.plants.every(p=>p.water>=p.need),level.id);
    if(level.goal.heading!==undefined)assert.equal(state.heading,level.goal.heading,level.id);
    assert.deepEqual(state.callStack,[],level.id);assert.deepEqual(state.controlStack,[],level.id);
    assert.ok(state.transitions<=200,`${level.id}: fits interactive budget`);
    while(state.history.length)state=undo(state);
    assert.deepEqual(state,start,`${level.id}: complete undo`);
    assert.deepEqual(level,authored,`${level.id}: authored data unchanged`);
  }
});

test('act checkpoint: source capability gates track every currently implemented lesson',()=>{
  const samples={water:'water()',repeat:'repeat 2:\n  step()',if:'if path_clear():\n  step()',else:'if path_clear():\n  step()\nelse:\n  right()',routines:'routine travel():\n  step()\ntravel()',while:'while path_clear():\n  step()'};
  for(const level of STAGES)for(const [feature,source] of Object.entries(samples)){
    if(level.language[feature])assert.doesNotThrow(()=>parseProgram(source,40,level.language),`${level.id}: ${feature}`);
    else assert.throws(()=>parseProgram(source,40,level.language),ProgramError,`${level.id}: future ${feature} unavailable`);
  }
});
