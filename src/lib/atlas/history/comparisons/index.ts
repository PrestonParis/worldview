import type { Comparison } from "../types";
import { RIGHT } from "./right";
import { LEFT } from "./left";
import { CENTER } from "./center";
import { LIBERTARIAN } from "./libertarian";
import { RELIGIOUS } from "./religious";
import { RACE } from "./race";
import { WORLD } from "./world";

export const COMPARISONS: Record<string, Comparison[]> = { ...RIGHT, ...LEFT, ...CENTER, ...LIBERTARIAN, ...RELIGIOUS, ...RACE, ...WORLD };
