/**
 * Store here state machines shared across several files.
 */

import { StateTracker } from "utils/stateMachine";

export interface PotatoStateEntry {
  started: number;
  startedBy: string;
  heldBy: string;
  lastPass: number;
  passes: number;
}
export const PotatoState = new StateTracker<PotatoStateEntry>();
