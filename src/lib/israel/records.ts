// Hand-kept, source-linked records behind /israel: arms-sale notifications,
// the aid agreements and emergency laws, key congressional votes, Security
// Council vetoes, the advocacy groups whose FEC committees Worldview tracks,
// and the timeline. Every record names its source. Year-by-year money, trade
// and UN General Assembly votes are imported datasets instead (crs-israel-aid,
// census-trade, un-votes). scripts/import-voteview-rollcalls.mjs reads
// KEY_VOTES to load each member's vote.

const CRS = "https://www.congress.gov/crs-product/RL33222";
const congressBill = (congress: number, type: string, n: number) =>
  `https://www.congress.gov/bill/${congress}th-congress/${type}/${n}`;

// ---------------------------------------------------------------- Arms sales

export type ArmsStatus = "Notified" | "Emergency notification" | "Contracted";

export interface ArmsSale {
  item: string;
  category: "Aircraft" | "Munitions" | "Missiles" | "Vehicles" | "Fuel" | "Equipment";
  notified: string; // year, or ISO date when known
  contractor: string;
  value: number; // estimated value in the notification, USD
  status: ArmsStatus;
  // What happened after notification, when public.
  followUp?: string;
  delivery: string;
  source: string;
}

// From CRS RL33222 Table 3 (May 2025), plus later notices. A notified value
// is an estimate of a possible sale: it is not money spent, and says nothing
// on its own about whether U.S. aid or Israel's own funds pay for it.
export const ARMS_SALES: ArmsSale[] = [
  { item: "8 KC-46A aerial refueling aircraft", category: "Aircraft", notified: "2020", contractor: "Boeing", value: 2.4e9, status: "Contracted", followUp: "Contract for 4 tankers signed August 2022 for $927 million.", delivery: "Expected 2025–2026", source: CRS },
  { item: "JP-8 aviation fuel, diesel fuel, and unleaded gasoline", category: "Fuel", notified: "2020", contractor: "Not named", value: 3e9, status: "Notified", delivery: "Not public", source: CRS },
  { item: "18 CH-53K heavy-lift helicopters", category: "Aircraft", notified: "2021", contractor: "Lockheed Martin (Sikorsky), General Electric", value: 3.4e9, status: "Contracted", followUp: "Letter of offer for 12 helicopters signed late 2021 for $2 billion.", delivery: "Expected 2025–2026", source: CRS },
  { item: "120mm M830A1 tank cartridges", category: "Munitions", notified: "2023", contractor: "U.S. Army inventory", value: 106.5e6, status: "Emergency notification", delivery: "Not public", source: CRS },
  { item: "M107 155mm artillery projectiles", category: "Munitions", notified: "2023", contractor: "U.S. Army inventory", value: 147.5e6, status: "Emergency notification", delivery: "Not public", source: CRS },
  { item: "50 F-15IA fighters and upgrade kits for 25 F-15Is", category: "Aircraft", notified: "2024-08", contractor: "Boeing", value: 18.82e9, status: "Contracted", followUp: "Israel and Boeing contracted for 25 F-15IAs in November 2024 for $5.2 billion.", delivery: "From 2031, 4–6 a year", source: CRS },
  { item: "30 AIM-120C-8 AMRAAM air-to-air missiles", category: "Missiles", notified: "2024-08", contractor: "RTX", value: 102.5e6, status: "Notified", delivery: "Not public", source: CRS },
  { item: "32,739 120mm tank cartridges", category: "Munitions", notified: "2024-08", contractor: "General Dynamics OTS, Northrop Grumman", value: 774.1e6, status: "Notified", delivery: "Not public", source: CRS },
  { item: "50,000 M933A1 120mm mortar cartridges", category: "Munitions", notified: "2024-08", contractor: "General Dynamics OTS", value: 61.1e6, status: "Notified", delivery: "Not public", source: CRS },
  { item: "M1148A1P2 medium tactical vehicles", category: "Vehicles", notified: "2024-08", contractor: "Oshkosh", value: 583.1e6, status: "Notified", delivery: "Not public", source: CRS },
  { item: "Heavy-duty tank trailers", category: "Vehicles", notified: "2024", contractor: "Leonardo DRS", value: 164.6e6, status: "Notified", delivery: "Not public", source: CRS },
  { item: "Munitions, guidance kits, and fuzes (incl. 2,000-lb bomb kits)", category: "Munitions", notified: "2025-02-07", contractor: "Boeing and others", value: 6.75e9, status: "Notified", delivery: "Not public", source: CRS },
  { item: "AGM-114 Hellfire missiles", category: "Missiles", notified: "2025-02-07", contractor: "Lockheed Martin", value: 660e6, status: "Notified", delivery: "Not public", source: CRS },
  { item: "Caterpillar D9 bulldozers", category: "Vehicles", notified: "2025-02-28", contractor: "Caterpillar", value: 295e6, status: "Emergency notification", delivery: "Not public", source: CRS },
  { item: "Munitions, guidance kits, and support", category: "Munitions", notified: "2025-02-28", contractor: "Boeing and others", value: 675.7e6, status: "Emergency notification", delivery: "Not public", source: CRS },
  { item: "Munitions and munitions support", category: "Munitions", notified: "2025-02-28", contractor: "General Dynamics and others", value: 2.04e9, status: "Emergency notification", delivery: "Not public", source: CRS },
  { item: "Eitan powerpack engines", category: "Vehicles", notified: "2025", contractor: "Rolls-Royce Solutions America", value: 180e6, status: "Notified", delivery: "Not public", source: CRS },
  { item: "Joint Light Tactical Vehicles", category: "Vehicles", notified: "2026-01-30", contractor: "Not named", value: 1.98e9, status: "Notified", delivery: "Not public", source: "https://www.dsca.mil/Press-Media/Major-Arms-Sales" },
];

