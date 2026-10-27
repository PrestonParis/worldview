// Which side of the People graph an entity belongs on. Politicians are
// sorted by the party recorded in their metadata; commentators, outlets
// and movement groups carry no party, so they're placed by the curated
// name lists below. FEC committees and companies carry a `lean` that
// scripts/classify-entity-lean.mjs computes from their party affiliation,
// sponsor or giving, with a `leanBasis` sentence saying why. Anyone not on a list stays unclassified and shows only
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

// The People graph's tabs: one per side, plus everyone neither list nor
// party places — so every entity is on exactly one tab.
export const graphSides = [...leans, "uncharacterized"] as const;
export type GraphSide = (typeof graphSides)[number];

export const sideLabels: Record<GraphSide, string> = {
  ...leanLabels,
  uncharacterized: "Not classified",
};

// Trump administration officials (data/administration.json) whose records
// carry no party field.
export const ADMINISTRATION = [
  "Brooke Rollins",
  "Chris Wright",
  "Doug Burgum",
  "Howard Lutnick",
  "Jamieson Greer",
  "Jay Clayton",
  "John Ratcliffe",
  "Keith Sonderling",
  "Lee Zeldin",
  "Linda McMahon",
  "Pam Bondi",
  "Pete Hegseth",
  "Robert F. Kennedy Jr.",
  "Russell Vought",
  "Scott Bessent",
  "Scott Turner",
  "Sean Duffy",
  "Susie Wiles",
  "Todd Blanche",
];

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
  // Outlets, shows and groups placed Oct 2026: right-of-center media,
  // think tanks and party organizations
  "American Enterprise Institute",
  "Breitbart News",
  "Claremont Institute",
  "Clay Travis and Buck Sexton",
  "Commentary",
  "Competitive Enterprise Institute",
  "Compound Media",
  "Discovery Institute",
  "Dispatch",
  "Federalist",
  "Fox Business",
  "Fox Corporation",
  "Fox Entertainment",
  "Fox Entertainment Group",
  "Fox Nation",
  "GOPAC",
  "Hoover Institution",
  "Human Events",
  "Infowars",
  "Institute for Humane Studies",
  "Intercollegiate Studies Institute",
  "Log Cabin Republicans",
  "Louder with Crowder",
  "Manhattan Institute for Policy Research",
  "National Review",
  "National Rifle Association of America",
  "Nelk Boys",
  "New York Post",
  "Newsmax TV",
  "Officer Tatum",
  "One America News Network",
  "OutKick",
  "PragerU",
  "Project Veritas",
  "Radio America",
  "Reason",
  "Rebel News",
  "Republican National Committee",
  "Rubin Report",
  "Salem Media Group",
  "Salem Radio Network",
  "Shawn Ryan",
  "Sinclair Broadcast Group",
  "Taki's Magazine",
  "The Daily Caller",
  "The Epoch Times",
  "The Free Press",
  "The Heritage Foundation",
  "The Joe Rogan Experience",
  "The Washington Times",
  "TheBlaze",
  "Timcast",
  "Townhall",
  "Triggernometry",
  "War Room",
  // Megadonors whose giving goes overwhelmingly to Republicans
  "Barre Seid",
  "Charles Koch",
  "David Sacks",
  "Elizabeth Uihlein",
  "Elon Musk",
  "Harlan Crow",
  "Jeff Yass",
  "Joe Lonsdale",
  "Ken Griffin",
  "Larry Ellison",
  "Marc Andreessen",
  "Miriam Adelson",
  "Palmer Luckey",
  "Paul Singer",
  "Peter Thiel",
  "Rebekah Mercer",
  "Richard Uihlein",
  "Robert Mercer",
  "Stephen Schwarzman",
  "Timothy Mellon",
  ...ADMINISTRATION,
  // Commentators and journalists placed Oct 2026 by the side their
  // current work and audience sit on; libertarians count as right of
  // center, as in the party mapping below
  "Adin Ross",
  "Alan Dershowitz",
  "Andrew Napolitano",
  "Andrew Schulz",
  "Andrew Sullivan",
  "Arielle Scarcella",
  "Bari Weiss",
  "Bret Weinstein",
  "Coleman Hughes",
  "Dave Smith",
  "David Brooks",
  "Francis Foster",
  "Frank Luntz",
  "Glenn Greenwald",
  "Heather Heying",
  "Jackson Hinkle",
  "Joe Rogan",
  "Katherine Mangu-Ward",
  "Kim Iversen",
  "Konstantin Kisin",
  "Kyle Forgeard",
  "Mark Halperin",
  "Matt Taibbi",
  "Matt Welch",
  "Michael Malice",
  "Naomi Wolf",
  "Nick Gillespie",
  "Peter Boghossian",
  "Peter Schiff",
  "Piers Morgan",
  "Richard Hanania",
  "Robby Soave",
  "S. E. Cupp",
  "Scott Horton",
  "Shawn Ryan",
  "Theo Von",
  "Tom Woods",
  "Walter Weekes", // Fresh and Fit co-host, beside Myron Gaines
  // Straight-news journalists placed by their outlet (OUTLET_PLACED)
  "Bret Baier",
  "Howard Kurtz",
  "Shannon Bream",
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
  // Outlets, shows and groups placed Oct 2026: left-of-center media
  // (outlets by the lean of their audience, Pew Research Center) and groups
  "AlterNet",
  "Bernie Sanders 2020 presidential campaign",
  "CNN",
  "Chapo Trap House",
  "Current Affairs",
  "Defending Democracy Together",
  "Democracy Now!",
  "HuffPost",
  "Humanist Report",
  "Jacobin",
  "Jimmy Dore",
  "Know Your Enemy",
  "Last Week Tonight",
  "Los Angeles Times",
  "MS NOW",
  "MeidasTouch",
  "NPR",
  "New York",
  "Occupy Democrats",
  "Rational National",
  "Ring of Fire",
  "Rolling Stone",
  "Roland Martin Unfiltered",
  "Salon.com",
  "Secular Talk",
  "Slate",
  "Slate Political Gabfest",
  "Some More News",
  "Talking Points Memo",
  "The Atlantic",
  "The Bulwark",
  "The Grayzone",
  "The Guardian",
  "The Intercept",
  "The Nation",
  "The New Republic",
  "The New York Times",
  "The New York Times Company",
  "The New Yorker",
  "The Washington Post",
  "The Young Turks",
  "TrueAnon",
  "Very Serious",
  // Megadonors whose giving goes overwhelmingly to Democrats
  "Alex Soros",
  "Donald Sussman",
  "Dustin Moskovitz",
  "Eric Schmidt",
  "George Soros",
  "Laurene Powell Jobs",
  "Pierre Omidyar",
  "Reid Hoffman",
  "Vinod Khosla",
  // Self-described Democrats (Chronicle of Philanthropy) who give to
  // Democratic campaigns and House Majority PAC
  "John Arnold",
  "Laura Arnold",
  // Commentators and journalists placed Oct 2026. Anti-Trump
  // Republicans who now back Democratic candidates sit here, by the side
  // their current work supports.
  "Alyssa Farah Griffin",
  "Amanda Carpenter",
  "Ana Navarro",
  "Andrew Yang",
  "Bill Kristol",
  "Charlamagne tha God",
  "Charlie Sykes",
  "David Frum",
  "David Plotz",
  "Devin Stone",
  "Fareed Zakaria",
  "G. Elliott Morris",
  "George Conway",
  "Jennifer Rubin",
  "Jimmy Dore",
  "Joe Scarborough",
  "John Heilemann",
  "Josh Barro",
  "June Lapine",
  "Matthew Dowd",
  "Michael Smerconish",
  "Michael Steele",
  "Nate Silver",
  "Nicolle Wallace",
  "Pamela Paul",
  "Philip Bump",
  "Rick Wilson",
  "Sarah Longwell",
  "Scott Galloway",
  "Stuart Stevens",
  "Tara Setmayer",
  "Thomas Chatterton Williams",
  "Tim Miller",
  "Tommy Vietor",
  "Touré Reed",
  "Zeynep Tufekci",
  // Straight-news journalists placed by their outlet (OUTLET_PLACED)
  "Abby Phillip",
  "Anderson Cooper",
  "Chris Cillizza",
  "Chuck Todd",
  "Dana Bash",
  "Erin Burnett",
  "Harry Enten",
  "Jake Tapper",
  "John Dickerson",
  "Kaitlan Collins",
  "Michael Beschloss",
  "Nate Cohn",
  "Sara Haines",
  "Steve Kornacki",
  "Wolf Blitzer",
];

