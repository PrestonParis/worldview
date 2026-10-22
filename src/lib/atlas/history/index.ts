import type { TraditionCore, TraditionHistory } from "./types";
import { LEFT } from "./left";
import { CENTER } from "./center";
import { RIGHT } from "./right";
import { LIBERTARIAN } from "./libertarian";
import { RELIGIOUS } from "./religious";
import { WORLD } from "./world";
import { RACE } from "./race";
import { COMPARISONS } from "./comparisons";
import { BOOKS } from "./books";

export type { Book, BookKind, Comparison, ComparisonKind, PrimaryText, TraditionHistory } from "./types";

const CORE: Record<string, TraditionCore> = { ...LEFT, ...CENTER, ...RIGHT, ...LIBERTARIAN, ...RELIGIOUS, ...WORLD, ...RACE };

export const HISTORY: Record<string, TraditionHistory> = Object.fromEntries(
  Object.entries(CORE).map(([id, core]) => [id, { ...core, comparisons: COMPARISONS[id] ?? [], books: BOOKS[id] ?? [] }]),
);
