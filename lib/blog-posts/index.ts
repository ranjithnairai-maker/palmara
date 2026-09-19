import type { BlogPost } from "../blog";
import { lifeLineMeaning } from "./life-line-meaning";
import { heartLineMeaning } from "./heart-line-meaning";
import { headLineMeaning } from "./head-line-meaning";
import { fateLineMeaning } from "./fate-line-meaning";
import { earthHand } from "./earth-hand";
import { waterHand } from "./water-hand";
import { airHand } from "./air-hand";
import { fireHand } from "./fire-hand";
import { palmReadingMounts } from "./palm-reading-mounts";
import { canAiReadPalmsAccurately } from "./can-ai-read-palms-accurately";

// Order here is the order the blog index lists them in — the four major
// lines first (the most-searched topics), then the four elements, then the
// two explainer pieces.
export const BLOG_POSTS_LIST: BlogPost[] = [
  lifeLineMeaning,
  heartLineMeaning,
  headLineMeaning,
  fateLineMeaning,
  earthHand,
  waterHand,
  airHand,
  fireHand,
  palmReadingMounts,
  canAiReadPalmsAccurately,
];