// Straight-news journalists with no stated side of their own, placed by
// the lean of their outlet's audience (Pew Research Center's media
// polarization studies: Fox News right; CNN, NBC/MSNBC, CBS, ABC's The
// View, The New York Times left).
const OUTLET_PLACED = new Set([
  "Abby Phillip", "Anderson Cooper", "Bret Baier", "Chris Cillizza", "Chuck Todd", "Dana Bash", "Erin Burnett",
  "Harry Enten", "Howard Kurtz", "Jake Tapper", "John Dickerson", "Kaitlan Collins", "Michael Beschloss",
  "Nate Cohn", "Sara Haines", "Shannon Bream", "Steve Kornacki", "Wolf Blitzer",
]);

const LEAN_BY_NAME = new Map<string, Lean>([
  ...CONSERVATIVE.map((n) => [n, "conservative"] as const),
  ...LIBERAL.map((n) => [n, "liberal"] as const),
]);

// State officeholders whose recorded party doesn't place them: Nebraska's
// officially nonpartisan legislators, by the party they're registered
// with (Wikipedia's Nebraska Legislature roster), and independents, by
// the caucus they sit with or the party they were elected in and left.
// Politicians only, since several names are common.
const L: Lean = "liberal";
const C: Lean = "conservative";
const NE_D = "Registered Democrat in Nebraska's officially nonpartisan Legislature.";
const NE_R = "Registered Republican in Nebraska's officially nonpartisan Legislature.";
const AK_COALITION = "Independent in the Alaska House's Democratic-led bipartisan majority coalition.";
const LEFT_D = "Elected as a Democrat; now an independent.";
const LEFT_R = "Elected as a Republican; now an independent.";
const place = (names: string[], lean: Lean, basis: string) =>
  names.map((n): [string, [Lean, string]] => [n, [lean, basis]]);
