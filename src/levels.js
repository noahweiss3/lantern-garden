const tiles = pairs => pairs.map(([x,z]) => ({x,z}));
export const LEVELS = [
  {
    id:'first-look', title:'The first light', width:6,height:5,scenerySeed:11,
    start:{x:1,z:3,heading:1}, goal:{x:3,z:2},
    tiles:tiles([[0,3],[1,3],[2,3],[3,3],[4,3],[3,2],[3,1],[2,1],[4,1]]),
    phase:'01 / Predict & notice', lesson:'Where will Pip stop?',
    story:'The storm has passed. One corner of the garden is waiting for its light. Pip has one charged cell and a short set of instructions. Let’s see where they lead.',
    goalCopy:'Before running, choose the tile where you think Pip will stop. A guess is useful, even if it changes.',
    dialogue:'A program is a list of instructions. I follow it from top to bottom. step() moves one tile in the direction I’m facing. left() turns me on the spot.',
    program:'step()\nstep()\nleft()\nstep()', readonly:true, maxCommands:8,
    predictions:[{x:1,z:3},{x:3,z:3},{x:3,z:2},{x:3,z:1}],
    hints:['Start at B4. Pip is facing east, toward C4.','The first two step() commands move Pip to D4.','left() changes Pip’s direction, not its tile. The last step() moves north to D3.'],
    success:'One light wakes. Notice: four commands, but only three moves. Turning changes direction without changing the tile.'
  },
  {
    id:'wrong-turn',title:'The bent signpost',width:6,height:5,scenerySeed:27,
    start:{x:1,z:1,heading:1},goal:{x:3,z:2},
    tiles:tiles([[1,1],[2,1],[3,1],[4,1],[3,0],[3,2],[3,3],[2,3]]),
    phase:'02 / Investigate & repair',lesson:'One turn is wrong.',
    story:'The first relay has opened the nursery path. A storm-bent sign points Pip away from the next lantern. We can repair the instructions, not the robot.',
    goalCopy:'Run or step through the supplied program. Then change just one command so Pip reaches the amber relay at D3.',
    dialogue:'right() turns me the other way. Both turns stay on the same tile. Watch my direction arrow as each line runs.',
    program:'step()\nstep()\nleft()\nstep()',readonly:false,maxCommands:4,
    hints:['Use “One step” to watch the first two commands. Where does Pip face before line 3?','At D2, Pip is facing east. The relay is south, one tile below.','Change line 3 from left() to right(). Then run from the dock.'],
    success:'That’s debugging: noticing what happened, finding the cause, and changing the instructions. Your repair has brought another lantern back.'
  },
  {
    id:'your-route',title:'The last stepping stone',width:6,height:5,scenerySeed:41,
    start:{x:1,z:3,heading:0},goal:{x:3,z:2},
    tiles:tiles([[1,3],[1,2],[1,1],[2,2],[3,2],[2,3],[3,3]]),
    phase:'03 / Make a new route',lesson:'This route is yours.',
    story:'Beyond the nursery, a sleeping beacon waits. No old instructions this time. Guide Pip from B4 to the amber relay at D3, one small command at a time.',
    goalCopy:'Write your own program. Pip starts facing north. You can test, undo, and change your route as often as you like.',
    dialogue:'Before you type, trace a route with your eyes. Which way am I facing? What should happen first?',
    program:'',readonly:false,maxCommands:12,
    hints:['One short route goes from B4 to B3, then across to C3 and D3.','Start with step(). Then turn to face east with right().','A complete route is step(), right(), step(), step(), with one command per line.'],
    success:'The beacon is awake. You read a program, repaired a wrong turn, and made a fresh route. The next chapter can wait. This is a good place to pause.'
  }
];
