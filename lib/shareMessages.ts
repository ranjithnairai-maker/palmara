/**
 * Rotating pool of share hooks for the "Share with Friends" panel
 * (components/SharePanel.tsx) — the sharer's own words, not the reading's
 * content, so deliberately generic "come find out yours" hooks rather than
 * a paraphrase of the reading's headline. One is picked at random client
 * side each time the share flow starts, so repeated shares from the same
 * person don't all look copy-pasted.
 */
export const SHARE_MESSAGES = [
  "The lines don't lie... I just found out what mine say 🔮",
  "Someone should tell you what your palm knows",
  "Didn't expect my hand to have this much to say",
  "This felt a little too accurate, try yours",
  "Apparently my fate line has opinions",
  "Your palm has been quietly keeping a secret. Go find out what it is",
  "I let a reader study my hand for a minute and it said more than I expected",
  "Five lines on your palm, one honest reading. Worth two minutes",
  "My heart line apparently has a lot to say about me",
  "Turns out your hand has been narrating your whole life",
  "I wasn't expecting my palm to hit that close to home",
  "There's a reading waiting in the lines of your own hand",
  "Just found out what my hand element says about me. Yours might surprise you",
  "Your palm has a story it hasn't told you yet",
] as const;

export function pickShareMessage(): string {
  return SHARE_MESSAGES[Math.floor(Math.random() * SHARE_MESSAGES.length)];
}
