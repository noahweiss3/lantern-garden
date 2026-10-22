/** Shared data-only builders for the tiny garden teaching language. */
export const tiles = pairs => pairs.map(([x, z]) => ({ x, z }));
export const row = (x, z, count) => Array.from({ length: count }, (_, i) => [x + i, z]);
export const column = (x, z, count) => Array.from({ length: count }, (_, i) => [x, z + i]);
export const plant = (x, z, need = 1, water = 0) => ({ x, z, need, water });
export const code = (...lines) => lines.join('\n');
export const features = number => ({
  water: number >= 4, repeat: number >= 5, sensors: number >= 9,
  if: number >= 10, else: number >= 11, routines: number >= 13, while: number >= 17
});
export const stage = (number, id, title, options) => ({
  id, title, width: 6, height: 5, scenerySeed: 50 + number * 13 + id.length,
  lessonNumber: number, activityLabel: 'Try it', role: 'practice',
  phase: 'Explore & test', lesson: title, readonly: false, maxCommands: 40,
  language: features(number), plants: [], program: '',
  ...options,
  tiles: tiles(options.tiles),
});
export const check = (question, right, wrong, why) => ({ question, choices: [
  { label: right, correct: true, feedback: why },
  { label: wrong, correct: false, feedback: why }
] });
export const lesson = (number, act, title, objective, intro, retrieval, knowledgeCheck, stages, extra = {}) => ({
  number, act, title, objective, intro, retrieval, check: knowledgeCheck, stages, ...extra
});

