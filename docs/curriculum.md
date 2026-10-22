# Lantern Garden: twenty-lesson first course

## Learning contract

This course teaches program reading, planning, testing, and debugging through a deliberately small, non-evaluating garden language. It is **not Python**. Familiar-looking parentheses, colons, and indentation support a later bridge, but `repeat N:` and `routine name():` are teaching-language constructs, not Python syntax.

The original three activities remain **Lesson 1**, not three lessons. Their IDs, maps, starting states, starter programs, and original command budgets are preserved in the curriculum wrappers. Every later lesson has two activities, giving 41 available activities and 40 required activities. Lesson 19 is an either-or project choice: completing either project satisfies that lesson; the other remains available for exploration.

The course does not introduce variables, parameters, return values, collections, nested loops, or object-oriented programming. Those belong to a later real-Python bridge. Nesting a familiar `if`, `repeat`, or `while` inside a routine does not introduce a nested-loop task.

## The five acts

| Lesson | Learner objective | Activity evidence |
| --- | --- | --- |
| 1. A light to follow | Read, repair, and write a short sequence. | Predict the original route, repair its wrong turn, and write a different route. |
| 2. Turn, then travel | Track tile and direction independently. | Predict both final tile and facing; reach a new survey point facing south. |
| 3. Find the first mismatch | Separate syntax from logic. | Repair a missing parenthesis; remove the first unnecessary turn in a readable plan. |
| 4. A little care | Sequence a new world-changing action. | Use `water()` at the current plant; independently plan a two-plant care round. |
| 5. Count the care | Repeat an action a known number of times. | Choose three and four doses from actual plant needs, not an arbitrary code-length constraint. |
| 6. Inside and outside | Place setup, repeated work, and departure correctly. | Repair a care card; independently arrange arrival, repeated doses, and departure. |
| 7. A rhythm along the row | Trace a multi-action repeat body. | Repeat care then movement on eastbound and westbound straight rows. There is no turn in the body. |
| 8. Restore the nursery | Transfer counted repetition to fresh care rounds. | Restore a longer row, then a row reached around a corner, with setup outside the repeat. |
| 9. Ask the garden | Read yes/no sensors without treating them as actions. | Answer a genuine initial `dry()` question; read `path_clear()` from a north-facing gap. No branch syntax yet. |
| 10. Care only when needed | Trace one conditional action. | Run the same `if dry():` card on a dry plant and a rain-fed plant; explain one execution versus zero. |
| 11. One path or the other | Trace both alternatives of `if/else`. | Run the supplied decision in an open junction and a washed-out junction, selecting different bodies. |
| 12. One plan, two gardens | Write one decision and test that same card in two worlds. | Create the first branch card; carry it into a contrasting world. Completion checks the current same source against both worlds; revision is allowed. |
| 13. A name for a care job | Call a supplied, visible routine. | Read the entire supplied body, add its call, then call the same body twice. No invisible helpers. |
| 14. Write a useful helper | Define a familiar no-argument sequence. | Write a care-and-move body, then define and reuse it on a northbound bed. |
| 15. Repair the shared job | Repair a body once and retest its uses. | Correct shared action order; correct a shared dose count and verify both pots. |
| 16. Your workshop routine | Design and reuse a coherent job. | Restore two separated beds with travel outside the helper; reuse a familiar conditional helper in dry and rain-fed beds. |
| 17. Until the path ends | Test before each `while` iteration, including the first. | Trace repeated forward checks; demonstrate an initially false condition and zero body executions. |
| 18. Make the condition change | Reason about termination. | Water until ready; repair a body that turns without changing dryness. Bad long runs pause safely. |
| 19. Choose a restoration | Choose a small project using known tools. | Either restore a lantern walk or tend deep pots with different needs. No new syntax and no requirement to use every construct. |
| 20. The garden, awake | Restore, then adapt to an unseen variation. | Plan a final two-bed restoration; repair a fresh card whose single `if` dose no longer meets a deeper pot's need. |

## Pacing and presentation

Each lesson has one short objective, a one-sentence introduction, a retrieval prompt, and a compact two-choice check with explanatory feedback. Checks are not speed tests and clues are not penalties. Each activity supplies:

- A one-sentence story of at most 25 words.
- One primary goal of at most 24 words.
- One optional concept paragraph of at most 45 words.
- Three progressively more explicit clues, with a usable full strategy last.
- One visible success explanation tied to the concept rather than a score.

The introduction, retrieval question, optional notes, and ending check are separate moments, not extra text boxes to show simultaneously. Retrieval prompts remain in optional Field notes and recur in the existing feedback area at a lesson’s second activity. Initial sensor observations in Lesson 9 use the existing prediction area before Run becomes available. Keep the goal as the main reading task during play. Incorrect choices receive an explanation and allow retry. The interface should alternate or shuffle the displayed choice order rather than treating the first array entry as a visual answer position.