// Cumulative arms-transfer figures CRS quotes from the State Department and DSCA.
export const ARMS_FACTS = [
  { value: 53.4e9, label: "Foreign Military Sales delivered", period: "1950–2022", note: "Second-largest U.S. customer by value, after Saudi Arabia" },
  { value: 39.2e9, label: "Active FMS cases", period: "April 2025", note: "751 open cases" },
  { value: 12.2e9, label: "Direct Commercial Sales licensed", period: "FY2018–FY2022", note: "U.S. firms selling directly under export licenses" },
  { value: 6.6e9, label: "Excess defense articles", period: "since 1992", note: "Surplus U.S. equipment transferred" },
];

// ------------------------------------------------------- Agreements and laws

export interface AidAgreement {
  name: string;
  years: string;
  signed: string;
  president: string;
  total: number;
  military: number;
  missileDefense: number | null;
  terms: string;
}

export const MOUS: AidAgreement[] = [
  { name: "First MOU (\"Glide Path\")", years: "FY1999–FY2008", signed: "1998", president: "Clinton", total: 26.7e9, military: 21.3e9, missileDefense: null, terms: "Phased out economic aid while raising military aid." },
  { name: "Second MOU", years: "FY2009–FY2018", signed: "2007", president: "George W. Bush", total: 30e9, military: 30e9, missileDefense: null, terms: "Israel may spend up to 26.3% of FMF on Israeli-made equipment (off-shore procurement)." },
  { name: "Third MOU", years: "FY2019–FY2028", signed: "September 14, 2016", president: "Obama", total: 38e9, military: 33e9, missileDefense: 5e9, terms: "$3.3B a year in FMF plus $500M a year for missile defense, subject to appropriation. Off-shore procurement phases out by FY2028." },
];

export interface EmergencyLaw {
  date: string;
  law: string;
  action: string;
  url: string;
}

