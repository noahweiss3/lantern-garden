import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProgram, initialState, advance, undo, runProgram, ProgramError, MAX_TRANSITIONS } from '../src/engine.js';

const all = { water:true, repeat:true, sensors:true, if:true, else:true, routines:true, while:true };
const row = (length = 5) => ({
  start:{x:0,z:0,heading:1}, goal:{x:length-1,z:0},
  tiles:Array.from({length}, (_,x)=>({x,z:0})), language:all, maxCommands:100
});
const garden = (need = 2) => ({ ...row(1), plants:[{x:0,z:0,need}] });
function trace(level, source, options = level.language) {
  const code = parseProgram(source, level.maxCommands, options), states = [initialState(level)];
  while (states.at(-1).pc < code.length && !['blocked','complete','success'].includes(states.at(-1).status)) {
    states.push(advance(level, states.at(-1), code));
    assert.ok(states.length <= MAX_TRANSITIONS + 2, 'interpreter remains bounded');
  }
  return {code,states,state:states.at(-1)};
}

test('new syntax is opt-in and legacy instruction shape remains unchanged',()=>{
  assert.deepEqual(parseProgram('# original\n  step()\nleft()'),[{command:'step',line:2},{command:'left',line:3}]);
  for(const source of ['water()','repeat 2:\n  step()','if dry():\n  step()','while path_clear():\n  step()','routine walk():\n  step()\nwalk()']) assert.throws(()=>parseProgram(source),ProgramError);
  assert.throws(()=>parseProgram('water()',24,{repeat:true}),/water\(\).*not available/);
  assert.throws(()=>parseProgram('if dry():\n  left()',24,{if:true}),/Sensors.*not available/);
  assert.throws(()=>parseProgram('if dry():\n  left()\nelse:\n  right()',24,{if:true,sensors:true}),/else.*not available/);
  assert.deepEqual(parseProgram('water()',24,{language:{water:true}}),[{command:'water',line:1}]);
  assert.deepEqual(parseProgram('water()',{maxCommands:2,language:{water:true}}),[{command:'water',line:1}]);
});

test('counted repeats execute exactly the count and preserve header source lines',()=>{
  const {state,states,code} = trace(row(4),'# a short path\nrepeat 3:\n  step()');
  assert.equal(state.status,'success'); assert.equal(state.x,3);
  assert.equal(state.transitions,7); assert.equal(state.history.length,7);
  assert.deepEqual(states.slice(1).map(s=>s.activeLine),[2,3,2,3,2,3,2]);
  assert.equal(code[2].command,'repeat'); assert.equal(code[2].phase,'next');
  assert.ok(states.slice(0,-1).every(s=>s.status!=='success'),'arrival is not success before the retest finishes');
});

test('repeat zero skips its body and nested counts finish with empty stacks',()=>{
  assert.equal(runProgram(row(2),'repeat 0:\n  right()\nstep()').status,'success');
  const level = row(5), state = runProgram(level,'repeat 2:\n  repeat 2:\n    step()');
  assert.equal(state.status,'success'); assert.equal(state.x,4); assert.deepEqual(state.controlStack,[]);
});

test('water is one capped dose, dry changes deterministically, and level is immutable',()=>{
  const level=garden(2), original=structuredClone(level);
  const {states,state}=trace(level,'water()\nif dry():\n  water()\nwater()');
  assert.equal(states[1].plants[0].water,1); assert.equal(states[3].plants[0].water,2);
  assert.equal(state.plants[0].water,2); assert.equal(state.status,'success');
  assert.deepEqual(level,original);
  assert.equal(runProgram(garden(2),'water()').status,'complete');
  assert.equal(runProgram({...row(1),plants:[{x:0,z:0,need:2,water:1}]},'water()').status,'success');
});

test('water off a plant pauses without changing garden or position',()=>{
  const level=row(1), state=runProgram(level,'water()');
  assert.equal(state.status,'blocked'); assert.match(state.message,/no plant.*No harm done/);
  assert.deepEqual([state.x,state.z],[0,0]); assert.deepEqual(undo(state),initialState(level));
});

test('if and else choose only one branch, including nested branches',()=>{
  const source='if dry():\n  water()\nelse:\n  right()';
  assert.equal(runProgram(garden(1),source).heading,1);
  const noPlant=runProgram(row(1),source); assert.equal(noPlant.heading,2); assert.equal(noPlant.status,'success');
  const nested=runProgram(garden(1),'if path_clear():\n  step()\nelse:\n  if dry():\n    water()\n  else:\n    left()');
  assert.equal(nested.status,'success'); assert.equal(nested.plants[0].water,1); assert.equal(nested.heading,1);
  assert.equal(runProgram(row(2),'if dry():\n  right()\nstep()').status,'success');
});

