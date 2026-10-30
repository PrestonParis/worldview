// The constitutional and federal framework behind /guns' Constitution & Courts
// workspace: Supreme Court rulings, federal statutes, and ATF rules, with the
// earlier items each one interprets, extends, or tests (`builds`). Opinion
// authors who sit on the Court today link to their profiles on the page.

export type CourtKind = "ruling" | "statute" | "regulation";

export interface CourtItem {
  id: string;
  date: string; // YYYY-MM-DD, or YYYY when only the year matters
  kind: CourtKind;
  title: string;
  cite: string;
  question: string;
  holding: string;
  author?: string; // majority opinion author's surname
  vote?: string;
  builds: string[];
  href: string;
}

export const COURT_KINDS: { id: CourtKind; label: string }[] = [
  { id: "ruling", label: "Constitution & Supreme Court" },
  { id: "statute", label: "Federal statutes" },
  { id: "regulation", label: "ATF rules" },
];

const docket = (n: string) => `https://www.supremecourt.gov/docket/docketfiles/html/public/${n}.html`;

export const COURT_ITEMS: CourtItem[] = [
  {
    id: "2a",
    date: "1791-12-15",
    kind: "ruling",
    title: "Second Amendment ratified",
    cite: "U.S. Const. amend. II",
    question: "What does the right of the people to keep and bear arms protect?",
    holding:
      "“A well regulated Militia, being necessary to the security of a free State, the right of the people to keep and bear Arms, shall not be infringed.”",
    builds: [],
    href: "https://constitution.congress.gov/browse/amendment-2/",
  },
  {
    id: "nfa",
    date: "1934-06-26",
    kind: "statute",
    title: "National Firearms Act",
    cite: "26 U.S.C. ch. 53",
    question: "How should machine guns, short-barreled guns, and silencers be controlled?",
    holding:
      "Imposed a registration requirement and a $200 transfer tax on machine guns, short-barreled rifles and shotguns, silencers, and other listed weapons.",
    builds: [],
    href: "https://www.atf.gov/rules-and-regulations/national-firearms-act",
  },
  {
    id: "miller",
    date: "1939-05-15",
    kind: "ruling",
    title: "United States v. Miller",
    cite: "307 U.S. 174",
    question: "Does the Second Amendment protect possession of an unregistered short-barreled shotgun?",
    holding:
      "Upheld the National Firearms Act as applied: without evidence that such a shotgun bore a reasonable relationship to a well-regulated militia, the Court could not say the Amendment protects it.",
    author: "McReynolds",
    vote: "8–0",
    builds: ["2a", "nfa"],
    href: "https://supreme.justia.com/cases/federal/us/307/174/",
  },
  {
    id: "gca",
    date: "1968-10-22",
    kind: "statute",
    title: "Gun Control Act",
    cite: "18 U.S.C. ch. 44",
    question: "Who may deal in firearms, and who may not possess them?",
    holding:
      "Required dealers to be federally licensed, banned interstate sales of handguns to individuals, and created most of the federal prohibited-person categories in § 922(g).",
    builds: ["nfa"],
    href: "https://www.atf.gov/rules-and-regulations/gun-control-act",
  },
  {
    id: "fopa",
    date: "1986-05-19",
    kind: "statute",
    title: "Firearm Owners Protection Act",
    cite: "Pub. L. 99-308",
    question: "How far should federal dealer and transport rules reach?",
    holding:
      "Eased several Gun Control Act rules, protected transport of firearms between states where they are legal, and barred civilian possession or transfer of machine guns made after May 19, 1986.",
    builds: ["gca", "nfa"],
    href: "https://www.congress.gov/bill/99th-congress/senate-bill/49",
  },
  {
    id: "brady",
    date: "1993-11-30",
    kind: "statute",
    title: "Brady Handgun Violence Prevention Act",
    cite: "Pub. L. 103-159",
    question: "Should licensed dealers have to check buyers before a sale?",
    holding:
      "Set an interim five-day handgun waiting period and required the National Instant Criminal Background Check System, in use for dealer sales since November 30, 1998.",
    builds: ["gca"],
    href: "https://www.congress.gov/bill/103rd-congress/house-bill/1025",
  },
  {
    id: "vcclea",
    date: "1994-09-13",
    kind: "statute",
    title: "Violent Crime Control and Law Enforcement Act",
    cite: "Pub. L. 103-322",
    question: "Should certain semiautomatic weapons and large magazines be banned?",
    holding:
      "Banned manufacture and transfer of specified semiautomatic assault weapons and magazines over ten rounds for ten years (expired September 13, 2004), and added § 922(g)(8)'s prohibition for people under domestic-violence restraining orders.",
    builds: ["gca"],
    href: "https://www.congress.gov/bill/103rd-congress/house-bill/3355",
  },
  {
    id: "plcaa",
    date: "2005-10-26",
    kind: "statute",
    title: "Protection of Lawful Commerce in Arms Act",
    cite: "15 U.S.C. §§ 7901–7903",
    question: "Can gun makers and sellers be sued over crimes committed with their products?",
    holding:
      "Bars most civil suits against manufacturers and dealers for harm from criminal misuse of firearms, with exceptions such as knowing violations of firearm laws.",
    builds: [],
    href: "https://www.congress.gov/bill/109th-congress/senate-bill/397",
  },
  {
    id: "heller",
    date: "2008-06-26",
    kind: "ruling",
    title: "District of Columbia v. Heller",
    cite: "554 U.S. 570",
    question: "Does the Second Amendment protect an individual right unconnected to militia service?",
    holding:
      "Yes. The Amendment protects an individual right to keep and bear arms; D.C.'s ban on handguns in the home and its trigger-lock rule violated it.",
    author: "Scalia",
    vote: "5–4",
    builds: ["2a", "miller"],
    href: "https://tile.loc.gov/storage-services/service/ll/usrep/usrep554/usrep554570/usrep554570.pdf",
  },
  {
    id: "mcdonald",
    date: "2010-06-28",
    kind: "ruling",
    title: "McDonald v. City of Chicago",
    cite: "561 U.S. 742",
    question: "Does the Second Amendment limit state and local governments?",
    holding:
      "Yes. The right recognized in Heller is incorporated against the states through the Fourteenth Amendment, so Chicago's handgun ban could not stand.",
    author: "Alito",
    vote: "5–4",
    builds: ["heller"],
    href: "https://tile.loc.gov/storage-services/service/ll/usrep/usrep561/usrep561742/usrep561742.pdf",
  },
  {
    id: "caetano",
    date: "2016-03-21",
    kind: "ruling",
    title: "Caetano v. Massachusetts",
    cite: "577 U.S. 411",
    question: "Are arms that did not exist at the founding protected?",
    holding:
      "The Second Amendment extends, prima facie, to all bearable arms, including modern ones; the Court vacated a ruling upholding Massachusetts' stun-gun ban.",
    vote: "Per curiam",
    builds: ["heller", "mcdonald"],
    href: "https://supreme.justia.com/cases/federal/us/577/411/",
  },
  {
    id: "bumpstock-rule",
    date: "2018-12-26",
    kind: "regulation",
    title: "ATF bump-stock rule",
    cite: "83 Fed. Reg. 66514",
    question: "Is a bump stock a “machinegun” under federal law?",
    holding: "Reclassified bump-stock devices as machine guns, requiring owners to destroy or surrender them.",
    builds: ["nfa", "fopa"],
    href: "https://www.federalregister.gov/documents/2018/12/26/2018-27763/bump-stock-type-devices",
  },
  {
    id: "bruen",
    date: "2022-06-23",
    kind: "ruling",
    title: "New York State Rifle & Pistol Association v. Bruen",
    cite: "597 U.S. 1",
    question: "May a state require “proper cause” for a license to carry a handgun in public?",
    holding:
      "No. The Amendment protects carrying a handgun in public for self-defense, and a gun regulation is valid only if it is consistent with the Nation's historical tradition of firearm regulation.",
    author: "Thomas",
    vote: "6–3",
    builds: ["heller", "mcdonald"],
    href: "https://www.supremecourt.gov/opinions/21pdf/20-843_7j80.pdf",
  },
  {
    id: "frame-rule",
    date: "2022-04-26",
    kind: "regulation",
    title: "ATF frame-or-receiver rule",
    cite: "87 Fed. Reg. 24652",
    question: "When is a weapon parts kit a “firearm” that needs a serial number and a background check?",
    holding:
      "Treated kits that can readily be completed into working guns, and partially complete frames and receivers, as firearms under the Gun Control Act.",
    builds: ["gca"],
    href: "https://www.federalregister.gov/documents/2022/04/26/2022-08026/definition-of-frame-or-receiver-and-identification-of-firearms",
  },
  {
    id: "bsca",
    date: "2022-06-25",
    kind: "statute",
    title: "Bipartisan Safer Communities Act",
    cite: "Pub. L. 117-159",
    question: "How should federal checks treat young buyers and dating partners?",
    holding:
      "Added enhanced checks of juvenile records for buyers under 21, extended the domestic-violence prohibition to some dating relationships, created federal straw-purchase and trafficking offenses, and funded state crisis-intervention programs.",
    builds: ["brady", "gca"],
    href: "https://www.congress.gov/bill/117th-congress/senate-bill/2938",
  },
  {
    id: "cargill",
    date: "2024-06-14",
    kind: "ruling",
    title: "Garland v. Cargill",
    cite: "602 U.S. 406",
    question: "Does the statutory definition of “machinegun” cover a semiautomatic rifle with a bump stock?",
    holding: "No. A bump stock does not make a rifle fire automatically “by a single function of the trigger,” so ATF's rule exceeded the statute.",
    author: "Thomas",
    vote: "6–3",
    builds: ["bumpstock-rule", "nfa"],
    href: docket("22-976"),
  },
  {
    id: "rahimi",
    date: "2024-06-21",
    kind: "ruling",
    title: "United States v. Rahimi",
    cite: "602 U.S. 680",
    question: "May the government disarm a person under a domestic-violence restraining order?",
    holding:
      "Yes. Section 922(g)(8) is constitutional on its face; Bruen requires a regulation to be consistent with the principles of historical tradition, not to have a precise historical twin.",
    author: "Roberts",
    vote: "8–1",
    builds: ["bruen", "vcclea"],
    href: "https://www.supremecourt.gov/opinions/23pdf/22-915_8o6b.pdf",
  },
  {
    id: "vanderstok",
    date: "2025-03-26",
    kind: "ruling",
    title: "Bondi v. VanDerStok",
    cite: "604 U.S. ___ (No. 23-852)",
    question: "Did ATF exceed the Gun Control Act by regulating weapon parts kits?",
    holding: "No, on a facial challenge: the Act's definition of “firearm” can cover some kits and unfinished frames and receivers, so the rule stands.",
    author: "Gorsuch",
    vote: "7–2",
    builds: ["frame-rule", "gca"],
    href: docket("23-852"),
  },
  {
    id: "mexico",
    date: "2025-06-05",
    kind: "ruling",
    title: "Smith & Wesson Brands v. Estados Unidos Mexicanos",
    cite: "605 U.S. ___ (No. 23-1141)",
    question: "May Mexico sue U.S. gun makers over cartel violence?",
    holding:
      "No. Mexico did not plausibly allege that the manufacturers aided and abetted unlawful sales, so the suit is barred by the Protection of Lawful Commerce in Arms Act.",
    author: "Kagan",
    vote: "9–0",
    builds: ["plcaa"],
    href: docket("23-1141"),
  },
  {
    id: "hemani",
    date: "2026-06-18",
    kind: "ruling",
    title: "United States v. Hemani",
    cite: "No. 24-1234",
    question: "May § 922(g)(3) disarm anyone who habitually uses an illegal drug?",
    holding:
      "No. Applying the unlawful-user prohibition to someone solely because they habitually use a controlled substance, without proof of intoxication or dangerousness, violates the Second Amendment.",
    author: "Gorsuch",
    vote: "Opinion for 7; 2 concurred in judgment",
    builds: ["bruen", "rahimi", "gca"],
    href: docket("24-1234"),
  },
  {
    id: "wolford",
    date: "2026-06-25",
    kind: "ruling",
    title: "Wolford v. Lopez",
    cite: "No. 24-1046",
    question: "May a state bar permit holders from carrying on private property open to the public unless the owner consents?",
    holding:
      "No. Hawaii's default rule against carrying on publicly accessible private property without express permission violates the Second and Fourteenth Amendments.",
    author: "Alito",
    vote: "6–3",
    builds: ["bruen"],
    href: docket("24-1046"),
  },
];
