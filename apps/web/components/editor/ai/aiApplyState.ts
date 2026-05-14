export type AiApplyPhase = "idle" | "streaming" | "staging" | "applying" | "applied" | "reverted";

export interface AiApplyState {
  phase: AiApplyPhase;
  changedBlockCount: number;
  affectedPageCount: number;
}

export type AiApplyAction =
  | { type: "START_STREAMING" }
  | { type: "FINISH_STREAMING" }
  | { type: "START_STAGING" }
  | { type: "START_APPLYING"; changedBlockCount: number; affectedPageCount: number }
  | { type: "FINISH_APPLYING" }
  | { type: "REVERT" }
  | { type: "RESET" };

export const initialAiApplyState: AiApplyState = {
  phase: "idle",
  changedBlockCount: 0,
  affectedPageCount: 0,
};

export function aiApplyReducer(state: AiApplyState, action: AiApplyAction): AiApplyState {
  switch (action.type) {
    case "START_STREAMING":
      return { ...state, phase: "streaming" };
    case "FINISH_STREAMING":
      return { ...state, phase: "staging" };
    case "START_STAGING":
      return { ...state, phase: "staging" };
    case "START_APPLYING":
      return {
        ...state,
        phase: "applying",
        changedBlockCount: action.changedBlockCount,
        affectedPageCount: action.affectedPageCount,
      };
    case "FINISH_APPLYING":
      return { ...state, phase: "applied" };
    case "REVERT":
      return { ...state, phase: "reverted" };
    case "RESET":
      return initialAiApplyState;
    default:
      return state;
  }
}
