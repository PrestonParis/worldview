import type { IssueModule } from "../types";
import { L, o, when } from "./helpers";

// Social and justice issue modules. Screener options span the full range;
// follow-ups only appear where the screener answer leaves the stance open.

export const societyIssues: IssueModule[] = [
  {
    id: "abortion",
    name: "Abortion",
    screener: {
      id: "abortion.legal",
      attribute: "Legality",
      prompt: "Which comes closest to your view on abortion?",
      options: [
        o("all", "Legal in all cases, at any point in pregnancy", "Legal in all cases", L(["social", -1, 0.6], ["religion", -0.6, 0.3])),
        o("most", "Legal in most cases", "Legal in most cases", L(["social", -0.5, 0.6], ["religion", -0.3, 0.3])),
        o("some", "Legal in some cases, with significant restrictions", "Legal with significant restrictions", L(["social", 0.15, 0.5])),
        o("most-illegal", "Illegal in most cases", "Illegal in most cases", L(["social", 0.6, 0.6], ["religion", 0.5, 0.3])),
        o("all-illegal", "Illegal in all cases, with no exceptions", "Illegal in all cases", L(["social", 1, 0.6], ["religion", 0.9, 0.4])),
      ],
    },
    followUps: [
      {
        id: "abortion.limit",
        attribute: "Gestational limit",
        prompt: "Up to what point in pregnancy should abortion generally be legal?",
        when: when("abortion.legal", "most", "some"),
        options: [
          o("6wk", "Around six weeks", "up to about six weeks", L(["social", 0.5, 0.4])),
          o("15wk", "Around fifteen weeks", "up to about fifteen weeks", L(["social", 0.1, 0.4])),
          o("viability", "Until viability, around 24 weeks", "until viability", L(["social", -0.4, 0.4])),
          o("none", "No fixed limit; it should be up to the woman and her doctor", "with no fixed limit", L(["social", -0.8, 0.4])),
        ],
      },
      {
        id: "abortion.exceptions",
        attribute: "Exceptions",
        prompt: "Select all that apply: where abortion is restricted, which exceptions should be allowed?",
        selection: "multiple",
        when: when("abortion.legal", "most", "some", "most-illegal"),
        options: [
          { ...o("life", "To save the pregnant person's life", "an exception to save the pregnant person's life", L(["social", 0.5, 0.15])), },
          o("health", "To prevent serious harm to the pregnant person's health", "an exception for serious health risks", L(["social", 0.1, 0.15])),
          o("rape", "Pregnancy resulting from rape", "an exception for rape", L(["social", 0.2, 0.15])),
          o("incest", "Pregnancy resulting from incest", "an exception for incest", L(["social", 0.2, 0.15])),
          o("anomaly", "A fatal or severe fetal condition", "an exception for a fatal or severe fetal condition", L(["social", -0.1, 0.15])),
          { ...o("none", "None of these", "no exceptions", L(["social", 1, 0.3])), exclusive: true },
        ],
      },
      {
        id: "abortion.level",
        attribute: "Who decides",
        prompt: "Who should set abortion law?",
        options: [
          o("federal-right", "Congress should guarantee a right to abortion nationwide", "protected nationwide by federal law", L(["federalism", 0.7, 0.4], ["social", -0.6, 0.3])),
          o("states", "Each state should decide", "decided state by state", L(["federalism", -0.8, 0.4])),
          o("federal-limit", "Congress should set a national limit or ban", "restricted nationwide by federal law", L(["federalism", 0.7, 0.4], ["social", 0.7, 0.3])),
        ],
      },
      {
        id: "abortion.pill",
        attribute: "Abortion pills",
        prompt: "Should abortion pills be available by mail with a prescription?",
        when: when("abortion.legal", "most", "some", "most-illegal"),
        options: [
          o("yes", "Yes", "abortion pills available by mail", L(["social", -0.5, 0.3], ["regulation", -0.1, 0.1])),
          o("in-person", "Only after an in-person visit", "abortion pills only after an in-person visit", L(["social", 0.2, 0.3])),
          o("no", "No, they should not be available", "abortion pills banned", L(["social", 0.8, 0.3])),
        ],
      },
      {
        id: "abortion.funding",
        attribute: "Public funding",
        prompt: "Should public programs like Medicaid pay for abortions?",
        when: when("abortion.legal", "all", "most"),
        options: [
          o("yes", "Yes", "with public funding", L(["redistribution", -0.5, 0.2], ["social", -0.7, 0.3])),
          o("no", "No", "without public funding", L(["social", 0, 0.2])),
        ],
      },
    ],
  },
  {
    id: "guns",
    name: "Guns",
    screener: {
      id: "guns.overall",
      attribute: "Overall approach",
      prompt: "How restrictive should gun laws generally be?",
      options: [
        o("ban", "Most civilian gun ownership should be banned", "Ban most civilian guns", L(["regulation", -0.8, 0.4], ["social", -0.6, 0.4], ["liberty", 0.4, 0.2])),
        o("strict", "Much more restrictive", "Strict gun control", L(["regulation", -0.5, 0.4], ["social", -0.4, 0.4])),
        o("moderate", "Somewhat more restrictive", "Moderate new rules", L(["regulation", -0.1, 0.3], ["social", 0, 0.3])),
        o("rights", "Gun ownership is a core right; few new restrictions", "Protect gun rights", L(["regulation", 0.4, 0.4], ["social", 0.5, 0.4])),
        o("minimal", "Nearly all gun restrictions should be repealed", "Repeal nearly all restrictions", L(["regulation", 0.8, 0.4], ["social", 0.7, 0.4], ["liberty", -0.5, 0.2])),
      ],
    },
    followUps: [
      {
        id: "guns.assault",
        attribute: "Assault-style rifles",
        prompt: "Should semi-automatic rifles like the AR-15 be banned for civilians?",
        when: when("guns.overall", "moderate", "rights"),
        options: [
          o("yes", "Yes", "ban AR-15-style rifles", L(["regulation", -0.4, 0.3], ["social", -0.3, 0.3])),
          o("no", "No", "keep AR-15-style rifles legal", L(["regulation", 0.4, 0.3], ["social", 0.4, 0.3])),
        ],
      },
      {
        id: "guns.carry",
        attribute: "Concealed carry",
        prompt: "Should adults be allowed to carry a concealed handgun?",
        when: when("guns.overall", "moderate", "rights", "minimal"),
        options: [
          o("no-permit", "Yes, without a permit", "permitless concealed carry", L(["regulation", 0.8, 0.3], ["social", 0.6, 0.2])),
          o("permit", "Yes, with a permit and training", "concealed carry with a permit", L(["regulation", 0.1, 0.3])),
          o("no", "No, except for law enforcement", "no civilian concealed carry", L(["regulation", -0.6, 0.3])),
        ],
      },
      {
        id: "guns.red-flag",
        attribute: "Red-flag laws",
        prompt: "Should courts be able to temporarily remove guns from someone they find poses a danger to themselves or others?",
        when: when("guns.overall", "strict", "moderate", "rights"),
        options: [
          o("yes", "Yes", "red-flag laws", L(["liberty", 0.4, 0.3], ["regulation", -0.3, 0.2])),
          o("no", "No", "no red-flag laws", L(["liberty", -0.5, 0.3], ["regulation", 0.4, 0.2])),
        ],
      },
      {
        id: "guns.buyback",
        attribute: "Buybacks",
        prompt: "Should owners of banned weapons be required to sell them to the government?",
        when: when("guns.overall", "ban", "strict"),
        options: [
          o("mandatory", "Yes, a mandatory buyback", "mandatory buyback", L(["regulation", -0.9, 0.3], ["liberty", 0.5, 0.2])),
          o("voluntary", "Only a voluntary buyback", "voluntary buyback only", L(["regulation", -0.4, 0.3])),
          o("no", "No, existing owners should keep them", "existing owners keep their guns", L(["regulation", -0.1, 0.3])),
        ],
      },
      {
        id: "guns.age",
        attribute: "Minimum age",
        prompt: "What should the minimum age be to buy any gun?",
        when: when("guns.overall", "moderate", "rights"),
        options: [
          o("18", "18", "buying age of 18", L(["regulation", 0.4, 0.2])),
          o("21", "21", "buying age of 21", L(["regulation", -0.3, 0.2])),
        ],
      },
    ],
  },
  {
    id: "immigration",
    name: "Immigration & border",
    screener: {
      id: "immigration.undocumented",
      attribute: "Undocumented residents",
      prompt: "What should happen to most undocumented immigrants living in the U.S.?",
      options: [
        o("citizenship", "A path to citizenship", "Path to citizenship for the undocumented", L(["immigration", -0.8, 0.6])),
        o("legal-status", "Legal status to stay and work, but not citizenship", "Legal status without citizenship", L(["immigration", -0.3, 0.6])),
        o("case", "Decide case by case: long-time residents stay, recent arrivals leave", "Case-by-case", L(["immigration", 0.2, 0.6])),
        o("deport-most", "Most should be deported", "Deport most", L(["immigration", 0.7, 0.6])),
        o("deport-all", "All should be deported", "Deport all", L(["immigration", 1, 0.6])),
      ],
    },
    followUps: [
      {
        id: "immigration.levels",
        attribute: "Legal immigration level",
        prompt: "How should the number of legal immigrants admitted each year change?",
        options: [
          o("much-more", "Increase a lot", "legal immigration increased a lot", L(["immigration", -0.9, 0.4])),
          o("more", "Increase somewhat", "legal immigration increased somewhat", L(["immigration", -0.4, 0.4])),
          o("same", "Stay about the same", "legal immigration kept steady", L(["immigration", 0, 0.4])),
          o("less", "Decrease somewhat", "legal immigration reduced somewhat", L(["immigration", 0.5, 0.4])),
          o("much-less", "Decrease a lot", "legal immigration reduced a lot", L(["immigration", 0.9, 0.4])),
        ],
      },
      {
        id: "immigration.selection",
        attribute: "Selection priority",
        prompt: "What should legal immigration prioritize?",
        when: when("immigration.undocumented", "citizenship", "legal-status", "case"),
        options: [
          o("family", "Reuniting families", "prioritizing family reunification", L(["immigration", -0.4, 0.2])),
          o("skills", "Skills and education", "prioritizing skills", L(["immigration", 0.2, 0.2])),
          o("humanitarian", "Refugees and people fleeing danger", "prioritizing humanitarian cases", L(["immigration", -0.6, 0.2], ["engagement", -0.3, 0.2])),
        ],
      },
      {
        id: "immigration.wall",
        attribute: "Border wall",
        prompt: "Should there be a physical wall along the entire southern border?",
        when: when("immigration.undocumented", "legal-status", "case", "deport-most"),
        options: [
          o("yes", "Yes", "a border wall", L(["immigration", 0.6, 0.3])),
          o("partial", "Only in some areas, alongside technology", "barriers in some areas", L(["immigration", 0, 0.3])),
          o("no", "No", "no border wall", L(["immigration", -0.6, 0.3])),
        ],
      },
      {
        id: "immigration.dreamers",
        attribute: "Dreamers",
        prompt: "How should the law treat people who were brought to the U.S. illegally as children?",
        when: when("immigration.undocumented", "case", "deport-most", "deport-all"),
        options: [
          o("stay", "They should be allowed to stay permanently", "Dreamers allowed to stay", L(["immigration", -0.2, 0.4])),
          o("leave", "They should be treated like other undocumented immigrants", "Dreamers treated like others", L(["immigration", 0.8, 0.4])),
        ],
      },
      {
        id: "immigration.birthright",
        attribute: "Birthright citizenship",
        prompt: "Should children born in the U.S. to undocumented parents automatically be citizens?",
        when: when("immigration.undocumented", "case", "deport-most", "deport-all"),
        options: [
          o("yes", "Yes", "birthright citizenship kept", L(["immigration", -0.2, 0.3])),
          o("no", "No", "birthright citizenship ended for children of undocumented parents", L(["immigration", 0.8, 0.3])),
        ],
      },
      {
        id: "immigration.asylum",
        attribute: "Asylum",
        prompt: "How should people seeking asylum at the border be handled?",
        when: when("immigration.undocumented", "citizenship", "legal-status", "case"),
        options: [
          o("release", "Allowed in while their claims are decided", "asylum seekers allowed in while claims are heard", L(["immigration", -0.7, 0.3])),
          o("detain", "Held in detention while their claims are decided", "asylum seekers detained while claims are heard", L(["immigration", 0.3, 0.3], ["justice", 0.2, 0.1])),
          o("abroad", "Required to wait outside the U.S.", "asylum seekers wait outside the U.S.", L(["immigration", 0.6, 0.3])),
        ],
      },
      {
        id: "immigration.interior",
        attribute: "Interior enforcement",
        prompt: "How should immigration law be enforced inside the country?",
        options: [
          o("criminals", "Focus only on people who commit serious crimes", "interior enforcement limited to serious criminals", L(["immigration", -0.5, 0.4], ["justice", -0.2, 0.1])),
          o("workplace", "Focus on criminals, plus mandatory workplace verification", "enforcement against criminals plus workplace verification", L(["immigration", 0.3, 0.4])),
          o("broad", "Broad enforcement, including workplace raids and local police cooperation", "broad interior enforcement", L(["immigration", 0.8, 0.4], ["justice", 0.4, 0.2], ["liberty", 0.3, 0.1])),
        ],
      },
      {
        id: "immigration.temp-workers",
        attribute: "Temporary work visas",
        prompt: "Select all that apply: in which sectors should the U.S. admit more temporary workers?",
        selection: "multiple",
        when: when("immigration.undocumented", "citizenship", "legal-status", "case", "deport-most"),
        options: [
          o("agriculture", "Agriculture", "more agricultural work visas", L(["immigration", -0.3, 0.15], ["trade", 0.3, 0.05])),
          o("seasonal", "Seasonal service industries", "more seasonal work visas", L(["immigration", -0.3, 0.15], ["trade", 0.3, 0.05])),
          o("technology", "Technology", "more technology work visas", L(["immigration", -0.3, 0.15], ["trade", 0.3, 0.05])),
          { ...o("no", "None of these", "no expansion of temporary work visas", L(["immigration", 0.5, 0.3])), exclusive: true },
        ],
      },
    ],
  },
  {
    id: "policing",
    name: "Policing",
    screener: {
      id: "policing.direction",
      attribute: "Funding & direction",
      prompt: "How should local police funding change?",
      options: [
        o("abolish", "Police should be abolished and replaced with community services", "Abolish police", L(["justice", -1, 0.6])),
        o("reallocate", "Decrease it substantially", "Substantially decrease police funding", L(["justice", -0.7, 0.6])),
        o("reform", "Decrease it somewhat", "Somewhat decrease police funding", L(["justice", -0.3, 0.6])),
        o("both", "Keep it about the same", "Keep police funding about the same", L(["justice", 0.2, 0.6])),
        o("support", "Increase it", "Increase police funding", L(["justice", 0.8, 0.6])),
      ],
    },
    followUps: [
      {
        id: "policing.tactics",
        attribute: "Tactical restrictions",
        prompt: "Select all that apply: which police tactics should federal law generally prohibit?",
        selection: "multiple",
        when: when("policing.direction", "reallocate", "reform", "both"),
        options: [
          o("chokeholds", "Chokeholds, except when deadly force is legally justified", "federal restrictions on chokeholds", L(["justice", -0.4, 0.2], ["federalism", 0.4, 0.1])),
          o("no-knock", "No-knock warrants, except in narrowly defined emergencies", "federal restrictions on no-knock warrants", L(["justice", -0.4, 0.2], ["federalism", 0.4, 0.1])),
          { ...o("states", "Neither; states and cities should decide", "tactics left to states and cities", L(["federalism", -0.6, 0.3])), exclusive: true },
          { ...o("no", "Neither; these tactics should remain available nationwide", "no federal ban on these tactics", L(["justice", 0.6, 0.3])), exclusive: true },
        ],
      },
      {
        id: "policing.oversight",
        attribute: "Federal oversight",
        prompt: "Should the Justice Department investigate local police departments facing credible allegations of repeated misconduct?",
        when: when("policing.direction", "reform", "both", "support"),
        options: [
          o("yes", "Yes", "federal oversight of local police", L(["justice", -0.4, 0.3], ["federalism", 0.5, 0.2])),
          o("no", "No, that's for states and cities", "no federal oversight of local police", L(["justice", 0.4, 0.3], ["federalism", -0.5, 0.2])),
        ],
      },
      {
        id: "policing.military-gear",
        attribute: "Military equipment",
        prompt: "Should police departments be able to acquire military equipment?",
        when: when("policing.direction", "reallocate", "reform", "both", "support"),
        options: [
          o("yes", "Yes", "police access to military equipment", L(["justice", 0.6, 0.3], ["liberty", 0.4, 0.2])),
          o("no", "No", "no military equipment for police", L(["justice", -0.5, 0.3], ["liberty", -0.4, 0.2])),
        ],
      },
    ],
  },
  {
    id: "death-penalty",
    name: "Death penalty",
    screener: {
      id: "death-penalty.scope",
      attribute: "Scope",
      prompt: "Which comes closest to your view on the death penalty?",
      options: [
        o("abolish", "It should be abolished everywhere", "Abolish the death penalty", L(["justice", -0.7, 0.5])),
        o("rare", "Only for the most extreme crimes, like terrorism or mass murder", "Only for the most extreme crimes", L(["justice", 0.1, 0.5])),
        o("murder", "For the worst murders", "For the worst murders", L(["justice", 0.5, 0.5])),
        o("expand", "It should also apply to crimes like child rape and major drug trafficking", "Expanded to more crimes", L(["justice", 1, 0.5])),
      ],
    },
    followUps: [
      {
        id: "death-penalty.appeals",
        attribute: "Appeals",
        prompt: "Should executions happen faster, with fewer appeals?",
        when: when("death-penalty.scope", "murder", "expand"),
        options: [
          o("yes", "Yes", "faster executions", L(["justice", 0.8, 0.3], ["liberty", 0.3, 0.2])),
          o("no", "No, appeals are important protection", "appeals preserved", L(["justice", 0.2, 0.3])),
        ],
      },
      {
        id: "death-penalty.life",
        attribute: "Life without parole",
        prompt: "Is life in prison without parole an acceptable sentence?",
        when: when("death-penalty.scope", "abolish"),
        options: [
          o("yes", "Yes, for the worst crimes", "life without parole for the worst crimes", L(["justice", -0.3, 0.3])),
          o("no", "No, every prisoner should have a chance at release", "no life-without-parole sentences", L(["justice", -0.9, 0.3])),
        ],
      },
    ],
  },
  {
    id: "drugs",
    name: "Drugs",
    screener: {
      id: "drugs.policy",
      attribute: "Overall policy",
      prompt: "Which comes closest to your view on drug policy?",
      options: [
        o("legalize-all", "All drugs should be legal and regulated, like alcohol", "Legalize all drugs", L(["justice", -0.9, 0.4], ["liberty", -0.6, 0.3], ["social", -0.5, 0.3])),
        o("decriminalize", "Possession of any drug should be treated as a health issue, not a crime", "Decriminalize possession of all drugs", L(["justice", -0.7, 0.4], ["social", -0.4, 0.3])),
        o("marijuana", "Marijuana should be legal; other drugs illegal", "Legal marijuana only", L(["justice", -0.2, 0.4], ["social", -0.2, 0.3])),
        o("medical", "Only medical marijuana should be legal", "Medical marijuana only", L(["justice", 0.3, 0.4], ["social", 0.3, 0.3])),
        o("prohibit", "All of these drugs should stay illegal, with strict enforcement", "Strict prohibition", L(["justice", 0.8, 0.4], ["social", 0.6, 0.3])),
      ],
    },
    followUps: [
      {
        id: "drugs.marijuana-level",
        attribute: "Marijuana jurisdiction",
        prompt: "Who should decide whether marijuana is legal?",
        when: when("drugs.policy", "marijuana", "medical"),
        options: [
          o("federal-legal", "Congress should legalize it nationwide", "marijuana legalized federally", L(["federalism", 0.5, 0.3], ["justice", -0.4, 0.2])),
          o("states", "Each state should decide", "marijuana left to the states", L(["federalism", -0.7, 0.3])),
          o("federal-ban", "It should stay illegal under federal law", "marijuana kept federally illegal", L(["federalism", 0.5, 0.3], ["justice", 0.5, 0.2])),
        ],
      },
      {
        id: "drugs.safe-sites",
        attribute: "Supervised use sites",
        prompt: "Should cities be allowed to open supervised drug-use sites to prevent overdoses?",
        when: when("drugs.policy", "legalize-all", "decriminalize", "marijuana"),
        options: [
          o("yes", "Yes", "supervised use sites allowed", L(["justice", -0.6, 0.3])),
          o("no", "No", "no supervised use sites", L(["justice", 0.4, 0.3])),
        ],
      },
      {
        id: "drugs.psychedelics",
        attribute: "Psychedelic therapy",
        prompt: "Should psychedelics like psilocybin be legal for supervised therapy?",
        when: when("drugs.policy", "marijuana", "medical", "prohibit"),
        options: [
          o("yes", "Yes", "psychedelic therapy legal", L(["technology", 0.3, 0.2], ["social", -0.3, 0.2])),
          o("no", "No", "psychedelics kept illegal", L(["social", 0.5, 0.2])),
        ],
      },
    ],
  },
  {
    id: "lgbtq",
    name: "LGBTQ rights",
    screener: {
      id: "lgbtq.marriage",
      attribute: "Same-sex marriage",
      prompt: "Should same-sex couples have a legal right to marry?",
      options: [
        o("protected", "Yes, protected nationwide", "Same-sex marriage protected nationwide", L(["social", -0.7, 0.5])),
        o("exempt", "Yes, but each state should set the rules", "Same-sex marriage legal under state law", L(["social", -0.1, 0.5], ["federalism", -0.4, 0.2])),
        o("states", "Each state should decide", "Same-sex marriage left to the states", L(["social", 0.5, 0.5], ["federalism", -0.6, 0.3])),
        o("illegal", "It should not be legal", "Same-sex marriage not legal", L(["social", 0.9, 0.5], ["religion", 0.6, 0.3])),
      ],
    },
    followUps: [
      {
        id: "lgbtq.discrimination",
        attribute: "Anti-discrimination law",
        prompt: "Should federal law prohibit employment discrimination based on sexual orientation?",
        options: [
          o("yes", "Yes", "employment protections based on sexual orientation", L(["social", -0.8, 0.3], ["religion", -0.2, 0.1])),
          o("exempt", "Yes, except for religious organizations", "employment protections with an exemption for religious organizations", L(["social", -0.3, 0.3], ["religion", 0.2, 0.2])),
          o("no", "No", "no federal anti-discrimination protections", L(["social", 0.4, 0.3], ["regulation", 0.4, 0.2])),
        ],
      },
      {
        id: "lgbtq.sports",
        attribute: "Transgender athletes",
        prompt: "How should eligibility for transgender athletes in school and college sports be determined?",
        options: [
          o("identity", "Their gender identity", "trans athletes compete by gender identity", L(["social", -0.7, 0.3])),
          o("case", "Case-by-case rules set by each sport", "trans athlete rules set sport by sport", L(["social", -0.1, 0.3])),
          o("sex", "Their sex at birth", "athletes compete by sex at birth", L(["social", 0.5, 0.3])),
        ],
      },
      {
        id: "lgbtq.minors",
        attribute: "Transition care for minors",
        prompt: "Should minors be able to receive puberty blockers or hormones for gender transition?",
        when: when("lgbtq.marriage", "protected", "exempt", "states"),
        options: [
          o("yes", "Yes, with parental consent and medical approval", "gender-transition care for minors with consent", L(["social", -0.7, 0.3])),
          o("states", "States should decide", "minors' gender-transition care left to the states", L(["federalism", -0.6, 0.3])),
          o("no", "No, it should be banned for minors", "gender-transition care banned for minors", L(["social", 0.7, 0.3])),
        ],
      },
      {
        id: "lgbtq.documents",
        attribute: "ID gender markers",
        prompt: "Should passports and IDs offer an \"X\" gender marker?",
        when: when("lgbtq.marriage", "protected", "exempt"),
        options: [
          o("yes", "Yes", "\"X\" marker on IDs", L(["social", -0.8, 0.2])),
          o("no", "No", "no \"X\" marker on IDs", L(["social", 0.3, 0.2])),
        ],
      },
    ],
  },
  {
    id: "affirmative-action",
    name: "Affirmative action",
    screener: {
      id: "affirmative-action.admissions",
      attribute: "College admissions",
      prompt: "How should race factor into college admissions?",
      options: [
        o("targets", "Institutions should set goals to match the population's racial makeup", "Racial representation goals", L(["identity", -0.9, 0.6])),
        o("factor", "Race can be one factor among many", "Race as one factor", L(["identity", -0.5, 0.6])),
        o("class", "Not race, but economic disadvantage should count", "Class-based preferences only", L(["identity", 0.3, 0.6], ["redistribution", -0.2, 0.2])),
        o("never", "Race and economic background should not be considered", "No race- or class-based preferences", L(["identity", 0.8, 0.6])),
      ],
    },
    followUps: [
      {
        id: "affirmative-action.contracts",
        attribute: "Contract set-asides",
        prompt: "Should some government contracts be set aside for minority-owned businesses?",
        when: when("affirmative-action.admissions", "targets", "factor"),
        options: [
          o("yes", "Yes", "minority contracting set-asides", L(["identity", -0.6, 0.3])),
          o("no", "No", "no contracting set-asides", L(["identity", 0.4, 0.3])),
        ],
      },
      {
        id: "affirmative-action.reparations",
        attribute: "Reparations",
        prompt: "Should the federal government provide reparations for slavery?",
        when: when("affirmative-action.admissions", "targets", "factor", "class"),
        options: [
          o("cash", "Yes, including direct payments", "reparations including cash payments", L(["identity", -1, 0.4], ["redistribution", -0.5, 0.2])),
          o("invest", "Yes, through investment in affected communities", "reparations through community investment", L(["identity", -0.6, 0.4])),
          o("no", "No", "no reparations", L(["identity", 0.5, 0.4])),
        ],
      },
      {
        id: "affirmative-action.legacy",
        attribute: "Legacy preferences",
        prompt: "Should colleges give preference to children of alumni or donors?",
        options: [
          o("yes", "Yes, that's their choice", "legacy preferences allowed", L(["regulation", 0.4, 0.2])),
          o("no", "No", "legacy preferences ended", L(["redistribution", -0.2, 0.1])),
        ],
      },
    ],
  },
  {
    id: "education",
    name: "Education & school choice",
    screener: {
      id: "education.choice",
      attribute: "School funding",
      prompt: "Which schools should be eligible for public K–12 funding?",
      options: [
        o("public-only", "Traditional public schools only, without charters", "Traditional public schools only", L(["ownership", -0.7, 0.5])),
        o("charters", "Public schools, including charter schools", "Public and charter schools", L(["ownership", -0.2, 0.5])),
        o("vouchers-low", "Public schools, plus vouchers for low-income families to attend private schools", "Vouchers for low-income families", L(["ownership", 0.3, 0.5])),
        o("universal", "Every family gets public money to spend at any school, public or private", "Universal school choice", L(["ownership", 0.8, 0.5], ["religion", 0.2, 0.1])),
        o("private", "The government should not fund schools; families should pay", "No public school funding", L(["ownership", 1, 0.5], ["redistribution", 0.9, 0.3])),
      ],
    },
    followUps: [
      {
        id: "education.department",
        attribute: "Education Department",
        prompt: "Should the federal Department of Education be abolished?",
        options: [
          o("yes", "Yes, leave education to the states", "abolish the Education Department", L(["federalism", -0.8, 0.4])),
          o("no", "No", "keep the Education Department", L(["federalism", 0.4, 0.4])),
        ],
      },
      {
        id: "education.curriculum",
        attribute: "Curriculum control",
        prompt: "Who should decide how public schools teach about race and racism?",
        when: when("education.choice", "public-only", "charters", "vouchers-low", "universal"),
        options: [
          o("educators", "Teachers and education experts", "curriculum set by educators", L(["social", -0.5, 0.3])),
          o("boards", "Elected school boards, with parents able to opt their kids out", "curriculum set by school boards with opt-outs", L(["social", 0.1, 0.3])),
          o("state-limits", "State law should restrict what can be taught", "state limits on what schools teach", L(["social", 0.7, 0.3])),
        ],
      },
      {
        id: "education.student-debt",
        attribute: "Student debt",
        prompt: "What should happen to federal student loan debt?",
        when: when("education.choice", "public-only", "charters", "vouchers-low"),
        options: [
          o("all", "Cancel all of it", "cancel all student debt", L(["redistribution", -0.9, 0.3])),
          o("some", "Cancel some, for lower-income borrowers", "cancel some student debt", L(["redistribution", -0.4, 0.3])),
          o("none", "Borrowers should repay what they owe", "no student debt cancellation", L(["redistribution", 0.5, 0.3])),
        ],
      },
    ],
  },
  {
    id: "speech",
    name: "Speech & content moderation",
    screener: {
      id: "speech.moderation",
      attribute: "Content moderation",
      prompt: "How should social media companies handle demonstrably false information?",
      options: [
        o("required", "The law should require them to remove that content", "Require platforms to remove harmful content", L(["liberty", 0.6, 0.4], ["regulation", -0.6, 0.3])),
        o("encouraged", "They should remove it on their own, without being required to", "Platforms should moderate voluntarily", L(["liberty", 0.1, 0.4], ["social", -0.3, 0.2])),
        o("hands-off", "They can moderate as they like, and government should stay out of it entirely", "Government stays out of moderation", L(["liberty", -0.4, 0.4], ["regulation", 0.6, 0.3])),
        o("neutral", "Large platforms should be barred from removing legal speech based on viewpoint", "Ban viewpoint moderation by large platforms", L(["liberty", -0.6, 0.4], ["regulation", -0.3, 0.2], ["social", 0.4, 0.2])),
      ],
    },
    followUps: [
      {
        id: "speech.hate-speech",
        attribute: "Hate speech",
        prompt: "Should hate speech be illegal?",
        when: when("speech.moderation", "required", "encouraged"),
        options: [
          o("yes", "Yes", "hate speech outlawed", L(["liberty", 0.8, 0.4], ["social", -0.5, 0.2])),
          o("no", "No, it should stay protected by the First Amendment", "hate speech remains legal", L(["liberty", -0.5, 0.4])),
        ],
      },
      {
        id: "speech.section-230",
        attribute: "Platform liability",
        prompt: "Should platforms be legally liable for what users post?",
        options: [
          o("keep", "No, keep current protections", "platform liability protections kept", L(["regulation", 0.4, 0.2])),
          o("narrow", "Only if they knowingly allow illegal content", "platform protections narrowed", L(["regulation", -0.2, 0.2])),
          o("liable", "Yes, like a publisher", "platforms liable like publishers", L(["regulation", -0.6, 0.2])),
        ],
      },
      {
        id: "speech.flag",
        attribute: "Flag burning",
        prompt: "Should burning the American flag be illegal?",
        options: [
          o("yes", "Yes", "flag burning banned", L(["social", 0.6, 0.3], ["liberty", 0.5, 0.2], ["immigration", 0.3, 0.1])),
          o("no", "No", "flag burning protected as speech", L(["liberty", -0.5, 0.3], ["social", -0.2, 0.1])),
        ],
      },
      {
        id: "speech.foreign-apps",
        attribute: "Foreign-owned apps",
        prompt: "Should the government be able to ban apps owned by companies in hostile countries, like TikTok?",
        options: [
          o("yes", "Yes", "foreign-adversary apps can be banned", L(["liberty", 0.5, 0.3], ["engagement", 0.3, 0.1])),
          o("no", "No", "no bans on foreign-owned apps", L(["liberty", -0.5, 0.3])),
        ],
      },
    ],
  },
  {
    id: "religious-liberty",
    name: "Religious liberty",
    screener: {
      id: "religious-liberty.vendors",
      attribute: "Service refusals",
      prompt: "Should a wedding vendor be able to refuse to provide services for a same-sex wedding for religious reasons?",
      options: [
        o("no", "No, that's discrimination", "Religious belief doesn't excuse refusing service", L(["religion", -0.6, 0.5], ["social", -0.5, 0.3])),
        o("expressive", "Only for custom, expressive work like a designed cake or photography", "Exemptions for expressive work only", L(["religion", 0.2, 0.5])),
        o("yes", "Yes, for any service", "Broad religious exemptions", L(["religion", 0.7, 0.5], ["social", 0.5, 0.3])),
      ],
    },
    followUps: [
      {
        id: "religious-liberty.vaccines",
        attribute: "Vaccine exemptions",
        prompt: "Should vaccine requirements include religious exemptions?",
        options: [
          o("yes", "Yes", "religious vaccine exemptions", L(["religion", 0.5, 0.3], ["liberty", -0.3, 0.2])),
          o("no", "No", "no religious vaccine exemptions", L(["religion", -0.5, 0.3], ["liberty", 0.3, 0.2])),
        ],
      },
      {
        id: "religious-liberty.contraception",
        attribute: "Contraception coverage",
        prompt: "Should employers with religious objections be able to exclude contraceptive coverage from employee health plans?",
        when: when("religious-liberty.vendors", "expressive", "yes"),
        options: [
          o("yes", "Yes", "employers may exclude contraception", L(["religion", 0.7, 0.3])),
          o("no", "No", "contraception coverage required", L(["religion", -0.2, 0.3])),
        ],
      },
      {
        id: "religious-liberty.churches-politics",
        attribute: "Church endorsements",
        prompt: "Should tax-exempt churches be allowed to endorse political candidates?",
        options: [
          o("yes", "Yes", "churches may endorse candidates", L(["religion", 0.7, 0.3])),
          o("no", "No", "churches barred from endorsing", L(["religion", -0.4, 0.3])),
        ],
      },
    ],
  },
];
