import type { Book } from "../types";
import { LEFT } from "./left";
import { CENTER } from "./center";
import { RIGHT } from "./right";
import { LIBERTARIAN } from "./libertarian";
import { RELIGIOUS } from "./religious";
import { WORLD } from "./world";
import { RACE } from "./race";

// Small enough to import client-side (the quiz map's tradition panel).
export const BOOKS: Record<string, Book[]> = { ...LEFT, ...CENTER, ...RIGHT, ...LIBERTARIAN, ...RELIGIOUS, ...WORLD, ...RACE };
