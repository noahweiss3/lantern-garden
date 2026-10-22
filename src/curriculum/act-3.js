import { row, column, plant, code, features, stage, check, lesson } from './shared.js';

/** Act 3: lessons 9–12. */
export const ACT_3 = [
  lesson(9, 3, 'Ask the garden', 'Read yes-or-no sensor answers without confusing questions with actions.',
    'Pip’s restored sensors can describe a plant and the tile ahead.', 'How does one dose change a plant’s care marker?',
    check('After a one-dose plant is watered, what does dry() answer?', 'No', 'Yes', 'dry() asks whether the plant under Pip still needs a dose. It does not water it.'), [
      stage(9, 'read-dry-sensor', 'Read the care sensor', {
        checkBeforeRun: true,
        start: { x: 1, z: 2, heading: 1 }, goal: { x: 2, z: 2 }, tiles: row(1, 2, 2), plants: [plant(1, 2)],
        activityLabel: 'Predict a sensor', story: 'Pip checks a thirsty plant before giving it a measured dose.',
        goalCopy: 'Answer what dry() reads at the start, then test the supplied care sequence.',
        dialogue: 'dry() answers yes when the plant under Pip needs more water, otherwise no. path_clear() asks whether the next tile is walkable. Neither sensor changes anything.',
        program: code('water()', 'step()'), readonly: true, solution: code('water()', 'step()'),
        check: check('Before this program runs, what does dry() answer?', 'Yes: the plant needs water', 'No: the plant is already cared for', 'At the start, the plant has zero of its one required doses, so dry() answers yes.'),
        hints: ['Read the plant’s care marker before pressing Run.', 'A sensor reports the world; it does not change it.', 'This plant still needs its dose, so dry() answers yes at the start.'],
        success: 'The sensor described the need; water() changed it. Those are different jobs.'
      }),
      stage(9, 'read-path-sensor', 'Read the path sensor', {
        checkBeforeRun: true,
        start: { x: 1, z: 3, heading: 0 }, goal: { x: 3, z: 3 }, tiles: row(1, 3, 3), plants: [plant(1, 3, 1, 1)],
        role: 'transfer', activityLabel: 'Read, then route', story: 'The north path has washed away, leaving a safe path to the east.',
        goalCopy: 'Read path_clear() from Pip’s starting direction, then write a safe route to D4.',
        dialogue: 'The path sensor looks one tile ahead, using Pip’s current direction. It does not ask whether some other route exists.',
        check: check('At the start, does path_clear() answer yes?', 'No: north is a gap', 'Yes: there is a path to the east', 'Pip faces north. The eastward path is not the tile ahead until Pip turns.'),
        solution: code('right()', 'step()', 'step()'),
        hints: ['Look at Pip’s north-facing arrow, not just the visible eastward path.', 'The tile immediately north is missing, so the answer is no.', 'Turn right, then take two steps east. The sensor itself does not turn Pip.'],
        success: 'You read a sensor from the actual starting state, then chose actions separately.'
      })
    ]),

  lesson(10, 3, 'Care only when needed', 'Use one if block to conditionally perform an action.',
    'Some pots received rain, so their care cards need a decision.', 'Does dry() change a plant, or report its current need?',
    check('If dry() answers no, what happens to the indented water()?', 'It is skipped', 'It still runs once', 'An if body runs only when its sensor answers yes. The program then continues after the block.'), [
      stage(10, 'care-dry-pot', 'The thirsty pot', {
        start: { x: 1, z: 2, heading: 1 }, goal: { x: 2, z: 2 }, tiles: row(1, 2, 2), plants: [plant(1, 2)],
        activityLabel: 'Trace the if', sharedProgramKey: 'conditional-care',
        story: 'A thirsty pot needs care before Pip moves on.', goalCopy: 'Run the if program and notice why its water() instruction executes.',
        dialogue: 'if dry(): checks the sensor once. When the answer is yes, its indented water() runs. The unindented step() runs either way.',
        program: code('if dry():', '  water()', 'step()'), solution: code('if dry():', '  water()', 'step()'),
        check: check('At the start, will the if body run?', 'Yes: this plant is dry', 'No: every if body is skipped', 'The plant needs its dose, so dry() answers yes and water() runs.'),
        hints: ['First ask whether the plant under Pip needs a dose.', 'The answer is yes on this board.', 'The body waters once; the step() after the block then reaches the light.'],
        success: 'The condition was true, so Pip performed the care action.'
      }),
      stage(10, 'care-rainy-pot', 'The rain-fed pot', {
        start: { x: 3, z: 3, heading: 3 }, goal: { x: 2, z: 3 }, tiles: row(2, 3, 2), plants: [plant(3, 3, 1, 1)],
        activityLabel: 'Test another state', role: 'transfer', sharedProgramKey: 'conditional-care', carryProgramFrom: 'care-dry-pot',
        story: 'Rain has already supplied this pot’s single dose.', goalCopy: 'Test the same if program on a cared-for plant. Predict whether water() runs.',
        dialogue: 'The program is unchanged, but the world is different. A false condition skips only the indented body, not the following step().',
        program: code('if dry():', '  water()', 'step()'), solution: code('if dry():', '  water()', 'step()'),
        check: check('How many new doses will this program give?', 'Zero', 'One', 'dry() answers no for the already cared-for plant, so the water() instruction is skipped.'),
        hints: ['The care marker is already full.', 'dry() now answers no.', 'Skip the water() body and follow the unindented step() to the light.'],
        success: 'One program handled both a thirsty plant and one that needed no new dose.'
      })
    ]),

  lesson(11, 3, 'One path or the other', 'Trace the two alternatives of an if/else decision.',
    'A washed-out junction needs a safe alternative to walking forward.', 'When an if body is skipped, where does execution continue?',
    check('path_clear() answers no. Which body runs?', 'The else body only', 'Both bodies', 'An if/else chooses exactly one body, then continues below the whole decision.'), [
      stage(11, 'clear-junction', 'The open junction', {
        start: { x: 1, z: 3, heading: 0 }, goal: { x: 1, z: 1 }, tiles: column(1, 1, 3), activityLabel: 'Trace alternatives',
        story: 'The first junction still has its forward stepping stone.', goalCopy: 'Trace the decision: move if clear, otherwise turn right, then take the final step.',
        dialogue: 'else: gives the alternative when the if sensor answers no. Its body uses the same two-space indentation. Only one of the two bodies runs.',
        program: code('if path_clear():', '  step()', 'else:', '  right()', 'step()'),
        solution: code('if path_clear():', '  step()', 'else:', '  right()', 'step()'),
        check: check('Which instruction runs inside this decision?', 'step()', 'right()', 'The tile north is present, so path_clear() answers yes and the first body runs.'),
        hints: ['The northward tile is walkable.', 'A yes answer selects the if body, not the else body.', 'One step runs in the if body, then one step runs after the whole decision.'],
        success: 'The yes branch ran, the alternative was skipped, and the program continued.'
      }),
      stage(11, 'washed-junction', 'The washed-out junction', {
        start: { x: 1, z: 3, heading: 0 }, goal: { x: 2, z: 3 }, tiles: row(1, 3, 2), activityLabel: 'Trace the alternative', role: 'transfer',
        story: 'The next junction has lost its forward stone but keeps its eastward exit.',
        goalCopy: 'Use the same decision where forward is blocked. Watch the alternative turn run.',
        dialogue: 'A no answer selects right() here. The final step() is outside both bodies, so it runs after either choice.',
        program: code('if path_clear():', '  step()', 'else:', '  right()', 'step()'),
        solution: code('if path_clear():', '  step()', 'else:', '  right()', 'step()'),
        check: check('What happens before the final unindented step()?', 'Pip turns right', 'Pip takes a blocked step', 'The sensor answers no, so the else body turns Pip toward the safe eastward tile.'),
        hints: ['There is no tile immediately north of Pip.', 'The no answer chooses the else body.', 'right() turns east. The following unindented step() reaches C4.'],
        success: 'The same decision chose a safe alternative when the forward path was missing.'
      })
    ]),

  lesson(12, 3, 'One plan, two gardens', 'Create one branch program that works in contrasting worlds.',
    'Two delivery paths need one instruction card that handles either junction.', 'How many branches run in one if/else decision?',
    check('A decision works on an open path. What is a useful next test?', 'Try the same code where forward is blocked', 'Only repeat the open-path test', 'Changing the world without changing the code tests whether both alternatives work.'), [
      stage(12, 'one-plan-open', 'The open delivery path', {
        start: { x: 2, z: 3, heading: 0 }, goal: { x: 2, z: 1 }, tiles: column(2, 1, 3),
        role: 'transfer', activityLabel: 'Make one plan', sharedProgramKey: 'two-gardens',
        story: 'Pip carries a care card through the first of two delivery gardens.',
        goalCopy: 'Write: if forward is clear, step; otherwise turn right. Then step once after the decision.',
        dialogue: 'This card must work in another garden too. Keep the sensor decision instead of replacing it with a route for only this board.',
        solution: code('if path_clear():', '  step()', 'else:', '  right()', 'step()'),
        hints: ['Use path_clear() as the if condition.', 'Put step() in the if body and right() in the else body.', 'After both bodies, add one unindented step().'],
        success: 'Your card works on the open path. Its alternative still needs a different test.'
      }),
      stage(12, 'one-plan-blocked', 'The other delivery garden', {
        verifyAcross: 'one-plan-open',
        start: { x: 2, z: 3, heading: 0 }, goal: { x: 3, z: 3 }, tiles: row(2, 3, 2),
        role: 'transfer', activityLabel: 'Test one plan twice', sharedProgramKey: 'two-gardens', carryProgramFrom: 'one-plan-open',
        story: 'The second delivery garden has a gap where the first one had a forward path.',
        goalCopy: 'Test one decision in both gardens. Revise it if needed; the same card must work in both.',
        dialogue: 'Look for evidence, not just a green result. Which body ran this time, and why was the other body skipped?',
        program: code('if path_clear():', '  step()', 'else:', '  right()', 'step()'),
        solution: code('if path_clear():', '  step()', 'else:', '  right()', 'step()'),
        check: check('Why can the unchanged program work here too?', 'Its sensor selects the other body', 'The if body always runs', 'The changed world makes path_clear() answer no, selecting the safe right() alternative.'),
        hints: ['Keep the same if/else shape from the previous board.', 'The northward gap makes the condition false.', 'The alternative right() and the final step() reach D4.'],
        success: 'This same card succeeds in both gardens by choosing different actions.'
      })
    ]),
];
