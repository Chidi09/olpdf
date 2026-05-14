export type AnimationProfile = "subtle" | "medium" | "dramatic";

export interface AnimationPolicyInput {
  changedBlockCount: number;
  affectedPageCount: number;
  isReducedMotion: boolean;
}

const SUBTLE_MAX_BLOCKS = 3;
const SUBTLE_MAX_PAGES = 1;
const MEDIUM_MAX_BLOCKS = 10;
const MEDIUM_MAX_PAGES = 3;

export function resolveAnimationProfile(input: AnimationPolicyInput): AnimationProfile {
  if (input.isReducedMotion) return "subtle";

  const { changedBlockCount, affectedPageCount } = input;

  if (changedBlockCount <= SUBTLE_MAX_BLOCKS && affectedPageCount <= SUBTLE_MAX_PAGES) {
    return "subtle";
  }
  if (changedBlockCount <= MEDIUM_MAX_BLOCKS && affectedPageCount <= MEDIUM_MAX_PAGES) {
    return "medium";
  }
  return "dramatic";
}