test('routines do not run at definition, calls return, and forward calls work',()=>{
  const definition=runProgram(row(1),'routine turn():\n  right()');
  assert.equal(definition.heading,1); assert.equal(definition.transitions,1); assert.equal(definition.status,'success');
  const {state,states}=trace(row(3),'routine walk():\n  step()\nwalk()\nwalk()');
  assert.equal(state.status,'success'); assert.equal(state.x,2); assert.deepEqual(state.callStack,[]);
  assert.deepEqual(states.slice(1).map(s=>s.activeLine),[1,3,2,1,4,2,1]);
  const forward=runProgram(row(2),'walk()\nroutine walk():\n  step()'); assert.equal(forward.status,'success');
  const composed=runProgram(row(3),'routine pair():\n  single()\n  single()\nroutine single():\n  step()\npair()');
  assert.equal(composed.status,'success'); assert.deepEqual(composed.callStack,[]);
});

test('calls and loop control restore one transition at a time with exact undo',()=>{
  const level={...row(3),plants:[{x:1,z:0,need:2},{x:2,z:0,need:2}]};
  const source='routine tend():\n  while dry():\n    water()\nrepeat 2:\n  step()\n  tend()';
  const {states,state}=trace(level,source); assert.equal(state.status,'success');
  let undone=state;
  for(let index=states.length-2;index>=0;index--) { undone=undo(undone); assert.deepEqual(undone,states[index]); }
  assert.deepEqual(undone,initialState(level));
  for(const before of states) {
    const saved=structuredClone(before); advance(level,before,parseProgram(source,100,all)); assert.deepEqual(before,saved,'advance never mutates earlier states');
  }
});

test('while handles initial false and conditions changed by movement or watering',()=>{
  const zero=runProgram(row(1),'while path_clear():\n  step()'); assert.equal(zero.transitions,1); assert.equal(zero.status,'success');
  const movement=runProgram(row(5),'while path_clear():\n  step()'); assert.equal(movement.status,'success'); assert.equal(movement.x,4); assert.deepEqual(movement.controlStack,[]);
  const watering=runProgram(garden(3),'while dry():\n  water()'); assert.equal(watering.plants[0].water,3); assert.equal(watering.status,'success');
  const empty=runProgram(row(1),'while dry():\n  water()'); assert.equal(empty.transitions,1); assert.equal(empty.status,'success');
});

test('non-progressing while and large nested repetition pause within the run budget',()=>{
  const level=garden(1), source='while dry():\n  left()';
  const {state,states,code}=trace(level,source);
  assert.equal(state.status,'blocked'); assert.equal(state.transitions,MAX_TRANSITIONS); assert.equal(state.history.length,MAX_TRANSITIONS);
  assert.match(state.message,/paused.*No harm done.*condition/);
  assert.equal(advance(level,state,code),state); assert.deepEqual(undo(state),states.at(-2));
  const repeat=runProgram(row(1),'repeat 100:\n  repeat 100:\n    right()'); assert.equal(repeat.status,'blocked'); assert.equal(repeat.transitions,MAX_TRANSITIONS);
  const shorter=trace(level,source,{...all,maxTransitions:7}).state; assert.equal(shorter.transitions,7); assert.equal(shorter.status,'blocked');
  const levelBudget=runProgram({...level,maxTransitions:5},source); assert.equal(levelBudget.transitions,5); assert.equal(levelBudget.status,'blocked');
});

test('completion requires goal, every plant, optional heading, and the full program',()=>{
  const level={...row(2),plants:[{x:0,z:0,need:1}],goal:{x:1,z:0,heading:0}};
  assert.equal(runProgram(level,'step()\nleft()').status,'complete');
  assert.equal(runProgram(level,'water()\nstep()').status,'complete');
  assert.equal(runProgram(level,'water()\nstep()\nleft()').status,'success');
  assert.equal(runProgram(level,'water()\nstep()\nleft()\nright()').status,'complete');
  assert.equal(runProgram({...garden(1),goal:undefined},'water()').status,'success');
});

test('parser rejects malformed blocks, host syntax, parameters, recursion, and unsafe names',()=>{
  const invalid=[
    'repeat 101:\n  step()', 'repeat -1:\n  step()', 'repeat 2.5:\n  step()',
    'repeat 2:\nstep()', 'repeat 2:\n    step()', 'repeat 2:\n step()', 'repeat 2:\n\tstep()',
    '  step()', 'else:\n  step()', 'if dry():\n  step()\n  else:\n    right()',
    'routine f(x):\n  step()', 'routine f():\n  return()', 'routine f():\n  f()\nf()',
    'routine a():\n  b()\nroutine b():\n  a()\na()',
    'routine a():\n  routine b():\n    step()', 'routine a():\n  step()\nroutine a():\n  step()',
    'routine constructor():\n  step()', 'routine __proto__():\n  step()', 'missing()',
    'if globalThis():\n  step()', 'if dry(1):\n  water()', 'while true:\n  step()',
    'step(); step()', 'globalThis.process.exit()', 'water(2)', 'repeat(2)',
    'routine f():\n  step()\nf(1)', 'if path_clear():\n  step()\nelse:\n  step()\nelse:\n  step()'
  ];
  for(const source of invalid) assert.throws(()=>parseProgram(source,100,all),ProgramError,source);
  assert.throws(()=>parseProgram('repeat 1:\n'.repeat(9).split('\n').map((line,i)=>'  '.repeat(i)+line).join('\n')+'  '.repeat(9)+'step()',100,all),ProgramError);
});

