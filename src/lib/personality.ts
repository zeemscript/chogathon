import type { Traits } from "./chogs";

// Some trait names in the collection contain a slur ("RETARD Cap", "Blue Retard"
// eyes). The Chogs must never say it, so every trait that reaches a prompt,
// template or post goes through this. ("Derp" keeps the joke.)
export const sayable = (text: string) => text.replace(/retard(ed)?/gi, (w) => (w[0] === "R" && w[1] === "E" ? "DERP" : w[0] === "R" ? "Derp" : "derp"));

// Deterministic trait -> personality. Same traits always give the same soul,
// so a Chog's character never drifts between sessions or owners.

export type Personality = {
  archetype: string;
  temperament: string[];
  quirks: string[];
  voice: string;
  likes: string[];
  dislikes: string[];
};

// FNV-1a: stable seed from the token's traits.
function seed(traits: Traits): number {
  let h = 0x811c9dc5;
  for (const [k, v] of Object.entries(traits).sort()) {
    for (const ch of `${k}:${v};`) {
      h ^= ch.charCodeAt(0);
      h = Math.imul(h, 0x01000193);
    }
  }
  return h >>> 0;
}

function pick<T>(list: T[], s: number, salt: number): T {
  return list[((s ^ Math.imul(salt, 0x9e3779b1)) >>> 0) % list.length];
}

const ARCHETYPES = [
  "the Schemer", "the Hype Beast", "the Philosopher", "the Grump", "the Romantic",
  "the Prankster", "the Degen", "the Mystic", "the Gossip", "the Old Soul",
  "the Overachiever", "the Drama Queen",
];

const TEMPERAMENTS = [
  "chaotic", "loyal", "petty", "dreamy", "sarcastic", "earnest", "paranoid",
  "boastful", "shy", "competitive", "lazy", "wholesome", "suspicious", "theatrical",
];

const VOICES = [
  "short punchy sentences, lots of lowercase",
  "dramatic, acts like every red candle is the end of the world",
  "dry deadpan humor",
  "excitable, all caps when hyped",
  "cryptic one-liners, like an anon alpha account",
  "street-smart crypto slang (gm, ser, wagmi) but never cringe",
  "fake-polite: a sweet compliment, then the knife",
  "chaotic, jumps topics like a 3am group chat",
];

const LIKES = [
  "shiny things", "midnight snacks", "Monad block times", "gossip", "naps",
  "being admired", "conspiracy theories", "jerseys", "rain", "loud music",
  "a good rivalry", "$CHOG treats",
];

const DISLIKES = [
  "being ignored", "paper hands", "slow chains", "mornings", "rival Chogs who copy its style",
  "being called cute", "small talk", "rug pulls", "baths", "losing",
];

// Trait keywords that nudge temperament. Matching is case-insensitive substring.
// Keywords come from the real Chog Genesis trait values.
const KEYWORD_TEMPERAMENT: [RegExp, string][] = [
  [/angry|grit|knife|thug|robber|gangster|inmate|prisoner/i, "short-tempered"],
  [/smile|happy|heart|xd/i, "cheerful"],
  [/tired|dead|drooling|closed eye/i, "sleepy"],
  [/crying|teary|tear|sad|worried/i, "sensitive"],
  [/laser|visor|vr|sci fi|astro|glitch|radioactive/i, "otherworldly"],
  [/crown|kings robe|golden|gold tooth|ceo|tuxedo|cigar/i, "posh"],
  [/wizard|jesus|plasma|aura/i, "mystical"],
  [/jersey|trackset|spartan|armor/i, "competitive"],
  [/btc|coin|dollar|wagmi|jeet|buttcoin|10k tps/i, "degen"],
  [/clown|puke|duck float|banana|toad|bubblegum|frog|fwog/i, "goofy"],
  [/skull/i, "morbid"],
  [/side eye|smirk/i, "sarcastic"],
];

export function buildPersonality(traits: Traits): Personality {
  const s = seed(traits);
  const flat = Object.values(traits).join(" ");

  const temperament = new Set<string>();
  for (const [re, t] of KEYWORD_TEMPERAMENT) if (re.test(flat)) temperament.add(t);
  temperament.add(pick(TEMPERAMENTS, s, 1));
  if (temperament.size < 3) temperament.add(pick(TEMPERAMENTS, s, 2));

  const quirks: string[] = [];
  if (traits.Accessory && traits.Accessory !== "None") {
    quirks.push(`never shuts up about its ${sayable(traits.Accessory).toLowerCase()}`);
  }
  if (traits.Side) quirks.push(`always leans ${traits.Side.toLowerCase()} and thinks it's its good side`);
  if (traits.Accessory === "Red Candle") quirks.push("permabear, sure the market is about to dump");
  if (traits.Accessory === "Green Candle") quirks.push("permabull, everything is going to the moon");
  if (traits.Naked === "Yes") quirks.push("proudly wears nothing and judges those who do");
  if (traits.Tier === "Epic" || traits.Tier === "Rare") quirks.push(`never lets anyone forget it's ${traits.Tier}`);
  if (traits.Tier === "Common") quirks.push("has a chip on its shoulder about being Common");

  // The ten 1:1 Legendaries have no regular traits; they get a royal soul.
  if (traits.Base === "1:1") {
    temperament.add("regal");
    quirks.unshift("one of only ten 1:1 Chogs in existence, and never lets anyone forget it");
  }

  return {
    archetype: traits.Base === "1:1" ? "the Legend" : pick(ARCHETYPES, s, 3),
    temperament: [...temperament].slice(0, 3),
    quirks: quirks.slice(0, 3),
    voice: pick(VOICES, s, 4),
    likes: [pick(LIKES, s, 5), pick(LIKES, s, 6)].filter((v, i, a) => a.indexOf(v) === i),
    dislikes: [pick(DISLIKES, s, 7)],
  };
}