// Funding above the regular annual level (CRS RL33222, appendix table).
export const EMERGENCY_LAWS: EmergencyLaw[] = [
  { date: "1973-12-26", law: "Emergency Security Assistance Act of 1973 (P.L. 93-199)", action: "$2.2 billion in emergency military aid after the Yom Kippur War; $1.5 billion became grants.", url: CRS },
  { date: "1985-08-15", law: "Supplemental Appropriations Act, 1985 (P.L. 99-88)", action: "$1.5 billion in economic aid as cash grants, during Israel's inflation crisis.", url: CRS },
  { date: "1991-03-28", law: "Emergency Supplemental Assistance for Israel Act of 1991 (P.L. 102-21)", action: "$650 million in cash for costs of the Gulf War.", url: CRS },
  { date: "1992-10-06", law: "Foreign Operations Appropriations Act, 1993 (P.L. 102-391)", action: "Up to $10 billion in loan guarantees to resettle immigrants from the former Soviet Union and Ethiopia.", url: CRS },
  { date: "2003-04-16", law: "Emergency Wartime Supplemental Appropriations Act (P.L. 108-11)", action: "$1 billion in FMF and $9 billion in loan guarantees.", url: CRS },
  { date: "2014-08-04", law: "Emergency Supplemental Appropriations Resolution, 2014 (P.L. 113-145)", action: "$225 million for Iron Dome during the Gaza war.", url: CRS },
  { date: "2022-03-15", law: "Consolidated Appropriations Act, 2022 (P.L. 117-103)", action: "$1 billion to replenish Iron Dome after the May 2021 Gaza war.", url: CRS },
  { date: "2024-04-24", law: "Israel Security Supplemental Appropriations Act, 2024 (P.L. 118-50)", action: "$3.5 billion in FMF, $4 billion for missile defense, and $1.2 billion for Iron Beam.", url: CRS },
];

// The FY2024 money as it moved: Congress → agency → program → who receives it.
export const FOLLOW_THE_MONEY = [
  {
    program: "Foreign Military Financing",
    law: "P.L. 118-47 (regular) and P.L. 118-50 (supplemental)",
    amount: 6.8e9,
    agency: "State Department; DSCA administers purchases",
    recipient: "Mostly U.S. contractors through FMS cases; up to $769.3M of the supplemental may buy Israeli-made equipment",
    outcome: "Aircraft, munitions, vehicles and services delivered to the Israel Defense Forces",
  },
  {
    program: "Missile defense",
    law: "P.L. 118-47 and P.L. 118-50, Defense Department accounts",
    amount: 5.7e9,
    agency: "Missile Defense Agency with Israel's Missile Defense Organization",
    recipient: "Rafael, IAI, and U.S. co-producers such as RTX and Boeing; at least half of procurement must be spent in the U.S.",
    outcome: "Iron Dome, David's Sling, Arrow interceptors; Iron Beam laser development",
  },
];

// ------------------------------------------------------------- Key votes

export type VoteKind = "Aid appropriation" | "Arms-sale disapproval" | "Resolution" | "Censure" | "Domestic law";

export interface KeyVote {
  id: string; // matches roll_calls.external_id
  chamber: "House" | "Senate";
  congress: number;
  session: number;
  roll: number;
  date: string;
  measure: string;
  title: string;
  kind: VoteKind;
  question: string;
  // What a yes vote did, in plain words.
  yesMeans: string;
  yea: number;
  nay: number;
  result: "Passed" | "Agreed to" | "Rejected";
  sponsor: string;
  url: string;
}

