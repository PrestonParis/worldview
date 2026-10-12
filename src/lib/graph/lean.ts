// Which side of the People graph an entity belongs on. Politicians are
// sorted by the party recorded in their metadata; commentators, outlets
// and movement groups carry no party, so they're placed by the curated
// name lists below. Anyone not on a list stays unclassified and shows only
// in the combined view — straight-news anchors, data analysts, libertarians,
// heterodox podcasters, and the anti-Trump Republicans now working with
// Democrats are left there on purpose rather than forced onto a side.

import type { Entity } from "@/lib/validation/entity";

export const leans = ["conservative", "liberal"] as const;
export type Lean = (typeof leans)[number];

export const leanLabels: Record<Lean, string> = {
  conservative: "Conservative",
  liberal: "Liberal",
};

export const leanColors: Record<Lean, string> = {
  conservative: "#dc2626",
  liberal: "#2563eb",
};

// The People graph's tabs: one per side, plus everyone neither list nor
// party places — so every entity is on exactly one tab.
export const graphSides = [...leans, "uncharacterized"] as const;
export type GraphSide = (typeof graphSides)[number];

export const sideLabels: Record<GraphSide, string> = {
  ...leanLabels,
  uncharacterized: "Not classified",
};

export const sideColors: Record<GraphSide, string> = {
  ...leanColors,
  uncharacterized: "#94a3b8",
};

export function parseSide(value: string | undefined): GraphSide {
  return graphSides.includes(value as GraphSide) ? (value as GraphSide) : graphSides[0];
}

const CONSERVATIVE = [
  // Parties and politicians without a usable party field
  "Republican Party",
  "Donald J. Trump",
  // Journalists
  "Batya Ungar-Sargon",
  "Brit Hume",
  "Chanel Rion",
  "Emerald Robinson",
  "Emily Jashinsky",
  "Maria Bartiromo",
  "Martha MacCallum",
  "Mary Katharine Ham",
  "Megyn Kelly",
  "Michael Shellenberger",
  "Mollie Hemingway",
  "Pearson Sharp",
  "Rod Dreher",
  // Commentators
  "Abby Johnson",
  "Abby Roth",
  "Abe Greenwald",
  "Alex Jones",
  "Allie Beth Stuckey",
  "Amala Ekpunobi",
  "Andrew Klavan",
  "Andrew McCarthy",
  "Ann Coulter",
  "Armstrong Williams",
  "Ashley St. Clair",
  "Auron MacIntyre",
  "Ben Domenech",
  "Ben Shapiro",
  "Benny Johnson",
  "Bill O'Reilly",
  "Blaire White",
  "Brandon Tatum",
  "Bret Stephens",
  "Brett Cooper",
  "Brian Kilmeade",
  "Buck Sexton",
  "CJ Pearson",
  "Candace Owens",
  "Carl Benjamin",
  "Carl Higbie",
  "Charles C. W. Cooke",
  "Charlie Kirk",
  "Chaya Raichik",
  "Chris Salcedo",
  "Christopher Rufo",
  "Clay Travis",
  "Costin Alamariu",
  "Curtis Yarvin",
  "Dan Ball",
  "Dan Bongino",
  "Dana Loesch",
  "Dana Perino",
  "Darren Beattie",
  "Dave Rubin",
  "David French",
  "David Harsanyi",
  "David Urban",
  "Dennis Prager",
  "Dinesh D'Souza",
  "Don Black",
  "Douglas Murray",
  "Elijah Schaffer",
  "Eric Bolling",
  "Eric Metaxas",
  "Erick Erickson",
  "Gad Saad",
  "Gavin McInnes",
  "George Will",
  "Glenn Beck",
  "Greg Gutfeld",
  "Greg Kelly",
  "Guy Benson",
  "Hugh Hewitt",
  "Ian Miles Cheong",
  "Isabel Brown",
  "Jack Hibbs",
  "Jack Posobiec",
  "James Lindsay",
  "Jared Taylor",
  "Jason Whitlock",
  "Jeanine Pirro",
  "Jesse Kelly",
  "Jesse Watters",
  "Jim Geraghty",
  "John Derbyshire",
  "John Doyle",
  "John Podhoretz",
  "Jonah Goldberg",
  "Jordan Peterson",
  "Kaitlin Bennett",
  "Kayleigh McEnany",
  "Kevin D. Williamson",
  "Kevin DeAnna",
  "Kristen Soltis Anderson",
  "Kyle Becker",
  "Lance Wallnau",
  "Larry Elder",
  "Laura Ingraham",
  "Laura Loomer",
  "Lauren Chen",
  "Lauren Southern",
  "Liz Wheeler",
  "Mark Dice",
  "Mark Levin",
  "Matt Gaetz",
  "Matt Walsh",
  "Matthew Continetti",
  "Michael Brendan Dougherty",
  "Michael H. Hart",
  "Michael Knowles",
  "Michelle Malkin",
  "Mike Cernovich",
  "Mona Charen",
  "Monica Crowley",
  "Myron Gaines",
  "Niall Ferguson",
  "Nick Fuentes",
  "Nico Kenn De Balinthazy",
  "Noah Rothman",
  "Oren Cass",
  "Owen Shroyer",
  "Patrick Bet-David",
  "Patrick Deneen",
  "Paul Joseph Watson",
  "Peter Brimelow",
  "Ramesh Ponnuru",
  "Rich Lowry",
  "Rita Panahi",
  "Rob Schmitt",
  "Rob Smith",
  "Robert Weissberg",
  "Ross Douthat",
  "Saagar Enjeti",
  "Samuel Francis",
  "Scott Jennings",
  "Sean Feucht",
  "Sean Hannity",
  "Sebastian Gorka",
  "Shermichael Singleton",
  "Sohrab Ahmari",
  "Steve Bannon",
  "Steven Crowder",
  "Sydney Watson",
  "Thomas Rousseau",
  "Tim Pool",
  "Tomi Lahren",
  "Trey Gowdy",
  "Tucker Carlson",
  "Tulsi Gabbard",
  "Victor Davis Hanson",
  "Vivek Ramaswamy",
  "Yuval Levin",
  // Outlets and groups
  "American Renaissance",
  "Blaze Media",
  "Council of Conservative Citizens",
  "Fox News",
  "Libs of TikTok",
  "Patriot Front",
  "The Daily Wire",
  "The Megyn Kelly Show",
  "Tucker Carlson Network",
  "Turning Point USA",
  "VDARE",
  "Vanguard America",
  "Youth for Western Civilization",
];