const OFFICIAL_PLACED = new Map<string, [Lean, string]>([
  ...place(
    [
      "Victor Rountree",
      "Margo Juarez",
      "Machaela Cavanaugh",
      "Dunixi Guereca",
      "John Cavanaugh",
      "Wendy DeBoer",
      "Terrell McKinney",
      "Ashlei Spivey",
      "John Fredrickson",
      "George Dungan",
      "Jason Prokop",
      "Jane Raybould",
      "Eliot Bostar",
      "Dan Quick",
      "Danielle Conrad",
    ],
    L,
    NE_D,
  ),
  ...place(
    [
      "Bob Hallstrom",
      "Rob Clements",
      "Brad von Gillern",
      "Merv Riepe",
      "John Arch",
      "Woody Wordekemper",
      "Ben Hansen",
      "Glen Meyer",
      "Christy Armendariz",
      "Robert Dover",
      "Beau Ballard",
      "Mike Moser",
      "Jared Storm",
      "Jana Hughes",
      "Carolyn Bosn",
      "Myron Dorn",
      "Kathleen Kauth",
      "Tom Brandt",
      "Dan Lonowski",
      "Loren Lippincott",
      "Rick Holdcroft",
      "Stan Clouse",
      "Dave Murman",
      "Tony Sorrentino",
      "Barry DeKay",
      "Fred Meyer",
      "Mike Jacobson",
      "Tanya Storer",
      "Teresa Ibach",
      "Rita Sanders",
      "Paul Strommen",
      "Brian Hardin",
      "Bob Andersen",
    ],
    C,
    NE_R,
  ),
  ...place(["Megan Hunt"], L, "Elected as a Democrat; registered nonpartisan since 2023."),
  ...place(["Alyse Galvin", "Bryce Edgmon", "Calvin Schrage", "Ky Holland", "Rebecca Himschoot"], L, AK_COALITION),
  ...place(
    ["Jason Pizzo", "Angela Cockerham", "Shanda Yates", "Carla Cunningham", "Nasif Majeed", "Jon Brien", "Ed Crockett"],
    L,
    LEFT_D,
  ),
  ...place(["Ed Clere", "Rick Bennett", "Susannah Whipps", "Aidan Ankarberg", "Tom Ploszaj"], C, LEFT_R),
  ...place(["Troy Headrick"], L, "Elected as a Vermont Progressive; now an independent."),
  ...place(["Jed Lipsky"], C, "Independent listed as a Republican in Wikidata."),
  ...place(["Emily Buss"], C, "Forward Party senator and lifelong Republican until joining Forward in 2025."),
  ...place(
    ["Christina Henderson"],
    L,
    "Holds a D.C. Council at-large seat closed to the majority party; former Democratic Senate staffer.",
  ),
  ...place(
    ["Elissa Silverman"],
    L,
    "Holds a D.C. Council at-large seat closed to the majority party; left the Democratic Party to run for it.",
  ),
  ...place(
    ["Joanne Rodríguez Veve"],
    C,
    "Elected for Proyecto Dignidad, a Christian-democratic party; now an independent.",
  ),
  ...place(["Anne Lopez"], L, "Appointed by Democratic Governor Josh Green."),
  ...place(["Mike Hilgers"], C, "Former Republican speaker of the Nebraska Legislature."),
]);