// Tallies and titles checked against Congress.gov bill actions.
export const KEY_VOTES: KeyVote[] = [
  { id: "h117-1-275", chamber: "House", congress: 117, session: 1, roll: 275, date: "2021-09-23", measure: "H.R. 5323", title: "Iron Dome Supplemental Appropriations Act, 2022", kind: "Aid appropriation", question: "On passage", yesMeans: "Add $1 billion to replenish Iron Dome interceptors", yea: 420, nay: 9, result: "Passed", sponsor: "Rosa DeLauro (D-CT)", url: congressBill(117, "house-bill", 5323) },
  { id: "h118-1-528", chamber: "House", congress: 118, session: 1, roll: 528, date: "2023-10-25", measure: "H.Res. 771", title: "Standing with Israel as it defends itself against the war launched by Hamas", kind: "Resolution", question: "On agreeing to the resolution", yesMeans: "State the House's support for Israel after October 7; no funding", yea: 412, nay: 10, result: "Agreed to", sponsor: "Michael McCaul (R-TX)", url: congressBill(118, "house-resolution", 771) },
  { id: "h118-1-622", chamber: "House", congress: 118, session: 1, roll: 622, date: "2023-11-07", measure: "H.Res. 845", title: "Censuring Representative Rashida Tlaib", kind: "Censure", question: "On agreeing to the resolution", yesMeans: "Censure Rep. Tlaib over her statements on October 7 and Israel", yea: 234, nay: 188, result: "Agreed to", sponsor: "Rich McCormick (R-GA)", url: congressBill(118, "house-resolution", 845) },
  { id: "h118-2-152", chamber: "House", congress: 118, session: 2, roll: 152, date: "2024-04-20", measure: "H.R. 8034", title: "Israel Security Supplemental Appropriations Act, 2024", kind: "Aid appropriation", question: "On passage", yesMeans: "Send $3.5B in FMF and $5.2B for missile defense, among other funding", yea: 366, nay: 58, result: "Passed", sponsor: "Tom Cole (R-OK)", url: congressBill(118, "house-bill", 8034) },
  { id: "s118-2-154", chamber: "Senate", congress: 118, session: 2, roll: 154, date: "2024-04-23", measure: "H.R. 815", title: "National security supplemental (Israel, Ukraine, Indo-Pacific)", kind: "Aid appropriation", question: "On the motion to concur", yesMeans: "Clear the package carrying the Israel supplemental for the President's signature", yea: 79, nay: 18, result: "Passed", sponsor: "Senate passage of the House package", url: congressBill(118, "house-bill", 815) },
  { id: "h118-2-172", chamber: "House", congress: 118, session: 2, roll: 172, date: "2024-05-01", measure: "H.R. 6090", title: "Antisemitism Awareness Act of 2023", kind: "Domestic law", question: "On passage", yesMeans: "Adopt the IHRA definition of antisemitism for Education Department civil-rights enforcement", yea: 320, nay: 91, result: "Passed", sponsor: "Mike Lawler (R-NY)", url: congressBill(118, "house-bill", 6090) },
  { id: "s118-2-292", chamber: "Senate", congress: 118, session: 2, roll: 292, date: "2024-11-20", measure: "S.J.Res. 111", title: "Disapproval of a proposed foreign military sale to Israel", kind: "Arms-sale disapproval", question: "Motion to discharge", yesMeans: "Bring a resolution blocking one of the August 2024 sales to the floor", yea: 18, nay: 79, result: "Rejected", sponsor: "Bernie Sanders (I-VT)", url: congressBill(118, "senate-joint-resolution", 111) },
  { id: "s118-2-293", chamber: "Senate", congress: 118, session: 2, roll: 293, date: "2024-11-20", measure: "S.J.Res. 113", title: "Disapproval of a proposed foreign military sale to Israel", kind: "Arms-sale disapproval", question: "Motion to discharge", yesMeans: "Bring a resolution blocking one of the August 2024 sales to the floor", yea: 19, nay: 78, result: "Rejected", sponsor: "Bernie Sanders (I-VT)", url: congressBill(118, "senate-joint-resolution", 113) },
  { id: "s118-2-294", chamber: "Senate", congress: 118, session: 2, roll: 294, date: "2024-11-20", measure: "S.J.Res. 115", title: "Disapproval of an export license for JDAM guidance kits to Israel", kind: "Arms-sale disapproval", question: "Motion to discharge", yesMeans: "Bring a resolution blocking a commercial JDAM export to the floor", yea: 17, nay: 80, result: "Rejected", sponsor: "Bernie Sanders (I-VT)", url: congressBill(118, "senate-joint-resolution", 115) },
  { id: "s119-1-165", chamber: "Senate", congress: 119, session: 1, roll: 165, date: "2025-04-03", measure: "S.J.Res. 33", title: "Disapproval of a proposed foreign military sale to Israel", kind: "Arms-sale disapproval", question: "Motion to discharge", yesMeans: "Bring a resolution blocking a 2025 sale to the floor", yea: 15, nay: 82, result: "Rejected", sponsor: "Bernie Sanders (I-VT)", url: congressBill(119, "senate-joint-resolution", 33) },
  { id: "s119-1-166", chamber: "Senate", congress: 119, session: 1, roll: 166, date: "2025-04-03", measure: "S.J.Res. 26", title: "Disapproval of a proposed foreign military sale to Israel", kind: "Arms-sale disapproval", question: "Motion to discharge", yesMeans: "Bring a resolution blocking a 2025 sale to the floor", yea: 15, nay: 83, result: "Rejected", sponsor: "Bernie Sanders (I-VT)", url: congressBill(119, "senate-joint-resolution", 26) },
  { id: "s119-1-454", chamber: "Senate", congress: 119, session: 1, roll: 454, date: "2025-07-30", measure: "S.J.Res. 41", title: "Disapproval of a proposed export of defense articles to Israel", kind: "Arms-sale disapproval", question: "Motion to discharge", yesMeans: "Bring a resolution blocking a commercial export to the floor", yea: 27, nay: 70, result: "Rejected", sponsor: "Bernie Sanders (I-VT)", url: congressBill(119, "senate-joint-resolution", 41) },
  { id: "s119-1-455", chamber: "Senate", congress: 119, session: 1, roll: 455, date: "2025-07-30", measure: "S.J.Res. 34", title: "Disapproval of a proposed foreign military sale to Israel", kind: "Arms-sale disapproval", question: "Motion to discharge", yesMeans: "Bring a resolution blocking a 2025 sale to the floor", yea: 24, nay: 73, result: "Rejected", sponsor: "Bernie Sanders (I-VT)", url: congressBill(119, "senate-joint-resolution", 34) },
];