Practice support fades when it serves the concept, not according to a rigid three-screen template. Early activities supply a program, a body, or a specific repair. Later activities begin with a blank program or require applying unchanged code to a new state. Care, inspection, shared jobs, workshop restoration, and project choice replace repeated maze padding.

## Data and integration contract

The data is split into `src/curriculum/act-1.js` through `act-5.js`, each exporting its four lessons, with data-only builders in `src/curriculum/shared.js`. This keeps each act reviewable as a separate checkpoint. The root module concatenates the acts without changing stage ordering.

`src/curriculum.js` exports:

- `LESSONS`: twenty ordered records with `number`, `act`, `title`, `objective`, `intro`, `retrieval`, `check`, and `stages`.
- `STAGES`: the stable, flattened list used by save validation, navigation, and the garden renderer.

Each stage retains the existing level shape and adds `lessonNumber`, `activityLabel`, `role`, `language`, and `solution`. Reference solutions are deterministic regression fixtures, not unique accepted answers. Other correct plans are welcome. New stages use a 40-statement source budget rather than forcing the intended construct through an artificially tiny command limit.

Language flags are cumulative, with these first unlocks:

| First lesson | Flag | New form |
| --- | --- | --- |
| 4 | `water` | `water()` |
| 5 | `repeat` | `repeat 3:` with a two-space-indented body |
| 9 | `sensors` | World-based yes/no questions `dry()` and `path_clear()`; no standalone executable sensor instruction |
| 10 | `if` | `if dry():` |
| 11 | `else` | `else:` |
| 13 | `routines` | A visible `routine tend():` definition and `tend()` call |
| 17 | `while` | `while path_clear():` and, in Lesson 18, `while dry():` |

Plants use `{x, z, need, water}`. A dose affects the current tile only. `dry()` is true only when a plant there still needs water. Goals require the final coordinates, every plant's care need, and the optional facing target. Orientation activities provide both `goal.heading` and `goalHeading` with the same value for renderer/controller compatibility. Predictions may include `heading` as well as `x` and `z`; choices sharing a tile can therefore still represent different answers.

`stage.check` is an activity-specific evaluable question, separate from the lesson-ending check. Lesson 9 deliberately uses this to assess sensor reading before introducing executable branching. Its questions refer explicitly to the initial world state; `checkBeforeRun` gates Run/Step until a correct explained observation. Later stage checks distinguish taken and skipped bodies, not just successful routes.

`carryProgramFrom` identifies the previous stage whose saved source should be loaded into a contrasting world. Use that saved source when it exists, falling back to the stage's supplied starter otherwise. `sharedProgramKey` documents the conceptual link. In Lesson 12, the first world is blank and the second initially carries the learner's card. The learner may revise it, but the exact current source must succeed on both worlds before the second activity is awarded. A board-specific alternate route is not enough.

Lesson 19's `choice` includes `title`, `stageIds`, and `minimum: 1`. Its two stages have `choiceGroup: 'restoration-project'` and `optional: true`. The course must not require both variants to reach Lesson 20. Either variant is independently solvable and the other may remain replayable.

Lesson 20's optional `bridge` contains a title and compact paragraph that honestly distinguishes the DSL from Python. Show it only at the final checkpoint, not as another panel during the restoration.

## Verification

Run `node --test tests/curriculum.test.mjs` for the curriculum-specific checks. They verify the complete lesson/act structure, opening save compatibility, copy limits, connected and bounded boards, planted-tile validity, progressive feature flags, and every deterministic reference solution.

All 41 solutions must reach success in the actual bounded interpreter, meet every care and facing requirement, leave the level data unchanged, and undo exactly to the initial state. Focused behavioral tests also verify:

- The distinct syntax and logic failures are genuine.
- A multi-action repeat handles the complete care-and-move body without a turn.
- The same `if` executes water once in a dry world and zero times in a wet world.
- Unchanged branch code takes different alternatives in two worlds.
- Supplied definitions do not execute their bodies until called.
- Both call sites benefit from a shared helper repair.
- `while` checks on entry and after each iteration, including zero-iteration entry.
- The non-terminating care card pauses at 24 transitions and succeeds after a condition-changing repair.
- Both optional projects work independently.
- The final unseen variation fails before its focused repair and succeeds afterward.

All activities use six-by-five boards within the established renderer envelope. No network, account, external service, or learner-data transmission is needed for curriculum execution.

## Assessment boundaries

This is authored near-transfer practice, not a validated mastery assessment. Most repeat/routine goals accept other correct plans, including inline commands. A two-choice explanation with retries is not proof of durable understanding. The saved `evidence.independent` flag means only zero clue clicks; supplied examples can also receive it, so it must not be reported as unaided authorship. Engine-generated variant tests validate execution, not learner transfer. The fixed final variation is fresh within this course, not a randomized or delayed transfer test. Real learner comprehension, retention and the later Python bridge remain untested.
