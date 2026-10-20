import type { TraditionHistory } from "./types";
import { LEFT } from "./left";
import { CENTER } from "./center";
import { RIGHT } from "./right";
import { LIBERTARIAN } from "./libertarian";
import { RELIGIOUS } from "./religious";
import { WORLD } from "./world";
import { RACE } from "./race";

export type { PrimaryText, TraditionHistory } from "./types";

export const HISTORY: Record<string, TraditionHistory> = { ...LEFT, ...CENTER, ...RIGHT, ...LIBERTARIAN, ...RELIGIOUS, ...WORLD, ...RACE };
