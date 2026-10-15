import type { IssueModule } from "../types";
import { item, L, noneOfThese, o, when } from "./helpers";

// Social and justice issue modules. Screener options span the full range;
// follow-ups only appear where the screener answer leaves the stance open.
// Independent yes/no policies are grouped into one checklist per module.

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
          { ...o("life", "To save the woman's life", "an exception to save the woman's life", L(["social", 0.5, 0.15])), },
          o("health", "To prevent serious harm to the woman's health", "an exception for serious health risks", L(["social", 0.1, 0.15])),
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
        id: "abortion.access",
        attribute: "Pills & public funding",
        prompt: "Select all you support: which of these should be allowed?",
        selection: "checklist",
        when: when("abortion.legal", "all", "most", "some"),
        options: [
          item("pill", "Abortion pills prescribed by telehealth and sent by mail", "abortion pills by mail", L(["social", -0.5, 0.3]), "no abortion pills by mail", L(["social", 0.3, 0.3])),
          item("funding", "Medicaid and other public programs paying for abortions", "public funding for abortion", L(["social", -0.7, 0.3], ["redistribution", -0.5, 0.2]), "no public funding for abortion", L(["social", -0.1, 0.3], ["redistribution", 0.2, 0.2])),
          noneOfThese,
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
        id: "guns.laws",
        attribute: "Gun laws",
        prompt: "Select all you support: which of these gun laws should apply nationwide?",
        selection: "checklist",
        options: [
          item("background", "Background checks on all gun sales, including private sales", "universal background checks", L(["regulation", -0.2, 0.3]), "no universal background checks", L(["regulation", 0.7, 0.3])),
          item("red-flag", "Courts temporarily removing guns from someone found to be a danger to themselves or others", "red-flag laws", L(["liberty", 0.4, 0.3], ["regulation", -0.3, 0.2]), "no red-flag laws", L(["liberty", -0.5, 0.3], ["regulation", 0.4, 0.2])),
          item("age", "A minimum age of 21 to buy any gun", "buying age of 21", L(["regulation", -0.3, 0.2]), "buying age of 18", L(["regulation", 0.4, 0.2])),
          item("carry-permit", "A permit and training to carry a concealed handgun", "concealed carry only with a permit", L(["regulation", -0.2, 0.3], ["social", -0.1, 0.2]), "permitless concealed carry", L(["regulation", 0.8, 0.3], ["social", 0.6, 0.2])),
          item("assault", "A ban on AR-15-style semi-automatic rifles", "ban AR-15-style rifles", L(["regulation", -0.4, 0.3], ["social", -0.3, 0.3]), "keep AR-15-style rifles legal", L(["regulation", 0.4, 0.3], ["social", 0.4, 0.3])),
          item("buyback", "A mandatory government buyback of banned weapons", "mandatory buyback", L(["regulation", -0.9, 0.3], ["liberty", 0.5, 0.2]), "no mandatory buyback", L(["regulation", -0.2, 0.3], ["liberty", -0.1, 0.2])),
          noneOfThese,
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
        id: "immigration.enforcement",
        attribute: "Enforcement & status",
        prompt: "Select all you support: which of these immigration policies should the U.S. adopt?",
        selection: "checklist",
        options: [
          item("dreamers", "Letting people brought here illegally as children stay permanently", "Dreamers allowed to stay", L(["immigration", -0.2, 0.4]), "Dreamers treated like other undocumented immigrants", L(["immigration", 0.8, 0.4])),
          item("e-verify", "Requiring every employer to verify new hires' immigration status", "mandatory workplace verification", L(["immigration", 0.3, 0.3]), "no mandatory workplace verification", L(["immigration", -0.5, 0.3])),
          item("wall", "A physical wall along the entire southern border", "a border wall", L(["immigration", 0.6, 0.3]), "no wall along the entire border", L(["immigration", -0.3, 0.3])),
          item("asylum-abroad", "Requiring asylum seekers to wait outside the U.S. while their claims are decided", "asylum seekers wait outside the U.S.", L(["immigration", 0.6, 0.3]), "asylum seekers wait inside the U.S.", L(["immigration", -0.4, 0.3])),
          item("birthright", "Ending automatic citizenship for children born here to undocumented parents", "birthright citizenship ended for children of undocumented parents", L(["immigration", 0.8, 0.3]), "birthright citizenship kept", L(["immigration", -0.2, 0.3])),
          item("raids", "Workplace raids and local police helping with immigration arrests", "broad interior enforcement", L(["immigration", 0.8, 0.4], ["justice", 0.4, 0.2], ["liberty", 0.3, 0.1]), "no workplace raids or local police enforcement", L(["immigration", -0.2, 0.4], ["justice", -0.1, 0.2], ["liberty", -0.1, 0.1])),
          noneOfThese,
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
        id: "policing.reforms",
        attribute: "Tactics & oversight",
        prompt: "Select all you support: which of these policing policies should the U.S. adopt?",
        selection: "checklist",
        when: when("policing.direction", "reallocate", "reform", "both", "support"),
        options: [
          item("chokeholds", "A federal ban on chokeholds, except when deadly force is legally justified", "federal restrictions on chokeholds", L(["justice", -0.4, 0.2], ["federalism", 0.4, 0.1]), "no federal ban on chokeholds", L(["justice", 0.4, 0.2], ["federalism", -0.3, 0.1])),
          item("no-knock", "A federal ban on no-knock warrants, except in narrowly defined emergencies", "federal restrictions on no-knock warrants", L(["justice", -0.4, 0.2], ["federalism", 0.4, 0.1]), "no federal ban on no-knock warrants", L(["justice", 0.4, 0.2], ["federalism", -0.3, 0.1])),
          item("oversight", "Justice Department investigations of local police departments with repeated misconduct", "federal oversight of local police", L(["justice", -0.4, 0.3], ["federalism", 0.5, 0.2]), "no federal oversight of local police", L(["justice", 0.4, 0.3], ["federalism", -0.5, 0.2])),
          item("military-gear", "Letting police departments acquire military equipment", "police access to military equipment", L(["justice", 0.6, 0.3], ["liberty", 0.4, 0.2]), "no military equipment for police", L(["justice", -0.5, 0.3], ["liberty", -0.4, 0.2])),
          noneOfThese,
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
        o("prohibit", "All drugs, including marijuana, should stay illegal, with strict enforcement", "Strict prohibition", L(["justice", 0.8, 0.4], ["social", 0.6, 0.3])),
      ],
    },
    followUps: [
      {
        id: "drugs.policies",
        attribute: "Marijuana, harm reduction & therapy",
        prompt: "Select all you support: which of these drug policies should the U.S. adopt?",
        selection: "checklist",
        options: [
          item("federal-marijuana", "Legalizing marijuana under federal law", "marijuana legalized federally", L(["justice", -0.4, 0.3]), "marijuana kept federally illegal", L(["justice", 0.3, 0.3])),
          item("safe-sites", "Letting cities open supervised drug-use sites to prevent overdoses", "supervised use sites allowed", L(["justice", -0.6, 0.3]), "no supervised use sites", L(["justice", 0.4, 0.3])),
          item("psychedelics", "Legal psilocybin and other psychedelics for supervised therapy", "psychedelic therapy legal", L(["social", -0.3, 0.2], ["technology", 0.3, 0.2]), "psychedelics kept illegal", L(["social", 0.5, 0.2], ["technology", -0.2, 0.2])),
          noneOfThese,
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
        id: "lgbtq.policies",
        attribute: "Discrimination, sports, care & IDs",
        prompt: "Select all you support: which of these should the law allow or require?",
        selection: "checklist",
        options: [
          item("discrimination", "A federal ban on job discrimination based on sexual orientation or gender identity", "federal employment protections", L(["social", -0.6, 0.3]), "no federal anti-discrimination protections", L(["social", 0.5, 0.3])),
          item("sports", "Transgender athletes competing on school and college teams that match their gender identity", "trans athletes compete by gender identity", L(["social", -0.7, 0.3]), "athletes compete by sex at birth", L(["social", 0.2, 0.3])),
          item("minors", "Puberty blockers or hormones for minors, with parental consent and medical approval", "gender-transition care for minors with consent", L(["social", -0.7, 0.3]), "gender-transition care banned for minors", L(["social", 0.4, 0.3])),
          item("x-marker", "An \"X\" gender marker on passports and IDs", "\"X\" marker on IDs", L(["social", -0.8, 0.2]), "no \"X\" marker on IDs", L(["social", 0, 0.2])),
          noneOfThese,
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
        id: "affirmative-action.policies",
        attribute: "Set-asides, reparations & legacies",
        prompt: "Select all you support: which of these policies should the U.S. adopt?",
        selection: "checklist",
        options: [
          item("contracts", "Setting aside some government contracts for minority-owned businesses", "minority contracting set-asides", L(["identity", -0.6, 0.3]), "no contracting set-asides", L(["identity", 0.4, 0.3])),
          item("reparations-invest", "Reparations for slavery through investment in affected communities", "reparations through community investment", L(["identity", -0.6, 0.4]), "no reparations through community investment", L(["identity", 0.4, 0.4])),
          item("reparations-cash", "Reparations for slavery that include direct payments", "reparations including cash payments", L(["identity", -1, 0.4], ["redistribution", -0.5, 0.2]), "no cash reparations", L(["identity", -0.2, 0.4], ["redistribution", 0, 0.2])),
          item("legacy", "College admissions preferences for children of alumni or donors", "legacy preferences allowed", L(["regulation", 0.4, 0.2]), "legacy preferences ended", L(["regulation", -0.1, 0.2])),
          noneOfThese,
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
      prompt: "Where should public money for K–12 schooling go?",
      options: [
        o("public-only", "Only to traditional public schools run by local districts", "Traditional public schools only", L(["ownership", -0.7, 0.5])),
        o("charters", "To public schools, including charter schools", "Public and charter schools", L(["ownership", -0.2, 0.5])),
        o("vouchers-low", "To public and charter schools, plus private-school vouchers for low-income families", "Vouchers for low-income families", L(["ownership", 0.3, 0.5])),
        o("universal", "To any school a family chooses, public or private", "Universal school choice", L(["ownership", 0.8, 0.5], ["religion", 0.2, 0.1])),
        o("private", "Nowhere; families should pay for schooling themselves", "No public school funding", L(["ownership", 1, 0.5], ["redistribution", 0.9, 0.3])),
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
        id: "speech.limits",
        attribute: "Speech limits & platform liability",
        prompt: "Select all you support: which of these should the law allow or require?",
        selection: "checklist",
        options: [
          item("hate-speech", "Making hate speech illegal", "hate speech outlawed", L(["liberty", 0.8, 0.4], ["social", -0.5, 0.2]), "hate speech protected by the First Amendment", L(["liberty", -0.4, 0.4], ["social", 0.1, 0.2])),
          item("flag", "Making it illegal to burn the American flag", "flag burning banned", L(["social", 0.6, 0.3], ["liberty", 0.5, 0.2]), "flag burning protected as speech", L(["social", -0.2, 0.3], ["liberty", -0.5, 0.2])),
          item("foreign-apps", "Letting the government ban apps owned by companies in hostile countries, like TikTok", "foreign-adversary apps can be banned", L(["liberty", 0.5, 0.3]), "no bans on foreign-owned apps", L(["liberty", -0.5, 0.3])),
          item("liability", "Making platforms legally liable for what users post, like publishers", "platforms liable like publishers", L(["regulation", -0.5, 0.2]), "platform liability protections kept", L(["regulation", 0.3, 0.2])),
          noneOfThese,
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
        id: "religious-liberty.exemptions",
        attribute: "Exemptions & church politics",
        prompt: "Select all you support: which of these should the law allow?",
        selection: "checklist",
        options: [
          item("vaccines", "Religious exemptions from vaccine requirements", "religious vaccine exemptions", L(["religion", 0.5, 0.3], ["liberty", -0.3, 0.2]), "no religious vaccine exemptions", L(["religion", -0.5, 0.3], ["liberty", 0.3, 0.2])),
          item("contraception", "Employers with religious objections leaving contraception out of employee health plans", "employers may exclude contraception", L(["religion", 0.7, 0.3]), "contraception coverage required", L(["religion", -0.2, 0.3])),
          item("endorsements", "Tax-exempt churches endorsing political candidates", "churches may endorse candidates", L(["religion", 0.7, 0.3]), "churches barred from endorsing", L(["religion", -0.4, 0.3])),
          noneOfThese,
        ],
      },
    ],
  },
  {
    id: "religion-law",
    name: "Religion & law",
    foundation: true,
    screener: {
      id: "religion-law.tradition",
      attribute: "Tradition in law",
      prompt: "Which religious tradition, if any, should shape the country's laws?",
      options: [
        o("none", "None. Laws should be secular", "secular law", L(["religion", -0.6, 0.4]), { tradition: "none" }),
        o("pluralist", "No single one. All faiths should have equal standing", "no favored tradition", L(["religion", -0.1, 0.4]), { tradition: "pluralist" }),
        o("christian", "Christianity, without preferring one church", "Christian", L(["religion", 0.6, 0.4]), { tradition: "christian" }),
        o("catholic", "Catholic Christianity", "Catholic", L(["religion", 0.6, 0.4]), { tradition: "catholic" }),
        o("protestant", "Protestant or evangelical Christianity", "Protestant", L(["religion", 0.6, 0.4]), { tradition: "protestant" }),
        o("orthodox", "Orthodox Christianity", "Orthodox Christian", L(["religion", 0.6, 0.4]), { tradition: "orthodox" }),
        o("sunni", "Sunni Islam", "Sunni Islam", L(["religion", 0.6, 0.4]), { tradition: "sunni" }),
        o("shia", "Shia Islam", "Shia Islam", L(["religion", 0.6, 0.4]), { tradition: "shia" }),
        o("jewish", "Judaism", "Jewish", L(["religion", 0.6, 0.4]), { tradition: "jewish" }),
        o("hindu", "Hinduism", "Hindu", L(["religion", 0.6, 0.4]), { tradition: "hindu" }),
        o("buddhist", "Buddhism", "Buddhist", L(["religion", 0.6, 0.4]), { tradition: "buddhist" }),
        o("sikh", "Sikhism", "Sikh", L(["religion", 0.6, 0.4]), { tradition: "sikh" }),
        o("other", "Another tradition", "another tradition", L(["religion", 0.6, 0.4]), { tradition: "other" }),
      ],
    },
    followUps: [
      {
        id: "religion-law.state-role",
        attribute: "Religion and the state",
        prompt: "What should the state's relationship to religion be?",
        options: [
          o("discourage", "Actively discourage religion", "state discourages religion", L(["religion", -1, 0.5])),
          o("separate", "Keep religion entirely out of public institutions", "strict separation", L(["religion", -0.6, 0.5])),
          o("neutral", "Stay neutral, while accommodating religious practice", "neutral, accommodating state", L(["religion", 0, 0.5])),
          o("favor", "Favor one tradition while tolerating others", "one favored tradition", L(["religion", 0.6, 0.5])),
          o("enforce", "Enforce one tradition's religious law", "religious law enforced", L(["religion", 1, 0.5], ["democracy", 0.4, 0.2])),
        ],
      },
      {
        id: "religion-law.scope",
        attribute: "Reach of religious law",
        prompt: "How far should religious law reach?",
        when: when("religion-law.tradition", "christian", "catholic", "protestant", "orthodox", "sunni", "shia", "jewish", "hindu", "buddhist", "sikh", "other"),
        options: [
          o("inspire", "It should inspire laws, but not be enforced as law", "religion inspires law", L(["religion", 0.3, 0.5])),
          o("family", "It should govern family matters like marriage and inheritance", "religious family law", L(["religion", 0.6, 0.5])),
          o("civil", "It should govern civil and family law", "religious civil law", L(["religion", 0.8, 0.5])),
          o("all", "It should govern all law, including criminal punishment", "religious law in full", L(["religion", 1, 0.5], ["justice", 0.7, 0.2])),
        ],
      },
      {
        id: "religion-law.interpret",
        attribute: "Who interprets",
        prompt: "Who should decide how religious principles apply to the law?",
        when: when("religion-law.scope", "family", "civil", "all"),
        options: [
          o("elected", "Elected lawmakers", "elected lawmakers interpret", L(["democracy", -0.6, 0.4])),
          o("scholars", "Religious scholars or clergy", "clergy interpret", L(["democracy", 0.6, 0.4], ["religion", 0.9, 0.2])),
          o("supreme", "A single supreme religious leader", "a supreme religious leader", L(["democracy", 0.9, 0.4], ["religion", 1, 0.2])),
        ],
      },
      {
        id: "religion-law.church",
        attribute: "Church and state",
        prompt: "Should the state defer to the Church on matters of faith and morals?",
        when: when("religion-law.tradition", "catholic"),
        options: [
          o("yes", "Yes", "state defers to the Church", L(["religion", 1, 0.4], ["democracy", 0.4, 0.2])),
          o("no", "No", "Church and state independent", L(["religion", 0.3, 0.4])),
        ],
      },
      {
        id: "religion-law.biblical",
        attribute: "Biblical civil law",
        prompt: "Should civil law enforce the moral laws of the Bible, including their penalties?",
        when: when("religion-law.tradition", "protestant", "christian"),
        options: [
          o("yes", "Yes, including the penalties", "biblical law with its penalties", L(["religion", 1, 0.4], ["justice", 0.8, 0.2])),
          o("some", "Some moral laws, but not the penalties", "some biblical moral law", L(["religion", 0.6, 0.4])),
          o("no", "No", "biblical law not enforced", L(["religion", 0.2, 0.4])),
        ],
      },
      {
        id: "religion-law.sharia-penalties",
        attribute: "Sharia penalties",
        prompt: "Should Sharia criminal penalties, such as hudud punishments, be enforced?",
        when: when("religion-law.tradition", "sunni", "shia"),
        options: [
          o("yes", "Yes", "hudud penalties enforced", L(["religion", 1, 0.4], ["justice", 0.9, 0.2])),
          o("no", "No", "no hudud penalties", L(["religion", 0.4, 0.4])),
        ],
      },
      {
        id: "religion-law.land",
        attribute: "Religious claim to the land",
        prompt: "Should the religious claim to the Land of Israel guide the state's borders and settlement policy?",
        when: when("religion-law.tradition", "jewish"),
        options: [
          o("yes", "Yes", "borders guided by religious claim", L(["religion", 0.9, 0.4], ["force", -0.5, 0.2])),
          o("no", "No", "borders not set by religious claim", L(["religion", 0.3, 0.4])),
        ],
      },
      {
        id: "religion-law.majority-faith",
        attribute: "Majority faith and identity",
        prompt: "Should the state protect the majority faith as part of the national identity?",
        when: when("religion-law.tradition", "hindu", "buddhist", "sikh", "orthodox", "other"),
        options: [
          o("yes", "Yes", "state protects the majority faith", L(["religion", 0.8, 0.4], ["immigration", 0.5, 0.2])),
          o("no", "No", "no protected majority faith", L(["religion", 0.3, 0.4])),
        ],
      },
    ],
  },
  {
    id: "regime",
    name: "Political system",
    foundation: true,
    // Split in two so most people see four options: the form of government
    // first, and only those who reject elected government are asked who
    // should rule instead. The authority lens is set by whichever answers.
    screener: {
      id: "regime.authority",
      attribute: "Form of government",
      prompt: "How should the country be governed?",
      options: [
        o("elected", "As a representative democracy: elected officials make the laws", "representative democracy", L(["democracy", -0.7, 0.5]), { authority: "elected" }),
        o("assemblies", "As a direct democracy: citizens decide in local assemblies", "direct democracy", L(["democracy", -0.8, 0.5], ["federalism", -0.6, 0.2]), { authority: "assemblies" }),
        o("unelected", "By a ruler or ruling group that doesn't answer to voters", "unelected rule", L(["democracy", 0.75, 0.5])),
        o("no-state", "It shouldn't be. There should be no state", "no state", L(["democracy", -0.4, 0.5], ["federalism", -1, 0.2]), { authority: "no-state" }),
      ],
    },
    followUps: [
      {
        id: "regime.ruler",
        attribute: "Who rules",
        prompt: "Who should rule?",
        when: when("regime.authority", "unelected"),
        options: [
          o("party", "A single ruling party", "one-party rule", L(["democracy", 0.8, 0.4]), { authority: "party" }),
          o("leader", "A strong national leader", "a strong leader", L(["democracy", 0.85, 0.4], ["executive", 0.8, 0.2]), { authority: "leader" }),
          o("monarch", "A hereditary monarch", "a hereditary monarch", L(["democracy", 0.8, 0.4]), { authority: "monarch" }),
          o("clergy", "Religious leaders, or religious law itself", "religious authority", L(["democracy", 0.7, 0.4], ["religion", 0.9, 0.2]), { authority: "clergy" }),
          o("experts", "Experts and qualified administrators", "rule by experts", L(["democracy", 0.4, 0.4]), { authority: "experts" }),
          o("military", "The military", "military rule", L(["democracy", 0.9, 0.4]), { authority: "military" }),
          o("owners", "Property owners, the way shareholders run a company", "rule by owners", L(["democracy", 0.6, 0.4], ["ownership", 0.8, 0.2]), { authority: "owners" }),
        ],
      },
      {
        id: "regime.nation",
        attribute: "Nation defined by",
        prompt: "What should define who belongs to the nation?",
        options: [
          o("civic", "Citizenship and shared laws, whatever one's background", "civic nation", L(["immigration", -0.4, 0.3]), { nation: "civic" }),
          o("ethnic", "Shared ancestry or ethnicity", "ethnic nation", L(["immigration", 0.9, 0.3]), { nation: "ethnic" }),
          o("religious", "A shared religion", "religious nation", L(["religion", 0.7, 0.3], ["immigration", 0.5, 0.2]), { nation: "religious" }),
          o("civilizational", "A shared culture and way of life", "cultural nation", L(["immigration", 0.5, 0.3]), { nation: "civilizational" }),
          o("class", "Nations matter less than class; working people everywhere share one cause", "class over nation", L(["engagement", -0.5, 0.3], ["immigration", -0.6, 0.2]), { nation: "class" }),
        ],
      },
      {
        id: "regime.change",
        attribute: "How change should come",
        prompt: "How should fundamental political change be achieved?",
        options: [
          o("reform", "Through elections and the courts", "change through elections", L(["democracy", -0.6, 0.3])),
          o("movement", "Through mass protest and civil disobedience", "change through mass protest", L(["democracy", -0.3, 0.3], ["justice", -0.3, 0.2])),
          o("revolution", "Through revolution, by force if necessary", "revolution", L(["democracy", 0.4, 0.3], ["justice", -0.4, 0.2])),
          o("strongman", "By a strong leader taking power", "a leader seizing power", L(["democracy", 0.9, 0.3], ["executive", 0.8, 0.2])),
          o("parallel", "By building alternatives outside the state", "alternatives outside the state", L(["federalism", -0.6, 0.3], ["democracy", -0.2, 0.2])),
        ],
      },
    ],
  },
];
