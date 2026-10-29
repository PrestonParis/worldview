export type EvidenceSource = {
  id: string;
  label: string;
  publisher: string;
  href: string;
  accessed: string;
};

export type GestationObservation = {
  startWeek: number;
  endWeek: number;
  title: string;
  short?: string; // fits a narrow segment on the timeline
  detail: string;
  source: string;
};

// Obstetric trimesters on the LMP axis.
export const TRIMESTERS = [
  { label: "1st trimester", startWeek: 0, endWeek: 13 },
  { label: "2nd trimester", startWeek: 14, endWeek: 27 },
  { label: "3rd trimester", startWeek: 28, endWeek: 40 },
] as const;

export const GESTATION_SOURCES: EvidenceSource[] = [
  {
    id: "acog-development",
    label: "How Your Fetus Grows During Pregnancy",
    publisher: "American College of Obstetricians and Gynecologists",
    href: "https://www.acog.org/womens-health/faqs/how-your-fetus-grows-during-pregnancy",
    accessed: "2026-10-28",
  },
  {
    id: "cdc-surveillance-2022",
    label: "Abortion Surveillance — United States, 2022",
    publisher: "Centers for Disease Control and Prevention",
    href: "https://www.cdc.gov/mmwr/volumes/73/ss/ss7307a1.htm",
    accessed: "2026-10-28",
  },
  {
    id: "fda-mifepristone",
    label: "Mifepristone through ten weeks gestation",
    publisher: "U.S. Food and Drug Administration",
    href: "https://www.fda.gov/drugs/postmarket-drug-safety-information-patients-and-providers/questions-and-answers-mifepristone-medical-termination-pregnancy-through-ten-weeks-gestation",
    accessed: "2026-10-28",
  },
];

// Broad published ranges from ACOG's month-by-month guidance.
export const DEVELOPMENT_MILESTONES: GestationObservation[] = [
  {
    startWeek: 0,
    endWeek: 1,
    title: "Gestational clock begins",
    short: "LMP",
    detail: "Obstetric gestational age starts at the first day of the last menstrual period, about two weeks before fertilization in a typical cycle.",
    source: "acog-development",
  },
  {
    startWeek: 2,
    endWeek: 4,
    title: "Fertilization and implantation",
    short: "Fertilization",
    detail: "Fertilization generally occurs near gestational week 2. The fertilized egg divides, travels to the uterus, and implantation begins.",
    source: "acog-development",
  },
  {
    startWeek: 5,
    endWeek: 8,
    title: "Early embryonic development",
    short: "Embryo",
    detail: "Major structures begin forming during the second month; the neural tube develops and limb buds appear.",
    source: "acog-development",
  },
  {
    startWeek: 9,
    endWeek: 12,
    title: "Fetal period begins",
    short: "Fetus",
    detail: "After the embryonic period, growth and maturation continue; fingers and toes become more distinct.",
    source: "acog-development",
  },
  {
    startWeek: 13,
    endWeek: 16,
    title: "Coordinated movement develops",
    short: "Movement",
    detail: "Growth accelerates and coordinated movement develops, although when movement is felt varies.",
    source: "acog-development",
  },
  {
    startWeek: 17,
    endWeek: 24,
    title: "Continued growth and organ maturation",
    short: "Organ growth",
    detail: "Movement commonly becomes noticeable during this span. Lungs and other organ systems continue developing.",
    source: "acog-development",
  },
  {
    startWeek: 25,
    endWeek: 32,
    title: "Third-trimester maturation",
    short: "Maturation",
    detail: "The fetus gains weight while the brain, lungs, and nervous system continue to mature.",
    source: "acog-development",
  },
  {
    startWeek: 33,
    endWeek: 40,
    title: "Late pregnancy",
    short: "Term",
    detail: "Growth and organ maturation continue toward term; a normal pregnancy is dated to about 40 weeks from LMP.",
    source: "acog-development",
  },
];

export const MEDICAL_CONTEXT: GestationObservation[] = [
  {
    startWeek: 0,
    endWeek: 10,
    title: "FDA-approved medication regimen",
    detail: "Mifepristone with misoprostol is FDA-approved to end an intrauterine pregnancy through 70 days gestation.",
    source: "fda-mifepristone",
  },
  {
    startWeek: 11,
    endWeek: 40,
    title: "Method mix changes with gestation",
    detail: "In CDC reporting areas, procedural abortion accounted for the larger share of abortions after 10 weeks.",
    source: "cdc-surveillance-2022",
  },
];

export const FEDERAL_POLICY_HISTORY = [
  { date: "1973-01-22", title: "Roe v. Wade", detail: "The Supreme Court recognized a federal constitutional abortion right." },
  { date: "1976-09-30", title: "Hyde Amendment", detail: "Congress restricted federal funding for most abortions through an appropriations rider." },
  { date: "1992-06-29", title: "Planned Parenthood v. Casey", detail: "The Supreme Court retained constitutional protection before viability and adopted the undue-burden test." },
  { date: "2000-09-28", title: "FDA approves mifepristone", detail: "FDA approved Mifeprex for medication abortion." },
  { date: "2022-06-24", title: "Dobbs v. Jackson Women's Health Organization", detail: "The Supreme Court overruled Roe and Casey, returning primary regulatory authority to elected governments." },
] as const;