const LIBERAL = [
  // Parties and independents who caucus with Democrats
  "Democratic Party",
  "Bernard Sanders",
  "Angus S., Jr. King",
  // Journalists
  "Aaron Maté",
  "Aaron Rupar",
  "Alex Wagner",
  "Alicia Menendez",
  "Amy Goodman",
  "Brian Beutler",
  "Daniel Denvir",
  "David Sirota",
  "Don Lemon",
  "Doug Henwood",
  "Emily Bazelon",
  "Eric Levitz",
  "Ezra Klein",
  "Greg Sargent",
  "Joan Walsh",
  "Jonathan Capehart",
  "Jonathan Cohn",
  "Josh Marshall",
  "Juan González",
  "Judd Legum",
  "Kara Swisher",
  "Karen Hunter",
  "Liza Featherstone",
  "Lydia Polgreen",
  "Matthew Yglesias",
  "Max Blumenthal",
  "Mehdi Hasan",
  "Mika Brzezinski",
  "Nicholas Kristof",
  "Peter Beinart",
  "Rania Khalek",
  "Richard Medhurst",
  "Roland Martin",
  "Ryan Grim",
  "Sarah Jaffe",
  // Commentators
  "Aaron Parnas",
  "Abigail Thorn",
  "Adam Johnson",
  "Adam Mockler",
  "Adolph Reed Jr.",
  "Al Sharpton",
  "Amber A'Lee Frost",
  "Ana Kasparian",
  "Angela Rye",
  "Anthony Davis",
  "Ari Melber",
  "Astra Taylor",
  "Bakari Sellers",
  "Barbara McQuade",
  "Ben Burgis",
  "Ben Meiselas",
  "Benjamin Dixon",
  "Bhaskar Sunkara",
  "Bill Maher",
  "Brace Belden",
  "Brett Meiselas",
  "Briahna Joy Gray",
  "Brian Tyler Cohen",
  "Catherine Rampell",
  "Cenk Uygur",
  "Charles Blow",
  "Chris Hayes",
  "Chris Mowrey",
  "Claire McCaskill",
  "Cody Johnston",
  "Cornel West",
  "Dan Pfeiffer",
  "David Axelrod",
  "David Doel",
  "David Pakman",
  "David Shor",
  "Dean Obeidallah",
  "Dean Withers",
  "Derek Davison",
  "Donna Brazile",
  "Ed Kilgore",
  "Eddie Glaude Jr.",
  "Elie Mystal",
  "Emma Vigeland",
  "Eugene Robinson",
  "Farron Cousins",
  "Felix Biederman",
  "Freddie deBoer",
  "Gail Collins",
  "Glenn Kirschner",
  "Harold Ford Jr.",
  "Harry Litman",
  "Harry Sisson",
  "Hasan Piker",
  "Heather Cox Richardson",
  "Ian Kochinski",
  "Jamelle Bouie",
  "James Carville",
  "Jason Johnson",
  "Jeet Heer",
  "Jen Psaki",
  "Jessica Tarlov",
  "John Oliver",
  "Jon Favreau",
  "Jon Lovett",
  "Jon Stewart",
  "Jonathan Chait",
  "Jordy Meiselas",
  "Joy Behar",
  "Joy Reid",
  "Joyce Vance",
  "Katie Halper",
  "Katy Stoll",
  "Keli Goff",
  "Ken White",
  "Krystal Ball",
  "Kshama Sawant",
  "Kyle Kulinski",
  "Lawrence O'Donnell",
  "Lee Camp",
  "Leeja Miller",
  "Liz Franczak",
  "Luke Beasley",
  "Marc Lamont Hill",
  "Maria Cardona",
  "Marianne Williamson",
  "Matt Christman",
  "Matt Karp",
  "Matthew Sitman",
  "Maureen Dowd",
  "Michelle Goldberg",
  "Mike Figueredo",
  "Naomi Klein",
  "Natalie Wynn",
  "Nathan J. Robinson",
  "Neal Katyal",
  "Nima Shirazi",
  "Noah Smith",
  "Omar Rivero",
  "Parker Short",
  "Paul Begala",
  "Paul Krugman",
  "Preet Bharara",
  "Rachel Maddow",
  "Rafael Rivero",
  "Ralph Nader",
  "Randi Rhodes",
  "Renato Mariotti",
  "Robert Reich",
  "Ron Filipkowski",
  "Ryan Cooper",
  "Sabrina Salvati",
  "Sam Adler-Bell",
  "Sam Seder",
  "Seth Meyers",
  "Stephanie Miller",
  "Stephen Colbert",
  "Steven Bonnell II",
  "Sunny Hostin",
  "Symone Sanders-Townsend",
  "Thom Hartmann",
  "Thomas Friedman",
  "Van Jones",
  "Whoopi Goldberg",
  "Will Menaker",
  "Yascha Mounk",
  // Outlets and groups
  "Crooked Media",
  "MSNBC",
  "Real Time with Bill Maher",
  "TYT Network",
  "The David Pakman Show",
  "The Majority Report",
  "Zeteo",
];