// --------------------------------------------------------- Security Council

export interface Veto {
  date: string;
  draft: string;
  subject: string;
}

// U.S. vetoes of Gaza-war drafts. Each draft is checked against its UN
// Digital Library record; failed drafts are not in the voting dataset.
export const VETOES: Veto[] = [
  { date: "2023-10-18", draft: "S/2023/773", subject: "Humanitarian pauses in Gaza (Brazil)" },
  { date: "2023-12-08", draft: "S/2023/970", subject: "Immediate humanitarian ceasefire (United Arab Emirates)" },
  { date: "2024-02-20", draft: "S/2024/173", subject: "Immediate humanitarian ceasefire (Algeria)" },
  { date: "2024-04-18", draft: "S/2024/312", subject: "Admitting the State of Palestine to UN membership (Algeria)" },
  { date: "2024-11-20", draft: "S/2024/835", subject: "Immediate, unconditional and permanent ceasefire (ten elected members)" },
  { date: "2025-06-04", draft: "S/2025/353", subject: "Ceasefire and humanitarian access (ten elected members)" },
  { date: "2025-09-18", draft: "S/2025/583", subject: "Ceasefire, release of hostages and humanitarian access (ten elected members)" },
];

export const undocUrl = (symbol: string) => `https://undocs.org/${symbol}`;

// ------------------------------------------------------------- Influence

export interface InfluenceGroup {
  name: string;
  short: string;
  committees: string[]; // FEC committee ids
  kind: string;
  stance: string;
}

export const INFLUENCE_GROUPS: InfluenceGroup[] = [
  { name: "AIPAC PAC", short: "AIPAC", committees: ["C00797670"], kind: "PAC (direct contributions)", stance: "AIPAC's PAC, launched in 2021; backs candidates of both parties who support the U.S.–Israel alliance." },
  { name: "United Democracy Project", short: "UDP", committees: ["C00799031"], kind: "Super PAC (independent expenditures)", stance: "AIPAC-affiliated super PAC; spends in primaries for and against candidates." },
  { name: "NORPAC", short: "NORPAC", committees: ["C00247403"], kind: "PAC (direct contributions)", stance: "New Jersey–based pro-Israel PAC that bundles contributions to candidates." },
  { name: "Republican Jewish Coalition PAC", short: "RJC", committees: ["C00345132"], kind: "PAC (direct contributions)", stance: "Republican group; supports Republican candidates it considers pro-Israel." },
  { name: "Democratic Majority for Israel PAC", short: "DMFI", committees: ["C00710848"], kind: "Hybrid PAC (contributions and independent expenditures)", stance: "Democratic group backing pro-Israel Democrats, often in primaries." },
  { name: "J Street", short: "J Street", committees: ["C00441949", "C00815753"], kind: "PAC and super PAC", stance: "Describes itself as pro-Israel and pro-peace; supports a two-state outcome and conditions on some aid." },
  { name: "Pro-Israel America", short: "PIA", committees: ["C00699470", "C00740936"], kind: "PAC and super PAC", stance: "Bipartisan pro-Israel PAC founded by former AIPAC staff." },
];

