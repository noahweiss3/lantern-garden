/** Lantern Garden is a tiny, bounded robot DSL, not Python or JavaScript. */
export const DIRECTIONS = Object.freeze([
  { name: 'north', dx: 0, dz: -1 }, { name: 'east', dx: 1, dz: 0 },
  { name: 'south', dx: 0, dz: 1 }, { name: 'west', dx: -1, dz: 0 }
]);
export const COMMANDS = Object.freeze(['step', 'left', 'right']);
export const MAX_LINES = 24;
export const MAX_TRANSITIONS = 1000;
const MAX_NESTING = 8, MAX_REPEAT = 100, MAX_ROUTINES = 16;
const FEATURES = ['water', 'repeat', 'sensors', 'if', 'else', 'routines', 'while'];
const SENSORS = ['dry', 'path_clear'];
const RESERVED = new Set([...COMMANDS, 'water', ...SENSORS, 'repeat', 'if', 'else', 'routine', 'while', 'return', 'constructor', 'prototype', '__proto__']);
// Only compiler-produced control instructions are executable. This metadata is not user source.
const programs = new WeakMap();
export class ProgramError extends Error {
  constructor(message, line = 0) { super(message); this.name = 'ProgramError'; this.line = line; }
}
function ownValue(object, key) {
  if (!object || typeof object !== 'object') return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  return descriptor && 'value' in descriptor ? descriptor.value : undefined;
}
function languageFlags(options) {
  const language = ownValue(options, 'language') || options;
  return Object.fromEntries(FEATURES.map(feature => [feature, ownValue(language, feature) === true]));
}
function error(line, message) { throw new ProgramError(`Line ${line}: ${message}`, line); }
function transitionLimit(value) {
  return Number.isInteger(value) && value > 0 ? Math.min(value, MAX_TRANSITIONS) : MAX_TRANSITIONS;
}
/**
 * Parse only this DSL. New syntax is opt-in via flags or { language: flags }.
 * The result remains an array of { command, line } for original robot commands.
 * Control instructions have original source lines; phase:'next' is a loop retest.
 * maxCommands counts written statements/headers, never generated control plumbing.
 */
