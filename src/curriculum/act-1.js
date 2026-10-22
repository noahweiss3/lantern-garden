import { LEVELS as OPENING } from '../levels.js';
import { row, column, plant, code, features, stage, check, lesson } from './shared.js';

const openingCopy = [
  { story: 'After the storm, Pip follows a short program to wake the first garden light.', goalCopy: 'Predict Pip’s final tile, then run the program and compare.', dialogue: 'Instructions run from top to bottom. step() moves forward one tile. left() turns on the spot.' },
  { story: 'A bent signpost has sent the next light’s instructions the wrong way.', goalCopy: 'Watch the program, then repair the turn that sends Pip away from the relay.', dialogue: 'right() turns on the spot too. Watch the direction arrow before changing a command.' },
  { story: 'The last beacon waits beyond an unfamiliar set of stepping stones.', goalCopy: 'Write a route to D3. Pip starts facing north.', dialogue: 'Trace a route first. Then write, test, and change one part at a time.' }
];
const openingSolutions = [OPENING[0].program, code('step()', 'step()', 'right()', 'step()'), code('step()', 'right()', 'step()', 'step()')];


/** Act 1: lessons 1–4. */
export const ACT_1 = [
  lesson(1, 1, 'A light to follow', 'Read, repair, and write a short sequence.',
    'Bring the first three lights back after the storm.', 'What changes when Pip turns?',
    check('What does right() change?', 'Pip’s direction', 'Pip’s tile', 'A turn changes direction without moving Pip.'),
    OPENING.map((original, i) => ({ ...original, ...openingCopy[i], lessonNumber: 1,
      activityLabel: ['Predict', 'Repair', 'Make'][i], role: i === 2 ? 'transfer' : 'practice',
      language: features(1), solution: openingSolutions[i], plants: [] }))),

  lesson(2, 1, 'Turn, then travel', 'Track both the final tile and the final direction.',
    'The survey lantern needs Pip to face the next garden bed.', 'Which command moves Pip, and which commands only turn?',
    check('Pip turns right at D3. What stays the same?', 'The tile', 'The direction', 'Turning changes the direction, not the tile.'), [
      stage(2, 'survey-facing', 'The survey lantern', {
        start: { x: 1, z: 3, heading: 0 }, goal: { x: 3, z: 2, heading: 2 }, goalHeading: 2,
        tiles: [[1, 3], [1, 2], [2, 2], [3, 2], [3, 3]], activityLabel: 'Predict',
        story: 'Pip checks the survey lantern before pointing toward the sleeping seed beds.',
        goalCopy: 'Predict the final tile and direction, then test the five instructions.',
        dialogue: 'Keep two things in mind: the tile Pip occupies and the direction Pip faces. A turn changes only one.',
        program: code('step()', 'right()', 'step()', 'step()', 'right()'), readonly: true,
        solution: code('step()', 'right()', 'step()', 'step()', 'right()'),
        predictions: [{ x: 3, z: 2, heading: 2 }, { x: 3, z: 2, heading: 1 }, { x: 3, z: 3, heading: 2 }],
        hints: ['Trace the first step north from B4.', 'Two eastward steps after the turn reach D3.', 'The last right() leaves Pip at D3, facing south.'],
        success: 'Same tile, new direction. The last turn mattered even without a move.'
      }),
      stage(2, 'seed-bed-facing', 'Face the seed beds', {
        start: { x: 4, z: 1, heading: 3 }, goal: { x: 2, z: 2, heading: 2 }, goalHeading: 2,
        tiles: [[4, 1], [3, 1], [2, 1], [2, 2], [2, 3]], activityLabel: 'Make', role: 'transfer',
        story: 'The second survey point sits beside a different stretch of seed beds.',
        goalCopy: 'Reach C3 facing south. Start by tracing from Pip’s west-facing arrow.',
        dialogue: 'Left and right depend on Pip’s direction, not on the screen. Try imagining yourself facing the same way.',
        solution: code('step()', 'step()', 'left()', 'step()'),
        hints: ['Pip starts facing west at E2.', 'Travel two tiles west before changing direction.', 'Use step(), step(), left(), step(). Pip finishes at C3 facing south.'],
        success: 'You kept track of position and direction on a new route.'
      })
    ]),

  lesson(3, 1, 'Find the first mismatch', 'Distinguish unreadable instructions from a readable but incorrect plan.',
    'Two damaged instruction cards need different kinds of repair.', 'What should happen after each instruction, before you press Run?',
    check('A valid right() turns the wrong way. What needs repair?', 'The plan', 'The spelling of right()', 'Readable instructions can still describe the wrong plan.'), [
      stage(3, 'torn-instruction', 'The torn instruction', {
        start: { x: 1, z: 3, heading: 0 }, goal: { x: 2, z: 2 }, tiles: [[1, 3], [1, 2], [2, 2]],
        activityLabel: 'Repair syntax', story: 'A torn card has lost part of its first instruction.',
        goalCopy: 'Repair the unreadable instruction, then guide Pip to the workshop light.',
        dialogue: 'Syntax is the shape of an instruction. step() needs both parentheses. A syntax problem stops the program before Pip moves.',
        program: code('step(', 'right()', 'step()'), solution: code('step()', 'right()', 'step()'),
        hints: ['Read the error’s line number before changing the route.', 'Compare the first line with step().', 'Add the missing ) to line 1. Keep the other two lines.'],
        success: 'The instructions are readable again. This repair changed syntax, not the route.'
      }),
      stage(3, 'first-wrong-turn', 'The first wrong turn', {
        start: { x: 1, z: 3, heading: 0 }, goal: { x: 3, z: 2 },
        tiles: [[1, 3], [1, 2], [2, 2], [2, 1], [3, 2]], activityLabel: 'Find the mismatch', role: 'transfer',
        story: 'The next card is readable, but its route leaves the workshop light unvisited.',
        goalCopy: 'Find the first instruction that differs from your planned route, then repair it.',
        dialogue: 'A logic problem means the instructions are readable but the plan is wrong. Compare expected and actual results one instruction at a time.',
        program: code('step()', 'right()', 'step()', 'left()', 'step()'),
        solution: code('step()', 'right()', 'step()', 'step()'),
        hints: ['The first three instructions put Pip at C3 facing east.', 'The next needed move is east toward D3, not a turn north.', 'Remove line 4, left(). The final step() then reaches D3.'],
        success: 'You found the first mismatch instead of changing instructions at random.'
      })
    ]),

  lesson(4, 1, 'A little care', 'Use water() to change the garden, then sequence movement and care independently.',
    'The lanterns reveal seedlings that need a little water.', 'How did you tell a syntax problem from a wrong plan?',
    check('Pip runs water(). What changes?', 'The plant on Pip’s tile', 'Pip’s position', 'water() adds one dose to the plant under Pip without moving.'), [
      stage(4, 'first-seedling', 'The first seedling', {
        start: { x: 1, z: 3, heading: 1 }, goal: { x: 3, z: 3 }, tiles: row(1, 3, 3), plants: [plant(2, 3)],
        activityLabel: 'Try water()', story: 'One thirsty seedling sits on the path to the nursery light.',
        goalCopy: 'Stop on the seedling, give one dose with water(), then reach the light.',
        dialogue: 'water() cares for the plant on Pip’s current tile. It does not move Pip. Plants show how many doses they need.',
        program: code('step()', 'water()'), solution: code('step()', 'water()', 'step()'),
        hints: ['The seedling is one tile east of Pip.', 'Water while Pip is on the seedling’s tile, before moving away.', 'Use step(), water(), step().'],
        success: 'The plant is cared for and the nursery light is reached.'
      }),
      stage(4, 'care-round', 'Your first care round', {
        start: { x: 1, z: 3, heading: 0 }, goal: { x: 3, z: 2 },
        tiles: [[1, 3], [1, 2], [2, 2], [3, 2]], plants: [plant(1, 2), plant(3, 2)],
        activityLabel: 'Make a care round', role: 'transfer', story: 'Two seedlings wait along a bent path into the nursery.',
        goalCopy: 'Water both seedlings and finish at D3. Build the sequence without a supplied route.',
        dialogue: 'Reaching the light is only part of this job. Check every plant’s care marker before calling the round finished.',
        solution: code('step()', 'water()', 'right()', 'step()', 'step()', 'water()'),
        hints: ['First move north onto the nearby seedling.', 'Water the first plant before turning east.', 'Use step(), water(), right(), step(), step(), water().'],
        success: 'You combined movement, turning, and care in your own sequence.'
      })
    ]),
];