// Groups lobbying Congress on Israel policy, by their LDA client name
// (scripts/import-lda-lobbying.mjs --clients=...).
export const LOBBYING_CLIENTS: [label: string, ldaClient: string][] = [
  ["AIPAC", "AMERICAN ISRAEL PUBLIC AFFAIRS COMMITTEE"],
  ["J Street", "J STREET"],
  ["Republican Jewish Coalition", "REPUBLICAN JEWISH COALITION"],
  ["Christians United for Israel Action Fund", "CHRISTIANS UNITED FOR ISRAEL ACTION FUND"],
  ["Zionist Organization of America", "ZIONIST ORGANIZATION OF AMERICA"],
  ["New Jewish Narrative (Americans for Peace Now)", "NEW JEWISH NARRATIVE (FKA AMERICANS FOR PEACE NOW)"],
];

// ------------------------------------------------------------- Timeline

export type Era = "Founding" | "Cold War" | "Peace process" | "Post-9/11" | "Gaza war";

export interface TimelineEvent {
  date: string;
  title: string;
  era: Era;
  happened: string;
  us: string;
  israel: string;
  changed: string;
  lane: "Financial" | "Military" | "Political" | "Diplomatic";
  source: { label: string; url: string };
}

const HISTORIAN = (path: string) => ({ label: "Office of the Historian", url: `https://history.state.gov/${path}` });
const CRS_SRC = { label: "CRS, U.S. Foreign Aid to Israel", url: CRS };