export function parseProgram(source, maxCommands = MAX_LINES, languageOrOptions = {}) {
  if (maxCommands && typeof maxCommands === 'object') {
    languageOrOptions = maxCommands;
    maxCommands = ownValue(languageOrOptions, 'maxCommands') ?? MAX_LINES;
  }
  if (!Number.isSafeInteger(maxCommands) || maxCommands < 1) throw new ProgramError('Choose a positive whole-number command limit.');
  if (typeof source !== 'string' || source.length > 4000) throw new ProgramError('This program is a little too long. Keep it to 4,000 characters.');
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  if (lines.length > 100) throw new ProgramError('There are too many lines. Keep it to 100 lines.');
  const flags = languageFlags(languageOrOptions), extended = FEATURES.some(feature => flags[feature]);
  const tokens = [];
  let written = 0;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i], text = raw.trim();
    if (!text || text.startsWith('#')) continue;
    if (extended && /\t/.test(raw)) error(i + 1, 'use spaces, not tabs. Each block uses two spaces.');
    const spaces = raw.length - raw.trimStart().length;
    if (extended && (spaces % 2 || /[^ ]/.test(raw.slice(0, spaces)))) error(i + 1, 'indent blocks with exactly two spaces per level.');
    tokens.push({ text, indent: extended ? spaces / 2 : 0, line: i + 1 });
    written++;
    if (written > maxCommands) throw new ProgramError(`Use no more than ${maxCommands} commands for this route.`, i + 1);
  }
  if (!tokens.length) throw new ProgramError('Add a command first. Try step().');
  const routines = new Map(), calls = [];
  let position = 0;
  function requireFeature(feature, token, explanation) {
    if (!flags[feature]) error(token.line, `${explanation} is not available in this lesson yet.`);
  }
  function sensor(token, name) {
    requireFeature('sensors', token, 'Sensors');
    if (!SENSORS.includes(name)) error(token.line, 'use dry() or path_clear() as the condition.');
    return name;
  }
  function body(token, indent, routineName) {
    if (indent >= MAX_NESTING) error(token.line, `keep blocks to ${MAX_NESTING} levels or fewer.`);
    if (!tokens[position] || tokens[position].indent <= indent) error(token.line, 'add a command below this header, indented by two spaces.');
    if (tokens[position].indent !== indent + 1) error(tokens[position].line, 'indent this block by exactly two more spaces.');
    return block(indent + 1, routineName);
  }
  function block(indent, routineName = null) {
    const nodes = [];
    while (position < tokens.length) {
      const token = tokens[position];
      if (token.indent < indent) break;
      if (token.indent > indent) error(token.line, 'only indent after a block header, using two spaces.');
      if (token.text === 'else:') break;
      position++;
      let match;
      if ((match = /^(step|left|right|water)\(\)$/.exec(token.text))) {
        if (match[1] === 'water') requireFeature('water', token, 'water()');
        nodes.push({ command: match[1], line: token.line });
      } else if ((match = /^repeat ([0-9]+):$/.exec(token.text))) {
        requireFeature('repeat', token, 'repeat');
        const count = Number(match[1]);
        if (!Number.isSafeInteger(count) || count > MAX_REPEAT) error(token.line, `repeat a whole number from 0 to ${MAX_REPEAT} times.`);
        nodes.push({ command: 'repeat', line: token.line, count, body: body(token, indent, routineName) });
      } else if ((match = /^(if|while) ([a-z_]+)\(\):$/.exec(token.text))) {
        requireFeature(match[1], token, match[1]);
        const node = { command: match[1], line: token.line, sensor: sensor(token, match[2]), body: body(token, indent, routineName) };
        if (node.command === 'if' && tokens[position]?.indent === indent && tokens[position]?.text === 'else:') {
          const otherwise = tokens[position++];
          requireFeature('else', otherwise, 'else');
          node.elseLine = otherwise.line;
          node.otherwise = body(otherwise, indent, routineName);
        }
        nodes.push(node);
      } else if ((match = /^routine ([a-z][a-z0-9_]{0,23})\(\):$/.exec(token.text))) {
        requireFeature('routines', token, 'Routines');
        if (indent !== 0 || routineName) error(token.line, 'define routines at the left edge, outside other blocks.');
        const name = match[1];
        if (RESERVED.has(name)) error(token.line, 'choose a new routine name, such as tend().');
        if (routines.has(name)) error(token.line, `routine ${name}() is already defined.`);
        if (routines.size >= MAX_ROUTINES) error(token.line, `use no more than ${MAX_ROUTINES} routines.`);
        const node = { command: 'routine', name, line: token.line, body: [] };
        routines.set(name, node);
        node.body = body(token, indent, name);
        nodes.push(node);
      } else if ((match = /^([a-z][a-z0-9_]{0,23})\(\)$/.exec(token.text))) {
        requireFeature('routines', token, 'Named routine calls');
        if (RESERVED.has(match[1])) error(token.line, 'that name is reserved. Use a robot command or your own routine.');
        const node = { command: 'call', name: match[1], line: token.line, owner: routineName };
        calls.push(node); nodes.push(node);
      } else {
        if (!extended) error(token.line, 'use step(), left(), or right(), one per line.');
        error(token.line, 'use a Lantern Garden command or block header. Blocks need a colon and two-space indentation; this is not Python.');
      }
    }
    return nodes;
  }
  const tree = block(0);
  if (position < tokens.length) error(tokens[position].line, 'else: must follow an if block at the same indentation.');
  for (const call of calls) if (!routines.has(call.name)) error(call.line, `add a definition for routine ${call.name}().`);
  // A small static call graph rejects direct and indirect recursion before execution.
  const edges = new Map([...routines.keys()].map(name => [name, []]));
  for (const call of calls) if (call.owner) edges.get(call.owner).push(call);
  const visiting = new Set(), visited = new Set();
  function visit(name) {
    if (visited.has(name)) return;
    visiting.add(name);
    for (const call of edges.get(name)) {
      if (visiting.has(call.name)) error(call.line, 'routines cannot call themselves, even through another routine.');
      visit(call.name);
    }
    visiting.delete(name); visited.add(name);
  }
  for (const name of routines.keys()) visit(name);
  const commands = [], targets = new Map(), pendingCalls = [];
  function emit(node) { commands.push(node); return commands.length - 1; }
  function compile(nodes) {
    for (const node of nodes) {
      const { command, line } = node;
      if (COMMANDS.includes(command) || command === 'water') emit({ command, line });
      else if (command === 'repeat' || command === 'while') {
        const start = emit({ command, line, ...(command === 'repeat' ? { count: node.count } : { sensor: node.sensor }), end: -1 });
        compile(node.body);
        const end = emit({ command, line, phase: 'next', start });
        commands[start].end = end;
      } else if (command === 'if') {
        const index = emit({ command, line, sensor: node.sensor, falseTarget: -1 });
        compile(node.body);
        if (node.otherwise) {
          const otherwise = emit({ command: 'else', line: node.elseLine, end: -1 });
          commands[index].falseTarget = commands.length;
          compile(node.otherwise);
          commands[otherwise].end = commands.length;
        } else commands[index].falseTarget = commands.length;
      } else if (command === 'routine') {
        const index = emit({ command, line, name: node.name, end: -1 });
        targets.set(node.name, commands.length);
        compile(node.body);
        emit({ command: 'return', line, name: node.name });
        commands[index].end = commands.length;
      } else {
        pendingCalls.push(emit({ command: 'call', line, name: node.name, target: -1 }));
      }
    }
  }
  compile(tree);
  for (const index of pendingCalls) commands[index].target = targets.get(commands[index].name);
  for (const instruction of commands) Object.freeze(instruction);
  programs.set(commands, { flags, limit: transitionLimit(ownValue(languageOrOptions, 'maxTransitions')) });
  return Object.freeze(commands);
}
export function tileLabel(tile) { return `${String.fromCharCode(65 + tile.x)}${tile.z + 1}`; }
export function isWalkable(level, x, z) { return level.tiles.some(t => t.x === x && t.z === z); }
export function initialState(level) {
  return { ...level.start, status: 'idle', activeLine: 0, activeCommand: '', activeInstruction: null, pc: 0,
    trail: [{ x: level.start.x, z: level.start.z }], plants: (level.plants || []).map(plant => ({ x: plant.x, z: plant.z, need: plant.need, water: plant.water ?? 0 })),
    controlStack: [], callStack: [], transitions: 0, history: [], message: '' };
}
function snapshot(state) {
  const { history, ...copy } = state;
  return { ...copy, trail: state.trail.map(t => ({ ...t })), plants: (state.plants || []).map(plant => ({ ...plant })),
    controlStack: (state.controlStack || []).map(frame => ({ ...frame })), callStack: (state.callStack || []).map(frame => ({ ...frame })) };
}
function sense(level, state, name, line) {
  if (name === 'dry') return state.plants.some(plant => plant.x === state.x && plant.z === state.z && plant.water < plant.need);
  if (name === 'path_clear') {
    const direction = DIRECTIONS[state.heading];
    return Boolean(direction && isWalkable(level, state.x + direction.dx, state.z + direction.dz));
  }
  throw new ProgramError('Unknown garden sensor.', line);
}
function finish(level, state) {
  const goal = level.goal;
  const reached = !goal || (state.x === goal.x && state.z === goal.z);
  const watered = state.plants.every(plant => plant.water >= plant.need);
  const heading = goal?.heading ?? level.goalHeading;
  const facing = heading === undefined || state.heading === heading;
  state.status = reached && watered && facing ? 'success' : 'complete';
  if (state.status === 'success') state.message = state.plants.length ? 'Garden cared for. Relay reached.' : 'Relay reached.';
  else if (!watered) state.message = 'Program complete. Some plants still need water. Check the garden and try again.';
  else if (!reached) state.message = `Pip stopped at ${tileLabel(state)}. The relay is at ${tileLabel(goal)}.`;
  else state.message = `Pip reached the relay. Finish facing ${DIRECTIONS[heading]?.name || 'the marked direction'}.`;
  return state;
}
/** Exactly one bounded action/header/retest/call/return. Never evaluates host code. */
export function advance(level, state, commands) {
  if (['blocked', 'success', 'complete'].includes(state.status)) return state;
  if (state.pc >= commands.length) return { ...state, status: 'complete', message: 'Program complete.' };
  const instruction = commands[state.pc], metadata = programs.get(commands);
  if (!instruction || (!COMMANDS.includes(instruction.command) && !metadata)) throw new ProgramError('Unknown robot command.', instruction?.line);
  const known = [...COMMANDS, 'water', 'repeat', 'while', 'if', 'else', 'routine', 'call', 'return'];
  if (!known.includes(instruction.command)) throw new ProgramError('Unknown robot command.', instruction.line);
  const limit = Math.min(metadata?.limit || MAX_TRANSITIONS, transitionLimit(level.maxTransitions));
  if ((state.transitions || 0) >= limit) return pauseBudget({ ...snapshot(state), history: state.history });
  const next = { ...snapshot(state), activeLine: instruction.line, activeCommand: instruction.command === 'call' ? instruction.name : instruction.command,
    activeInstruction: instruction, pc: state.pc + 1, status: 'running', message: '', transitions: (state.transitions || 0) + 1,
    history: [...state.history, snapshot(state)] };
  if (instruction.command === 'left') next.heading = (state.heading + 3) % 4;
  if (instruction.command === 'right') next.heading = (state.heading + 1) % 4;
  if (instruction.command === 'step') {
    const direction = DIRECTIONS[state.heading], x = state.x + direction.dx, z = state.z + direction.dz;
    if (!isWalkable(level, x, z)) {
      next.status = 'blocked';
      next.message = `Pip paused at the edge on line ${instruction.line}. No harm done. Try a different command.`;
      return next;
    }
    next.x = x; next.z = z; next.trail.push({ x, z });
  }
  if (instruction.command === 'water') {
    const plant = next.plants.find(plant => plant.x === next.x && plant.z === next.z);
    if (!plant) {
      next.status = 'blocked'; next.message = `Pip paused on line ${instruction.line}. There is no plant on this tile to water. No harm done.`;
      return next;
    }
    if (plant.water < plant.need) plant.water = Math.min(plant.need, plant.water + 1);
  }
  if (instruction.command === 'repeat' || instruction.command === 'while') {
    const repeating = instruction.command === 'repeat';
    if (instruction.phase === 'next') {
      const frame = next.controlStack[next.controlStack.length - 1];
      if (!frame || frame.start !== instruction.start || frame.type !== instruction.command) throw new ProgramError('This block could not be resumed. Reset and try again.', instruction.line);
      const again = repeating ? --frame.remaining > 0 : sense(level, next, frame.sensor, instruction.line);
      if (again) next.pc = frame.start + 1;
      else next.controlStack.pop();
      next.message = repeating
        ? `Line ${instruction.line}: ${again ? `${frame.remaining} repeat passes left.` : 'Repeat finished.'}`
        : `Line ${instruction.line}: ${frame.sensor}() is ${again}. ${again ? 'Pip repeats the block.' : 'The loop is finished.'}`;
    } else {
      const enter = repeating ? instruction.count > 0 : sense(level, next, instruction.sensor, instruction.line);
      if (enter) next.controlStack.push({ type: instruction.command, start: state.pc, end: instruction.end,
        ...(repeating ? { remaining: instruction.count } : { sensor: instruction.sensor }) });
      else next.pc = instruction.end + 1;
      next.message = repeating
        ? `Line ${instruction.line}: ${enter ? `Repeat starts with ${instruction.count} passes.` : 'repeat 0 skips this block.'}`
        : `Line ${instruction.line}: ${instruction.sensor}() is ${enter}. ${enter ? 'Pip runs the block.' : 'Pip skips the block.'}`;
    }
  }
  if (instruction.command === 'if') {
    const answer = sense(level, next, instruction.sensor, instruction.line);
    if (!answer) next.pc = instruction.falseTarget;
    next.message = `Line ${instruction.line}: ${instruction.sensor}() is ${answer}. Pip ${answer ? 'runs' : 'skips'} the if body.`;
  }
  if (instruction.command === 'else' || instruction.command === 'routine') {
    next.pc = instruction.end;
    next.message = instruction.command === 'routine'
      ? `Line ${instruction.line}: ${instruction.name}() is defined, not called. Pip skips its body.`
      : `Line ${instruction.line}: the if body ran, so Pip skips the else body.`;
  }
  if (instruction.command === 'call') {
    if (next.callStack.length >= MAX_ROUTINES) throw new ProgramError('Too many routine calls are waiting. Reset and simplify the calls.', instruction.line);
    next.callStack.push({ returnPc: next.pc, controlDepth: next.controlStack.length, name: instruction.name });
    next.pc = instruction.target;
    next.message = `Line ${instruction.line}: call ${instruction.name}(). Pip starts that routine.`;
  }
  if (instruction.command === 'return') {
    const frame = next.callStack.pop();
    if (!frame || frame.name !== instruction.name || frame.controlDepth !== next.controlStack.length) throw new ProgramError('This routine could not return. Reset and try again.', instruction.line);
    next.pc = frame.returnPc;
    next.message = `Line ${instruction.line}: ${instruction.name}() finished. Pip returns to its caller.`;
  }
  if (next.pc >= commands.length) return finish(level, next);
  if (next.transitions >= limit) return pauseBudget(next);
  return next;
}
function pauseBudget(state) {
  state.status = 'blocked';
  state.message = 'Pip paused after a long run to give the garden a rest. No harm done. Check that each while block can change its condition, then reset or undo.';
  return state;
}
export function undo(state) {
  if (!state.history.length) return state;
  return { ...state.history[state.history.length - 1], history: state.history.slice(0, -1) };
}
export function runProgram(level, source) {
  const commands = parseProgram(source, level.maxCommands || MAX_LINES, { language: level.language || {}, maxTransitions: level.maxTransitions });
  let state = initialState(level);
  while (state.pc < commands.length && !['blocked', 'success', 'complete'].includes(state.status)) state = advance(level, state, commands);
  return state;
}
