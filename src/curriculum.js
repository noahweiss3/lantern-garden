/** Twenty lessons in a tiny garden teaching language, not Python. */
import { ACT_1 } from './curriculum/act-1.js';
import { ACT_2 } from './curriculum/act-2.js';
import { ACT_3 } from './curriculum/act-3.js';
import { ACT_4 } from './curriculum/act-4.js';
import { ACT_5 } from './curriculum/act-5.js';

export const LESSONS = [...ACT_1, ...ACT_2, ...ACT_3, ...ACT_4, ...ACT_5];
export const STAGES = LESSONS.flatMap(item => item.stages);