// Puerto Rico's parties divide over the island's status rather than
// left and right, and members of each sit in both national parties; they're
// placed by the position each party holds on Puerto Rico's own spectrum.
const PR_PARTIES: [RegExp, Lean, string][] = [
  [/^(partido nuevo progresista|new progressive)/, C, "Partido Nuevo Progresista, the center-right statehood party."],
  [
    /^(partido popular democr|popular democratic)/,
    L,
    "Partido Popular Democrático, the center-left commonwealth party.",
  ],
  [
    /^(partido independentista|puerto rican independence)/,
    L,
    "Partido Independentista Puertorriqueño, the social-democratic independence party.",
  ],
  [/^(movimiento victoria ciudadana|citizens' victory)/, L, "Movimiento Victoria Ciudadana, a left-wing party."],
  [/^proyecto dignidad/, C, "Proyecto Dignidad, a Christian-democratic, socially conservative party."],
];

const prParty = (party: string) => PR_PARTIES.find(([re]) => re.test(party.trim().toLowerCase()));

// Party strings as they arrive from Congress, OpenStates and the
// governors' import: "Republican", "R", "Republican/Conservative",
// "Democratic", "Democrat", "D", "Democratic-Farmer-Labor",
// "Democratic/Working Families", FEC's "DEM"/"REP", … Independents and
// nonpartisan seats don't map onto either side.
function leanFromParty(party: string): Lean | null {
  const p = party.trim().toLowerCase();
  if (p === "r" || p === "rep" || p.startsWith("republican")) return "conservative";
  if (p === "d" || p === "dem" || p === "dfl" || p.startsWith("democrat")) return "liberal";
  // Minor parties by the side of the spectrum they run on.
  if (
    /^(green|gre|socialist|working families|wf|progressive|peace and freedom|vermont progressive|dsa|legal marijuana now)/.test(
      p,
    )
  )
    return "liberal";
  if (/^(libertarian|lib|constitution|conservative|american independent|america first)( party)?$/.test(p))
    return "conservative";
  return prParty(p)?.[1] ?? null;
}

function metadataField(metadata: string | undefined, key: "party" | "lean" | "leanBasis"): string | null {
  if (!metadata || !metadata.includes(`"${key}"`)) return null;
  try {
    const value = (JSON.parse(metadata) as Record<string, unknown>)[key];
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

export function leanOf(entity: Pick<Entity, "name" | "type" | "metadata">): Lean | null {
  const named = LEAN_BY_NAME.get(entity.name);
  if (named) return named;
  if (entity.type === "politician") {
    const party = metadataField(entity.metadata, "party");
    const fromParty = party ? leanFromParty(party) : null;
    return fromParty ?? OFFICIAL_PLACED.get(entity.name)?.[0] ?? null;
  }
  const computed = metadataField(entity.metadata, "lean");
  return leans.includes(computed as Lean) ? (computed as Lean) : null;
}

// Placed by hand on the curated lists above, as opposed to by party or
// FEC money.
export function isCurated(entity: Pick<Entity, "name">): boolean {
  return LEAN_BY_NAME.has(entity.name);
}

// Why an entity sits where it does, in one sentence, when that isn't
// self-evident from a party label.
export function leanBasisOf(entity: Pick<Entity, "name" | "type" | "metadata">): string | null {
  if (OUTLET_PLACED.has(entity.name))
    return "Straight-news journalist, placed by the lean of their outlet's audience (Pew Research Center).";
  if (LEAN_BY_NAME.has(entity.name)) return null;
  if (entity.type === "politician") {
    const party = metadataField(entity.metadata, "party");
    if (party && prParty(party)) return prParty(party)![2];
    if (party && leanFromParty(party)) return null;
    return OFFICIAL_PLACED.get(entity.name)?.[1] ?? null;
  }
  return metadataField(entity.metadata, "leanBasis");
}

const PERSON_TYPES = new Set<string>(["politician", "judge", "pundit", "journalist"]);

// What a node's colour means in the network: people by political family,
// everything else as an institution. Party colours mean only this.
export type NodeFamily = Lean | "unplaced" | "institution";

export function familyOf(entity: Pick<Entity, "name" | "type" | "metadata">): NodeFamily {
  const lean = leanOf(entity);
  if (lean) return lean;
  return PERSON_TYPES.has(entity.type) ? "unplaced" : "institution";
}
