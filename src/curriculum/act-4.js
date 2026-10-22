import { row, column, plant, code, features, stage, check, lesson } from './shared.js';

/** Act 4: lessons 13–16. */
export const ACT_4 = [
  lesson(13, 4, 'A name for a care job', 'Read a supplied routine body and call it by name.',
    'The workshop shares a named care card so its instructions can be reused.', 'How does a repeat body group several instructions into one job?',
    check('Defining routine tend(): does what?', 'Stores the body for a later call', 'Immediately runs the body', 'A definition names a body. tend() calls it; only then does the body run.'), [
      stage(13, 'call-care-card', 'The workshop care card', {
        start: { x: 1, z: 2, heading: 1 }, goal: { x: 2, z: 2 }, tiles: row(1, 2, 2), plants: [plant(1, 2)],
        activityLabel: 'Call a routine', story: 'A workshop card already describes one familiar care-and-move job.',
        goalCopy: 'Read the supplied tend body. Add tend() below it to perform the job.',
        dialogue: 'routine tend(): names the indented instructions. The definition does not run them. A later tend() call runs that body, then returns to the next instruction.',
        program: code('routine tend():', '  water()', '  step()', '', '# Call tend() below.'),
        solution: code('routine tend():', '  water()', '  step()', '', 'tend()'),
        hints: ['Keep the two supplied body instructions unchanged.', 'A call uses the name followed by empty parentheses.', 'Add tend() on an unindented line below the definition.'],
        success: 'The call ran the visible body. A named job is still made of ordinary instructions.'
      }),
      stage(13, 'call-care-twice', 'Two jobs, one card', {
        start: { x: 1, z: 3, heading: 1 }, goal: { x: 3, z: 3 }, tiles: row(1, 3, 3), plants: [plant(1, 3), plant(2, 3)],
        activityLabel: 'Call it again', role: 'transfer', story: 'Two workshop pots can use the same care card in turn.',
        goalCopy: 'Keep the supplied routine and call it twice to care for both pots.',
        dialogue: 'Each call starts the same body from Pip’s current state. After the first call, Pip stands on the next pot, ready for another call.',
        program: code('routine tend():', '  water()', '  step()', '', 'tend()'),
        solution: code('routine tend():', '  water()', '  step()', '', 'tend()', 'tend()'),
        hints: ['Trace where the first tend() leaves Pip.', 'Pip is then standing on the second pot.', 'Add a second unindented tend() call after the first one.'],
        success: 'One visible body performed two separate care jobs through two calls.'
      })
    ]),

  lesson(14, 4, 'Write a useful helper', 'Define a no-argument routine from a familiar sequence and call it.',
    'Pip is ready for a care card written by you.', 'What is the difference between a routine definition and its call?',
    check('Which line actually calls a helper named tend?', 'tend()', 'routine tend():', 'routine tend(): defines the body. The separate tend() instruction calls it.'), [
      stage(14, 'define-care-helper', 'Your care helper', {
        start: { x: 1, z: 1, heading: 1 }, goal: { x: 2, z: 1 }, tiles: row(1, 1, 2), plants: [plant(1, 1)],
        activityLabel: 'Define', story: 'A blank workshop card needs the familiar care-and-move sequence.',
        goalCopy: 'Define tend with water() then step(), and keep the call below the definition.',
        dialogue: 'Choose a name that describes the job. Put the familiar instructions two spaces inside routine tend():, then call tend() outside the definition.',
        program: code('routine tend():', '  # Add the two body instructions.', '', 'tend()'),
        solution: code('routine tend():', '  water()', '  step()', '', 'tend()'),
        hints: ['The body should care for the current pot before moving.', 'Replace the comment with water() and step(), both indented two spaces.', 'Keep tend() unindented so it calls the completed definition.'],
        success: 'You defined a useful sequence, then called it to do the work.'
      }),
      stage(14, 'make-north-helper', 'A helper for the north bed', {
        start: { x: 3, z: 3, heading: 0 }, goal: { x: 3, z: 1 }, tiles: column(3, 1, 3), plants: [plant(3, 3), plant(3, 2)],
        role: 'transfer', activityLabel: 'Define and reuse', story: 'The north bed needs the same care job at two neighboring pots.',
        goalCopy: 'Write your own care-and-move helper, then call it twice along the north bed.',
        dialogue: 'A helper does not have a fixed compass direction. Its step() uses the direction Pip faces when each call runs.',
        solution: code('routine tend():', '  water()', '  step()', '', 'tend()', 'tend()'),
        hints: ['The needed body is still water() followed by step().', 'Place both calls outside the definition.', 'Define routine tend(): with the two instructions, then write tend() twice.'],
        success: 'Your own helper worked twice on a bed facing a new direction.'
      })
    ]),

  lesson(15, 4, 'Repair the shared job', 'Debug one routine body and verify the repair at both call sites.',
    'A shared care card has spread the same mistake to two pots.', 'Where do you edit instructions that every call should use?',
    check('Two calls use the same wrong body. Where should you repair the shared mistake?', 'In the routine definition', 'By copying a new body beside every call', 'Changing the definition repairs the shared instructions used by both calls.'), [
      stage(15, 'shared-order-bug', 'The shared order bug', {
        start: { x: 1, z: 2, heading: 1 }, goal: { x: 3, z: 2 }, tiles: row(1, 2, 3), plants: [plant(1, 2), plant(2, 2)],
        activityLabel: 'Debug a body', story: 'The workshop helper leaves the first pot thirsty on every care round.',
        goalCopy: 'Find the first wrong action inside tend, repair the body once, and test both calls.',
        dialogue: 'Follow a call into its body. Compare the first body instruction with the intended care job. Both calls use whatever body the definition now contains.',
        program: code('routine tend():', '  step()', '  water()', '', 'tend()', 'tend()'),
        solution: code('routine tend():', '  water()', '  step()', '', 'tend()', 'tend()'),
        hints: ['The first plant needs care before Pip leaves it.', 'The body’s step() currently happens too soon.', 'Swap the body lines: water() first, then step(). Keep both calls.'],
        success: 'One body repair fixed the job at both call sites.'
      }),
      stage(15, 'shared-dose-bug', 'The shared dose bug', {
        start: { x: 1, z: 3, heading: 1 }, goal: { x: 3, z: 3 }, tiles: row(1, 3, 3), plants: [plant(1, 3, 2), plant(2, 3, 2)],
        role: 'transfer', activityLabel: 'Repair and retest', story: 'Two deeper pots expose a different mistake in a shared care helper.',
        goalCopy: 'Repair the helper so each call gives two doses before moving. Retest both pots.',
        dialogue: 'Keep the repeated dose inside the helper, but keep departure after that repeat. One repaired body should serve both pots.',
        program: code('routine tend():', '  water()', '  step()', '', 'tend()', 'tend()'),
        solution: code('routine tend():', '  repeat 2:', '    water()', '  step()', '', 'tend()', 'tend()'),
        hints: ['Each plant still needs a second dose before Pip moves.', 'Use repeat 2: for water(), inside the helper.', 'Indent repeat 2: two spaces, water() four spaces, and step() two spaces. Keep both tend() calls.'],
        success: 'You checked both uses of the repaired helper, not only the first one.'
      })
    ]),

  lesson(16, 4, 'Your workshop routine', 'Design and reuse a helper to restore two separate beds.',
    'The workshop can reopen when two separated beds share a reliable care routine.', 'Why is a shared helper easier to repair than copied instruction sequences?',
    check('What makes a useful helper here?', 'A complete job that can be called in both beds', 'A name without a body or calls', 'A useful helper groups a coherent job and is actually reused where that job is needed.'), [
      stage(16, 'paired-beds', 'The paired workshop beds', {
        start: { x: 1, z: 3, heading: 1 }, goal: { x: 3, z: 1 },
        tiles: [[1, 3], [2, 3], [3, 3], [3, 2], [3, 1]], plants: [plant(1, 3), plant(3, 2)],
        role: 'transfer', activityLabel: 'Build a reusable job', story: 'The workshop’s two small beds sit on different sides of a corner.',
        goalCopy: 'Define a water-and-step helper. Reuse it at both beds, with travel instructions between calls.',
        dialogue: 'Keep travel between the beds outside the helper. The helper should describe only the care job that both beds share.',
        solution: code('routine tend():', '  water()', '  step()', '', 'tend()', 'step()', 'left()', 'step()', 'tend()'),
        hints: ['The first call waters B4 and moves to C4.', 'Outside the helper, move to D4, turn left, then move to D3.', 'Call the same water-and-step helper on D3 to water the second bed and finish at D2.'],
        success: 'Your helper crossed two separate beds while the surrounding route stayed outside it.'
      }),
      stage(16, 'rain-aware-helper', 'The rain-aware workshop', {
        start: { x: 4, z: 3, heading: 3 }, goal: { x: 2, z: 1 },
        tiles: [[4, 3], [3, 3], [2, 3], [2, 2], [2, 1]], plants: [plant(4, 3), plant(2, 2, 1, 1)],
        role: 'transfer', activityLabel: 'Reuse with a decision', story: 'Rain has cared for one of the workshop’s two beds but missed the other.',
        goalCopy: 'Reuse a helper at both beds. Let a familiar if check skip water where it is not needed.',
        dialogue: 'A helper may contain a decision you already know. Checking dry() makes the same named care job fit both the dry and rain-fed bed.',
        solution: code('routine tend():', '  if dry():', '    water()', '  step()', '', 'tend()', 'step()', 'right()', 'step()', 'tend()'),
        hints: ['Use if dry(): with water() inside, then step() after the if but still inside the helper.', 'After the first call, travel west once, turn right, and move north once.', 'Call the helper again at C3. Its if skips the already watered plant, then step() reaches C2.'],
        success: 'A reused helper made a sensible decision in each bed, without duplicating its body.'
      })
    ]),
];
