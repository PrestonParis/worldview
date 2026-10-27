// FEC names are upper case. Title-case them, keeping acronyms (POV PAC,
// NRCC) and the usual business suffixes readable.
const ACRONYMS = new Set(["PAC", "NRCC", "NRSC", "DCCC", "DSCC", "RNC", "DNC", "CLF", "US", "USA", "GOP", "LLC", "JD", "GTM", "MPP", "II", "III"]);
const SMALL = new Set(["for", "of", "and", "the", "to", "in", "or", "a"]);
export function titleCase(name) {
  return name
    .trim()
    .split(/\s+/)
    .map((word, i) => {
      const bare = word.replace(/[^A-Za-z0-9]/g, "");
      if (/^\(.*\)$/.test(word) || ACRONYMS.has(bare.toUpperCase())) return word.toUpperCase();
      if (/^INC\.?,?$/i.test(word)) return word.replace(/inc/i, "Inc");
      const lower = word.toLowerCase();
      if (i > 0 && SMALL.has(lower)) return lower;
      return lower.replace(/(^|[-'(])([a-z])/g, (_, p, c) => p + c.toUpperCase()).replace(/^Mc([a-z])/, (_, c) => `Mc${c.toUpperCase()}`);
    })
    .join(" ")
    .replace(/\(([^)]*)\)/g, (m) => m.toUpperCase());
}