export const TIMELINE: TimelineEvent[] = [
  { date: "1948-05-14", title: "Israel declares independence", era: "Founding", lane: "Diplomatic", happened: "Israel declared statehood as the British Mandate ended; Arab states invaded the next day.", us: "Truman recognized the provisional government within minutes. The U.S. kept an arms embargo on the region.", israel: "Fought the 1948 war and secured armistice lines in 1949.", changed: "The U.S. was the first country to recognize Israel.", source: HISTORIAN("milestones/1945-1952/creation-israel") },
  { date: "1949-01-01", title: "First U.S. aid", era: "Founding", lane: "Financial", happened: "The Export-Import Bank lent Israel $100 million.", us: "Gave modest economic aid through the 1950s and 1960s.", israel: "Absorbed hundreds of thousands of immigrants in its first years.", changed: "Aid stayed under $160 million a year until FY1971.", source: CRS_SRC },
  { date: "1956-10-29", title: "Suez Crisis", era: "Cold War", lane: "Diplomatic", happened: "Israel, Britain and France attacked Egypt after it nationalized the Suez Canal.", us: "Eisenhower demanded withdrawal and threatened economic pressure.", israel: "Withdrew from Sinai and Gaza by March 1957.", changed: "Israel withdrew under U.S. pressure; UN peacekeepers deployed in Sinai.", source: HISTORIAN("milestones/1953-1960/suez") },
  { date: "1962-08-01", title: "First major U.S. arms sale", era: "Cold War", lane: "Military", happened: "Kennedy approved selling Hawk air-defense missiles.", us: "Ended the practice of not selling major weapons to Israel.", israel: "Began shifting from French to U.S. weapons.", changed: "Opened the arms relationship; Skyhawks (1966) and F-4 Phantoms (1968) followed.", source: HISTORIAN("milestones/1961-1968") },
  { date: "1967-06-05", title: "Six-Day War", era: "Cold War", lane: "Diplomatic", happened: "Israel took Sinai, Gaza, the West Bank, East Jerusalem and the Golan Heights.", us: "Helped draft UN Security Council Resolution 242: land for peace.", israel: "Began administering the territories; settlement building followed.", changed: "Resolution 242 became the basis of later peace talks.", source: HISTORIAN("milestones/1961-1968/arab-israeli-war-1967") },
  { date: "1973-10-06", title: "Yom Kippur War", era: "Cold War", lane: "Military", happened: "Egypt and Syria attacked; Israel recovered after heavy losses.", us: "Airlifted arms (Operation Nickel Grass) and enacted $2.2 billion in emergency aid.", israel: "Pushed back both fronts before a ceasefire.", changed: "U.S. aid jumped to billions a year; Arab states imposed an oil embargo on the U.S.", source: HISTORIAN("milestones/1969-1976/arab-israeli-war-1973") },
  { date: "1978-09-17", title: "Camp David Accords", era: "Peace process", lane: "Diplomatic", happened: "Carter brokered the Egypt–Israel framework; the peace treaty followed in March 1979.", us: "Pledged large aid packages to both countries.", israel: "Agreed to return Sinai to Egypt.", changed: "FY1979 aid reached $4.9 billion. Egypt became the second-largest recipient.", source: HISTORIAN("milestones/1977-1980/camp-david") },
  { date: "1985-04-22", title: "U.S.–Israel Free Trade Agreement", era: "Peace process", lane: "Financial", happened: "The first free trade agreement the U.S. signed with any country.", us: "Phased out tariffs on most Israeli goods.", israel: "Phased out tariffs on most U.S. goods.", changed: "Trade grew from about $4.7 billion in 1985 to over $36 billion in 2024.", source: { label: "USTR", url: "https://ustr.gov/trade-agreements/free-trade-agreements/israel-fta" } },
  { date: "1987-02-01", title: "Major non-NATO ally", era: "Peace process", lane: "Military", happened: "The U.S. designated Israel a major non-NATO ally.", us: "Opened joint research, stockpiles and defense contracting to Israel.", israel: "Joined U.S. missile-defense research (Arrow began in 1988).", changed: "Laid the base for joint missile defense, now over $16 billion.", source: CRS_SRC },
  { date: "1993-09-13", title: "Oslo Accords", era: "Peace process", lane: "Diplomatic", happened: "Israel and the PLO signed the Declaration of Principles at the White House.", us: "Hosted the signing; began aid to the Palestinian Authority.", israel: "Recognized the PLO and transferred some West Bank and Gaza areas.", changed: "Set up the Palestinian Authority. Final-status talks failed in 2000.", source: HISTORIAN("milestones/1993-2000/oslo") },
  { date: "2016-09-14", title: "$38 billion MOU", era: "Post-9/11", lane: "Financial", happened: "The third ten-year memorandum on military aid was signed.", us: "Pledged $3.3B a year in FMF plus $500M for missile defense, FY2019–FY2028.", israel: "Agreed to phase out spending U.S. aid on Israeli-made equipment.", changed: "The largest military aid pledge the U.S. has made to any country.", source: CRS_SRC },
  { date: "2016-12-23", title: "U.S. abstains on Resolution 2334", era: "Post-9/11", lane: "Diplomatic", happened: "The Security Council called settlements a flagrant violation of international law.", us: "Abstained instead of vetoing, letting it pass 14–0.", israel: "Condemned the resolution and the abstention.", changed: "The Council's first resolution on settlements since 1980.", source: { label: "UN Digital Library", url: "https://undocs.org/S/RES/2334(2016)" } },
  { date: "2017-12-06", title: "Jerusalem recognized as capital", era: "Post-9/11", lane: "Diplomatic", happened: "Trump recognized Jerusalem as Israel's capital; the embassy moved in May 2018.", us: "Carried out the Jerusalem Embassy Act of 1995, which past presidents had waived.", israel: "Welcomed the move.", changed: "Followed by recognizing Israeli sovereignty over the Golan Heights in March 2019.", source: { label: "Jerusalem Embassy Act (P.L. 104-45)", url: "https://www.congress.gov/bill/104th-congress/senate-bill/1322" } },
  { date: "2020-09-15", title: "Abraham Accords", era: "Post-9/11", lane: "Diplomatic", happened: "Israel normalized relations with the UAE and Bahrain; Morocco and Sudan followed.", us: "Brokered the deals, with F-35 sales to the UAE offered alongside.", israel: "Suspended West Bank annexation plans.", changed: "The first Arab normalizations with Israel since Jordan in 1994.", source: { label: "State Department", url: "https://www.state.gov/the-abraham-accords/" } },
  { date: "2023-10-07", title: "Hamas attack and the Gaza war", era: "Gaza war", lane: "Military", happened: "Hamas-led attacks killed about 1,200 people in Israel and took about 250 hostages, by Israeli government count.", us: "Sent carrier groups, munitions and interceptors; requested over $14 billion in Israel-related funding.", israel: "Began an air and ground campaign in Gaza.", changed: "FY2024 became the largest year of U.S. aid to Israel in current dollars.", source: CRS_SRC },
  { date: "2024-01-26", title: "ICJ orders provisional measures", era: "Gaza war", lane: "Diplomatic", happened: "In South Africa's genocide case against Israel, the International Court of Justice ordered Israel to prevent genocidal acts and allow aid in.", us: "Called the genocide claim unfounded.", israel: "Rejected the accusation.", changed: "The case on the merits is pending.", source: { label: "International Court of Justice", url: "https://www.icj-cij.org/case/192" } },
  { date: "2024-04-24", title: "Israel security supplemental enacted", era: "Gaza war", lane: "Financial", happened: "Biden signed P.L. 118-50.", us: "Added $3.5B in FMF, $4B for missile defense and $1.2B for Iron Beam to the regular $3.8B.", israel: "Used the funds for munitions, interceptors and aircraft.", changed: "FY2024 aid totaled $12.5 billion.", source: CRS_SRC },
  { date: "2024-11-21", title: "ICC arrest warrants", era: "Gaza war", lane: "Diplomatic", happened: "The International Criminal Court issued warrants for Netanyahu, former defense minister Gallant and Hamas commander Mohammed Deif.", us: "Rejected the court's jurisdiction; in February 2025 the President authorized sanctions on ICC officials.", israel: "Rejected the warrants and appealed.", changed: "Some ICC member states said they would arrest Netanyahu if he visited.", source: { label: "International Criminal Court", url: "https://www.icc-cpi.int/situations/palestine" } },
  { date: "2025-02-28", title: "Emergency arms sales", era: "Gaza war", lane: "Military", happened: "The administration declared an emergency to send about $4 billion in arms without the usual congressional review.", us: "Also rescinded the 2024 memorandum (NSM-20) that set reporting conditions on arms recipients.", israel: "Received bombs, guidance kits and D9 bulldozers held under the prior administration.", changed: "Sales approved since January 2025 reached about $12 billion by March.", source: CRS_SRC },
  { date: "2025-06-22", title: "U.S. strikes on Iran's nuclear sites", era: "Gaza war", lane: "Military", happened: "After Israel began striking Iran on June 13, U.S. bombers hit Fordow, Natanz and Isfahan.", us: "Joined the war directly, then brokered a ceasefire that took effect June 24.", israel: "Ended its campaign under the ceasefire.", changed: "The first direct U.S. strikes on Iranian territory.", source: { label: "Department of Defense", url: "https://www.defense.gov/News/" } },
  { date: "2025-10-10", title: "Gaza ceasefire", era: "Gaza war", lane: "Diplomatic", happened: "A ceasefire under the U.S. plan took effect; living hostages were released on October 13.", us: "Brokered the plan; the Security Council endorsed it in Resolution 2803 on November 17.", israel: "Pulled back to agreed lines and released Palestinian prisoners.", changed: "The Gaza Health Ministry, whose count does not separate civilians from fighters, had reported over 67,000 deaths by then.", source: { label: "UN Digital Library", url: "https://undocs.org/S/RES/2803(2025)" } },
];