test('static limits count source statements rather than generated instructions',()=>{
  assert.equal(parseProgram('repeat 2:\n  step()',2,all).length,3);
  assert.throws(()=>parseProgram('repeat 2:\n  step()',1,all),/no more than 1/);
  assert.throws(()=>parseProgram('\n'.repeat(101),100,all),ProgramError);
  assert.throws(()=>parseProgram('x'.repeat(4001),100,all),ProgramError);
  assert.throws(()=>parseProgram('step()',0,all),ProgramError);
  const inherited=Object.create({water:true}); assert.throws(()=>parseProgram('water()',24,inherited),ProgramError);
  let getterRead=false; const getter={get water(){getterRead=true; return true;}};
  assert.throws(()=>parseProgram('water()',24,getter),ProgramError); assert.equal(getterRead,false);
});

test('extended command arrays are immutable and forged control code is not executable',()=>{
  const code=parseProgram('repeat 1:\n  step()',24,all); assert.equal(Object.isFrozen(code),true); assert.ok(code.every(Object.isFrozen));
  for(const command of ['water','repeat','while','if','else','routine','call','return','eval']) assert.throws(()=>advance(row(1),initialState(row(1)),[{command,line:1}]),ProgramError);
});

test('500 seeded branch/repeat programs agree with an independent tree interpreter',()=>{
  let seed=48271; const random=n=>{seed=(seed*16807)%2147483647;return seed%n;};
  const directions=[[0,-1],[1,0],[0,1],[-1,0]];
  function tree(depth=0) {
    return Array.from({length:1+random(2)},()=>{
      const type=random(depth<2?7:4);
      if(type<4) return {type:['step','left','right','water'][type]};
      if(type===4) return {type:'repeat',count:random(4),body:tree(depth+1)};
      return {type:'if',sensor:random(2)?'dry':'path_clear',body:tree(depth+1),other:tree(depth+1)};
    });
  }
  function source(nodes,depth=0) {
    const pad='  '.repeat(depth);
    return nodes.map(node=>{
      if(node.type==='repeat') return `${pad}repeat ${node.count}:\n${source(node.body,depth+1)}`;
      if(node.type==='if') return `${pad}if ${node.sensor}():\n${source(node.body,depth+1)}\n${pad}else:\n${source(node.other,depth+1)}`;
      return `${pad}${node.type}()`;
    }).join('\n');
  }
  for(let example=0;example<500;example++) {
    const level={...row(1),start:{x:1,z:1,heading:random(4)},goal:{x:random(3),z:random(3)},tiles:[],plants:[]};
    for(let x=0;x<3;x++) for(let z=0;z<3;z++){level.tiles.push({x,z});level.plants.push({x,z,need:1+random(3),water:random(2)});}
    const expected={...level.start,plants:structuredClone(level.plants),blocked:false};
    function clear(){const [dx,dz]=directions[expected.heading];return expected.x+dx>=0&&expected.x+dx<3&&expected.z+dz>=0&&expected.z+dz<3;}
    function execute(nodes){
      for(const node of nodes){
        if(expected.blocked) return;
        if(node.type==='repeat'){for(let i=0;i<node.count;i++)execute(node.body);}
        else if(node.type==='if'){
          const plant=expected.plants.find(p=>p.x===expected.x&&p.z===expected.z);
          execute((node.sensor==='dry'?plant.water<plant.need:clear())?node.body:node.other);
        }else if(node.type==='left')expected.heading=(expected.heading+3)%4;
        else if(node.type==='right')expected.heading=(expected.heading+1)%4;
        else if(node.type==='water'){const plant=expected.plants.find(p=>p.x===expected.x&&p.z===expected.z);if(plant.water<plant.need)plant.water++;}
        else if(!clear())expected.blocked=true;
        else {const [dx,dz]=directions[expected.heading];expected.x+=dx;expected.z+=dz;}
      }
    }
    const nodes=tree(),text=source(nodes);execute(nodes);const actual=runProgram(level,text);
    assert.deepEqual([actual.x,actual.z,actual.heading,actual.plants],[expected.x,expected.z,expected.heading,expected.plants],`example ${example}: ${text}`);
    const won=!expected.blocked&&expected.x===level.goal.x&&expected.z===level.goal.z&&expected.plants.every(p=>p.water>=p.need);
    assert.equal(actual.status,expected.blocked?'blocked':won?'success':'complete');
  }
});