const LEAN_BY_NAME = new Map<string, Lean>([
  ...CONSERVATIVE.map((n) => [n, "conservative"] as const),
  ...LIBERAL.map((n) => [n, "liberal"] as const),
]);

// Party strings as they arrive from Congress, OpenStates and the
// governors' import: "Republican", "R", "Republican/Conservative",
// "Democratic", "Democrat", "D", "Democratic-Farmer-Labor",
// "Democratic/Working Families", FEC's "DEM"/"REP", … Puerto Rico's parties, independents,
// nonpartisan seats and minor parties don't map onto either side.
function leanFromParty(party: string): Lean | null {
  const p = party.trim().toLowerCase();
  if (p === "r" || p === "rep" || p.startsWith("republican")) return "conservative";
  if (p === "d" || p === "dem" || p.startsWith("democrat")) return "liberal";
  return null;
}

function partyOf(metadata: string | undefined): string | null {
  if (!metadata || !metadata.includes('"party"')) return null;
  try {
    const party = (JSON.parse(metadata) as { party?: unknown }).party;
    return typeof party === "string" ? party : null;
  } catch {
    return null;
  }
}

export function leanOf(entity: Pick<Entity, "name" | "type" | "metadata">): Lean | null {
  const named = LEAN_BY_NAME.get(entity.name);
  if (named) return named;
  if (entity.type !== "politician") return null;
  const party = partyOf(entity.metadata);
  return party ? leanFromParty(party) : null;
}

// People are the thing being split: a politician, pundit or journalist
// shows only on their side's tab, or on "uncharacterized" if they have
// none. Institutions without a side (chambers, committees, state offices,
// donors, neutral outlets) appear on every tab, since they're what
// connects each side's people to each other.
const PERSON_TYPES = new Set<string>(["politician", "pundit", "journalist"]);

// What a node's colour means in the network: people by political family,
// everything else as an institution. Party colours mean only this.
export type NodeFamily = Lean | "unplaced" | "institution";

export function familyOf(entity: Pick<Entity, "name" | "type" | "metadata">): NodeFamily {
  const lean = leanOf(entity);
  if (lean) return lean;
  return PERSON_TYPES.has(entity.type) ? "unplaced" : "institution";
}

export function belongsOnSide(
  entity: Pick<Entity, "name" | "type" | "metadata">,
  side: GraphSide,
): boolean {
  const lean = leanOf(entity);
  if (lean) return lean === side;
  return side === "uncharacterized" || !PERSON_TYPES.has(entity.type);
}
