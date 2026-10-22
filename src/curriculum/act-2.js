import { row, column, plant, code, features, stage, check, lesson } from './shared.js';

/** Act 2: lessons 5–8. */
export const ACT_2 = [
  lesson(5, 2, 'Count the care', 'Use counted repetition for an action needed a known number of times.',
    'The deeper nursery pots need several identical doses.', 'Does water() move Pip to the next plant?',
    check('A pot needs three doses. What belongs inside repeat 3:?', 'One water() instruction', 'Three water() instructions', 'The body runs three times, so one water() produces three doses.'), [
      stage(5, 'three-doses', 'A deeper pot', {
        start: { x: 1, z: 2, heading: 1 }, goal: { x: 2, z: 2 }, tiles: row(1, 2, 2), plants: [plant(1, 2, 3)],
        activityLabel: 'Count', story: 'A deep nursery pot needs three measured doses before Pip leaves.',
        goalCopy: 'Change the repeat count so the pot receives three doses, then move to the light.',
        dialogue: 'repeat 3: runs its indented instructions three times. Use two spaces before water(). The unindented step() runs after the repeat finishes.',
        program: code('repeat 2:', '  water()', 'step()'), solution: code('repeat 3:', '  water()', 'step()'),
        hints: ['Read the pot’s three care marks.', 'The single indented water() runs once for each repeat.', 'Change repeat 2: to repeat 3:. Keep step() outside the block.'],
        success: 'Three doses, one repeated instruction. The count described a real care need.'
      }),
      stage(5, 'four-dose-pot', 'The rain-shadow pot', {
        start: { x: 4, z: 1, heading: 3 }, goal: { x: 3, z: 2 },
        tiles: [[4, 1], [3, 1], [3, 2]], plants: [plant(3, 1, 4)], role: 'transfer', activityLabel: 'Make',
        story: 'A pot sheltered from the rain needs four doses on the way to the nursery gate.',
        goalCopy: 'Reach the pot, use a counted repeat for four doses, then finish at D3.',
        dialogue: 'Choose the count from the plant’s need, not from the number of tiles. Only the indented action repeats.',
        solution: code('step()', 'repeat 4:', '  water()', 'left()', 'step()'),
        hints: ['Move one tile west to the pot before watering.', 'Repeat water() four times while staying on the pot.', 'Use step(), repeat 4: with water() inside, then left() and step() outside.'],
        success: 'You chose a new count and fitted the repeat into your own route.'
      })
    ]),

  lesson(6, 2, 'Inside and outside', 'Distinguish commands before, inside, and after a repeat block.',
    'A care card has put the right instructions in the wrong places.', 'What tells you which instructions repeat?',
    check('An unindented step() follows a repeat block. When does it run?', 'Once, after the block', 'On every repetition', 'Indentation marks the body. The next unindented instruction runs after all repetitions.'), [
      stage(6, 'care-card-order', 'Sort the care card', {
        start: { x: 1, z: 3, heading: 1 }, goal: { x: 3, z: 3 }, tiles: row(1, 3, 3), plants: [plant(2, 3, 2)],
        activityLabel: 'Repair placement', story: 'The care card walks past a thirsty pot instead of tending it.',
        goalCopy: 'Move onto the pot first, repeat only water(), then leave for the light.',
        dialogue: 'Before the block: reach the pot. Inside the block: give a dose. After the block: leave. Indentation makes that plan visible.',
        program: code('repeat 2:', '  step()', 'water()'), solution: code('step()', 'repeat 2:', '  water()', 'step()'),
        hints: ['The pot is at C4, not the final light at D4.', 'Moving twice before watering skips the pot.', 'Put step() first, repeat 2: with water() inside, then step() after the block.'],
        success: 'Each instruction now belongs before, inside, or after the repeat for a reason.'
      }),
      stage(6, 'workshop-arrival', 'The workshop pot', {
        start: { x: 1, z: 3, heading: 0 }, goal: { x: 3, z: 1 },
        tiles: [[1, 3], [1, 2], [1, 1], [2, 1], [3, 1]], plants: [plant(1, 1, 3)], role: 'transfer', activityLabel: 'Arrange',
        story: 'The workshop’s entrance pot needs care before Pip turns toward the bench light.',
        goalCopy: 'Reach B2, give three doses in a repeat, then travel east to D2.',
        dialogue: 'Keep arrival and departure outside the watering repeat. Trace the whole plan before testing it.',
        solution: code('step()', 'step()', 'repeat 3:', '  water()', 'right()', 'step()', 'step()'),
        hints: ['Two steps north reach the pot.', 'Only water() belongs inside repeat 3:.', 'After the block, turn right and take two steps east.'],
        success: 'You built a complete arrival, care, and departure plan.'
      })
    ]),

  lesson(7, 2, 'A rhythm along the row', 'Repeat a multi-action body and trace one complete repetition.',
    'The straight seed rows share a simple care rhythm.', 'How do you tell where a repeat body ends?',
    check('The body is water(), then step(). What is one repetition?', 'Care for one pot, then move once', 'Care for all pots, then move once', 'A repetition runs the whole body, in order, before the next repetition begins.'), [
      stage(7, 'row-rhythm', 'The nursery row', {
        start: { x: 1, z: 2, heading: 1 }, goal: { x: 4, z: 2 }, tiles: row(1, 2, 4),
        plants: [plant(1, 2), plant(2, 2), plant(3, 2)], activityLabel: 'Build a body',
        story: 'Three small pots wait in an evenly spaced nursery row.',
        goalCopy: 'Put both water() and step() inside the repeat to care for the whole row.',
        dialogue: 'A repeat body can contain more than one instruction. Here, one repetition means water this pot, then move to the next tile.',
        program: code('repeat 3:', '  water()', 'step()'), solution: code('repeat 3:', '  water()', '  step()'),
        hints: ['After caring for one pot, Pip must move before the next dose.', 'The step() needs the same two-space indentation as water().', 'Use repeat 3: with both water() and step() indented beneath it.'],
        success: 'One complete care-and-move rhythm restored all three pots.'
      }),
      stage(7, 'west-row', 'The westbound row', {
        start: { x: 4, z: 3, heading: 3 }, goal: { x: 1, z: 3 }, tiles: row(1, 3, 4),
        plants: [plant(4, 3), plant(3, 3), plant(2, 3)], role: 'transfer', activityLabel: 'Make the rhythm',
        story: 'The next row faces the other way, but each pot needs the same care.',
        goalCopy: 'Write a repeat that waters each of the three pots and finishes at B4.',
        dialogue: 'The same body can work in another direction. Check Pip’s starting arrow and count the pots before choosing the repeat count.',
        solution: code('repeat 3:', '  water()', '  step()'),
        hints: ['Pip is already standing on the first pot and facing west.', 'One repetition should water once, then step once.', 'Repeat that two-instruction body three times. No turn belongs inside it.'],
        success: 'Your repeated care rhythm worked without relying on east being forward.'
      })
    ]),

  lesson(8, 2, 'Restore the nursery', 'Choose repeat boundaries and counts on unfamiliar care rounds.',
    'The nursery can reopen once its remaining beds are restored.', 'What does one complete repetition do in a care-and-move body?',
    check('Four pots need the same care. How do you choose a repeat count?', 'Count the complete care jobs', 'Count every instruction in the body', 'The count says how many times to run the whole body.'), [
      stage(8, 'nursery-restoration', 'The long nursery bed', {
        start: { x: 0, z: 1, heading: 1 }, goal: { x: 5, z: 1 }, tiles: row(0, 1, 6),
        plants: [plant(1, 1), plant(2, 1), plant(3, 1), plant(4, 1)], role: 'transfer', activityLabel: 'Restore',
        story: 'Four overlooked pots stand between the nursery entrance and its warm end light.',
        goalCopy: 'Restore all four pots using a repeat, then finish at the far light.',
        dialogue: 'There is an empty entrance tile before the pots. Decide what happens once before the repeated care rhythm begins.',
        solution: code('step()', 'repeat 4:', '  water()', '  step()'),
        hints: ['Move once to reach the first pot.', 'Then repeat water() followed by step() for each of four pots.', 'Use one step() before repeat 4:, with water() and step() indented inside.'],
        success: 'You adapted a familiar rhythm to a fresh layout and a different count.'
      }),
      stage(8, 'corner-nursery', 'The corner nursery', {
        start: { x: 1, z: 3, heading: 0 }, goal: { x: 4, z: 2 },
        tiles: [[1, 3], [1, 2], [2, 2], [3, 2], [4, 2]], plants: [plant(1, 2), plant(2, 2), plant(3, 2)],
        role: 'transfer', activityLabel: 'Restore independently', story: 'The final nursery row begins around a quiet corner.',
        goalCopy: 'Reach the row, turn once, and use a repeat to restore its three pots.',
        dialogue: 'Place the corner turn outside the repeat. The row itself needs only the familiar care-and-move body.',
        solution: code('step()', 'right()', 'repeat 3:', '  water()', '  step()'),
        hints: ['Move north and turn east before starting the row.', 'The first pot is on the corner tile where Pip turns.', 'Use step(), right(), then repeat 3: containing water() and step().'],
        success: 'The nursery is restored. You chose the setup, body, and count without a supplied program.'
      })
    ]),
];
