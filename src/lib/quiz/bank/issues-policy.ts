import type { IssueModule } from "../types";
import { L, o, when } from "./helpers";

// Economic, governance, tech, and foreign-policy issue modules.

export const policyIssues: IssueModule[] = [
  {
    id: "healthcare",
    name: "Health care",
    screener: {
      id: "healthcare.system",
      attribute: "System",
      prompt: "Who should provide most Americans' primary health insurance?",
      options: [
        o("single-payer", "Single-payer: one government plan covers everyone", "Single-payer", L(["ownership", -0.8, 0.5], ["redistribution", -0.7, 0.4])),
        o("public-option", "Private insurance plus a government plan anyone can buy into", "Public option", L(["ownership", -0.3, 0.5], ["redistribution", -0.4, 0.4])),
        o("regulated", "Private insurers operating under strong federal rules", "Regulated private insurance", L(["regulation", -0.4, 0.4])),
        o("market", "Private insurers operating under limited federal rules", "Market-based private insurance", L(["regulation", 0.5, 0.4])),
        o("private", "Fully private; the government should not be involved in health care", "Fully private health care", L(["ownership", 1, 0.5], ["redistribution", 0.9, 0.4])),
      ],
    },
    followUps: [
      {
        id: "healthcare.private-insurance",
        attribute: "Private insurance",
        prompt: "Under single-payer, should private insurance still be allowed?",
        when: when("healthcare.system", "single-payer"),
        options: [
          o("supplemental", "Yes, as optional extra coverage", "private supplemental insurance allowed", L(["ownership", -0.6, 0.3])),
          o("no", "No", "private insurance eliminated", L(["ownership", -1, 0.3])),
        ],
      },
      {
        id: "healthcare.drug-prices",
        attribute: "Drug prices",
        prompt: "What should the government do about prescription drug prices?",
        when: when("healthcare.system", "single-payer", "public-option", "regulated", "market"),
        options: [
          o("cap", "Cap prices for all drugs", "price caps on all drugs", L(["regulation", -0.8, 0.3])),
          o("negotiate", "Let Medicare negotiate prices for some drugs", "Medicare drug price negotiation", L(["regulation", -0.3, 0.3])),
          o("market", "Leave prices to the market and speed up generic approvals", "market drug pricing", L(["regulation", 0.6, 0.3])),
        ],
      },
      {
        id: "healthcare.preexisting",
        attribute: "Pre-existing conditions",
        prompt: "Should insurers be required to cover pre-existing conditions without charging more because of a person's health history?",
        when: when("healthcare.system", "market", "private"),
        options: [
          o("yes", "Yes", "pre-existing conditions covered", L(["regulation", -0.3, 0.3])),
          o("pools", "No, but government should fund high-risk pools", "high-risk pools for pre-existing conditions", L(["regulation", 0.4, 0.3], ["redistribution", 0.2, 0.2])),
          o("no", "No", "no pre-existing condition mandate", L(["regulation", 0.9, 0.3])),
        ],
      },
      {
        id: "healthcare.medicaid",
        attribute: "Medicaid eligibility",
        prompt: "Should Medicaid cover all low-income adults?",
        when: when("healthcare.system", "public-option", "regulated", "market"),
        options: [
          o("yes", "Yes, nationwide", "Medicaid for all low-income adults", L(["redistribution", -0.5, 0.3], ["federalism", 0.4, 0.2])),
          o("states", "States should decide", "Medicaid eligibility left to states", L(["federalism", -0.6, 0.3])),
          o("no", "No, it should be limited to children, the disabled, and the elderly", "Medicaid limited to the most vulnerable", L(["redistribution", 0.6, 0.3])),
        ],
      },
      {
        id: "healthcare.undocumented",
        attribute: "Coverage for undocumented immigrants",
        prompt: "Should undocumented immigrants be covered by government health programs?",
        when: when("healthcare.system", "single-payer", "public-option"),
        options: [
          o("yes", "Yes", "coverage for undocumented immigrants", L(["immigration", -0.7, 0.3])),
          o("emergency", "Emergency care only", "emergency care only for undocumented immigrants", L(["immigration", 0.2, 0.3])),
        ],
      },
    ],
  },
  {
    id: "taxes",
    name: "Taxes",
    screener: {
      id: "taxes.top-rate",
      attribute: "Top income tax rate",
      prompt: "What should the top federal income tax rate be?",
      options: [
        o("70", "70% or higher", "Top rate of 70%+", L(["redistribution", -0.9, 0.5])),
        o("50", "Around 50%", "Top rate around 50%", L(["redistribution", -0.5, 0.5])),
        o("40", "Around 40%", "Top rate around 40%", L(["redistribution", -0.1, 0.5])),
        o("30", "Around 30%", "Top rate around 30%", L(["redistribution", 0.4, 0.5])),
        o("flat", "One flat rate for everyone, around 15–20%", "Flat tax", L(["redistribution", 0.7, 0.5])),
        o("none", "There should be no federal income tax", "No income tax", L(["redistribution", 1, 0.5], ["ownership", 0.6, 0.2])),
      ],
    },
    followUps: [
      {
        id: "taxes.wealth",
        attribute: "Wealth tax",
        prompt: "Should there be an annual tax on fortunes above $50 million?",
        when: when("taxes.top-rate", "70", "50", "40"),
        options: [
          o("yes", "Yes", "a wealth tax", L(["redistribution", -0.8, 0.3])),
          o("no", "No", "no wealth tax", L(["redistribution", 0, 0.3])),
        ],
      },
      {
        id: "taxes.corporate",
        attribute: "Corporate tax rate",
        prompt: "What should the federal corporate tax rate be?",
        options: [
          o("35", "35% or higher", "corporate rate of 35%+", L(["redistribution", -0.7, 0.3], ["regulation", -0.4, 0.2])),
          o("28", "Around 28%", "corporate rate around 28%", L(["redistribution", -0.3, 0.3])),
          o("21", "Around 21%", "corporate rate around 21%", L(["redistribution", 0.2, 0.3])),
          o("15", "15% or lower", "corporate rate of 15% or lower", L(["redistribution", 0.6, 0.3])),
          o("0", "Zero", "no corporate income tax", L(["redistribution", 0.9, 0.3])),
        ],
      },
      {
        id: "taxes.child-credit",
        attribute: "Child tax credit",
        prompt: "Should families receive a child tax credit even if they have no income?",
        when: when("taxes.top-rate", "50", "40", "30", "flat"),
        options: [
          o("yes", "Yes", "fully refundable child tax credit", L(["redistribution", -0.6, 0.3])),
          o("working", "Only working families", "child tax credit for working families", L(["redistribution", 0.3, 0.3])),
          o("no", "There should be no child tax credit", "no child tax credit", L(["redistribution", 0.8, 0.3], ["social", -0.2, 0.1])),
        ],
      },
      {
        id: "taxes.estate",
        attribute: "Estate tax",
        prompt: "Should large inheritances be taxed?",
        when: when("taxes.top-rate", "40", "30", "flat", "none"),
        options: [
          o("yes", "Yes, estates above a few million dollars", "estate tax on large inheritances", L(["redistribution", -0.3, 0.3])),
          o("no", "No", "no estate tax", L(["redistribution", 0.6, 0.3])),
        ],
      },
    ],
  },
  {
    id: "labor",
    name: "Labor & minimum wage",
    screener: {
      id: "labor.minimum-wage",
      attribute: "Minimum wage",
      prompt: "What should the federal minimum wage be?",
      options: [
        o("20", "$20 or more", "Minimum wage of $20+", L(["regulation", -0.9, 0.5], ["redistribution", -0.6, 0.3])),
        o("15", "Around $15", "Minimum wage around $15", L(["regulation", -0.5, 0.5], ["redistribution", -0.3, 0.3])),
        o("12", "Around $12", "Minimum wage around $12", L(["regulation", -0.1, 0.5])),
        o("7", "$7.25, the level since 2009", "Minimum wage of $7.25", L(["regulation", 0.4, 0.5])),
        o("none", "There should be no federal minimum wage", "No federal minimum wage", L(["regulation", 0.9, 0.5], ["federalism", -0.4, 0.2])),
      ],
    },
    followUps: [
      {
        id: "labor.unions",
        attribute: "Unions",
        prompt: "Which comes closest to your view of labor unions?",
        options: [
          o("strengthen", "Essential; laws should make organizing easier", "unions strengthened", L(["regulation", -0.7, 0.4])),
          o("voluntary", "Useful, but membership and dues should always be voluntary", "voluntary union membership", L(["regulation", 0.3, 0.4])),
          o("harmful", "Mostly harmful to the economy", "unions viewed as harmful", L(["regulation", 0.8, 0.4])),
        ],
      },
      {
        id: "labor.gig",
        attribute: "Gig workers",
        prompt: "Should gig workers, like rideshare drivers, be classified as employees with benefits?",
        when: when("labor.minimum-wage", "20", "15", "12"),
        options: [
          o("yes", "Yes", "gig workers as employees", L(["regulation", -0.6, 0.3])),
          o("no", "No, they should stay independent contractors", "gig workers as contractors", L(["regulation", 0.4, 0.3])),
        ],
      },
      {
        id: "labor.paid-leave",
        attribute: "Paid leave",
        prompt: "How should paid family leave work?",
        when: when("labor.minimum-wage", "20", "15", "12", "7"),
        options: [
          o("federal", "A national paid leave program for all workers", "national paid leave program", L(["redistribution", -0.6, 0.3], ["federalism", 0.4, 0.1])),
          o("mandate", "Employers should be required to provide it", "employer paid-leave mandate", L(["regulation", -0.5, 0.3])),
          o("voluntary", "Left to employers and workers", "paid leave left to employers", L(["regulation", 0.6, 0.3], ["redistribution", 0.5, 0.2])),
        ],
      },
    ],
  },
  {
    id: "entitlements",
    name: "Social Security & Medicare",
    screener: {
      id: "entitlements.solvency",
      attribute: "Social Security solvency",
      prompt: "What should be the primary approach to Social Security's long-term shortfall?",
      options: [
        o("expand", "Increase revenue enough to expand benefits", "Increase revenue and expand Social Security", L(["redistribution", -0.8, 0.5])),
        o("taxes", "Increase revenue enough to preserve scheduled benefits", "Increase revenue to preserve Social Security", L(["redistribution", -0.4, 0.5])),
        o("mix", "A mix of tax increases and benefit changes", "Mix of taxes and benefit changes", L(["redistribution", 0, 0.5])),
        o("cut", "Reduce the growth of future benefits", "Slow future benefit growth", L(["redistribution", 0.6, 0.5])),
        o("private", "Let workers move their contributions into private accounts", "Private retirement accounts", L(["redistribution", 0.8, 0.5], ["ownership", 0.8, 0.4])),
      ],
    },
    followUps: [
      {
        id: "entitlements.medicare-age",
        attribute: "Medicare age",
        prompt: "Should the Medicare eligibility age be lowered to 60?",
        when: when("entitlements.solvency", "expand", "taxes", "mix"),
        options: [
          o("yes", "Yes", "Medicare at 60", L(["redistribution", -0.6, 0.3], ["ownership", -0.3, 0.2])),
          o("no", "No", "Medicare age kept at 65", L(["redistribution", 0.2, 0.3])),
        ],
      },
      {
        id: "entitlements.means-test",
        attribute: "Means testing",
        prompt: "Should wealthy retirees receive reduced Social Security benefits?",
        when: when("entitlements.solvency", "mix", "cut", "private"),
        options: [
          o("yes", "Yes", "means-tested benefits", L(["redistribution", -0.2, 0.2])),
          o("no", "No, everyone paid in and should get what they earned", "full benefits regardless of wealth", L(["redistribution", 0.3, 0.2])),
        ],
      },
      {
        id: "entitlements.retirement-age",
        attribute: "Retirement age",
        prompt: "Should the full retirement age rise to 70?",
        when: when("entitlements.solvency", "mix", "cut"),
        options: [
          o("yes", "Yes", "retirement age of 70", L(["redistribution", 0.6, 0.3])),
          o("no", "No", "retirement age kept below 70", L(["redistribution", -0.1, 0.3])),
        ],
      },
    ],
  },
  {
    id: "climate",
    name: "Climate & energy",
    screener: {
      id: "climate.approach",
      attribute: "Overall approach",
      prompt: "How urgent is climate change as a national policy problem?",
      options: [
        o("emergency", "An emergency requiring immediate action", "Climate change is an emergency", L(["environment", -0.9, 0.5])),
        o("major", "A serious problem requiring action soon", "Climate change is a serious problem", L(["environment", -0.5, 0.5])),
        o("innovation", "A real but manageable long-term problem", "Climate change is a manageable problem", L(["environment", 0.3, 0.5])),
        o("all", "A minor concern", "Climate change is a minor concern", L(["environment", 0.6, 0.5])),
        o("not-real", "Not a problem that warrants government action", "Climate change does not warrant government action", L(["environment", 0.9, 0.5])),
      ],
    },
    followUps: [
      {
        id: "climate.carbon-tax",
        attribute: "Carbon tax",
        prompt: "Should there be a tax on carbon emissions, with the money returned to households?",
        when: when("climate.approach", "major", "innovation"),
        options: [
          o("yes", "Yes", "carbon tax with dividend", L(["environment", -0.4, 0.3])),
          o("no", "No", "no carbon tax", L(["environment", 0.4, 0.3], ["redistribution", 0.3, 0.1])),
        ],
      },
      {
        id: "climate.nuclear",
        attribute: "Nuclear power",
        prompt: "Should the U.S. build many more nuclear power plants?",
        when: when("climate.approach", "emergency", "major", "innovation", "all"),
        options: [
          o("yes", "Yes", "more nuclear power", L(["technology", 0.5, 0.3])),
          o("no", "No", "no new nuclear power", L(["technology", -0.7, 0.3])),
        ],
      },
      {
        id: "climate.cars",
        attribute: "Gas-car phase-out",
        prompt: "Should sales of new gas-powered cars be phased out by 2035?",
        when: when("climate.approach", "emergency", "major", "innovation"),
        options: [
          o("yes", "Yes", "phase out new gas cars by 2035", L(["environment", -0.6, 0.3], ["regulation", -0.6, 0.2])),
          o("no", "No", "no gas-car phase-out", L(["environment", 0.2, 0.3], ["regulation", 0.4, 0.2])),
        ],
      },
      {
        id: "climate.paris",
        attribute: "Paris agreement",
        prompt: "Should the U.S. be part of the Paris climate agreement?",
        when: when("climate.approach", "major", "innovation", "all"),
        options: [
          o("yes", "Yes", "in the Paris agreement", L(["engagement", -0.5, 0.3], ["environment", -0.3, 0.2])),
          o("no", "No", "out of the Paris agreement", L(["engagement", 0.6, 0.3], ["environment", 0.4, 0.2])),
        ],
      },
    ],
  },
  {
    id: "housing",
    name: "Housing & zoning",
    screener: {
      id: "housing.approach",
      attribute: "Affordability approach",
      prompt: "Which approach should do the most to make housing more affordable?",
      options: [
        o("public", "Build more public housing", "Build more public housing", L(["ownership", -0.7, 0.4])),
        o("subsidy", "Give renters more financial assistance", "Increase rental assistance", L(["redistribution", -0.4, 0.4])),
        o("zoning", "Allow substantially more private housing to be built", "Allow more private housing construction", L(["regulation", 0.5, 0.4], ["environment", 0.3, 0.3])),
        o("market", "Leave it to the market", "Leave housing to the market", L(["regulation", 0.8, 0.4], ["redistribution", 0.6, 0.3])),
        o("character", "Prioritize preserving the character of existing neighborhoods", "Preserve neighborhood character", L(["social", 0.4, 0.3], ["regulation", -0.2, 0.2], ["federalism", -0.5, 0.2])),
      ],
    },
    followUps: [
      {
        id: "housing.rent-control",
        attribute: "Rent control",
        prompt: "Should cities be able to cap rent increases?",
        when: when("housing.approach", "subsidy", "zoning", "character"),
        options: [
          o("yes", "Yes", "rent control allowed", L(["regulation", -0.6, 0.3])),
          o("no", "No", "no rent control", L(["regulation", 0.6, 0.3])),
        ],
      },
      {
        id: "housing.single-family",
        attribute: "Single-family zoning",
        prompt: "Should apartments be allowed in neighborhoods zoned only for single-family homes?",
        when: when("housing.approach", "public", "subsidy", "zoning", "market"),
        options: [
          o("yes", "Yes", "end single-family-only zoning", L(["regulation", 0.3, 0.3], ["environment", 0.2, 0.2])),
          o("no", "No", "keep single-family zoning", L(["social", 0.3, 0.3], ["regulation", -0.2, 0.2])),
        ],
      },
      {
        id: "housing.federal-role",
        attribute: "Federal role",
        prompt: "Should the federal government pressure cities to allow more housing?",
        when: when("housing.approach", "zoning", "market", "character"),
        options: [
          o("yes", "Yes", "federal pressure on local zoning", L(["federalism", 0.6, 0.3])),
          o("no", "No, zoning is a local decision", "zoning left to localities", L(["federalism", -0.7, 0.3])),
        ],
      },
    ],
  },
  {
    id: "debt",
    name: "Federal debt",
    screener: {
      id: "debt.priority",
      attribute: "Debt approach",
      prompt: "How should the federal government handle the national debt?",
      options: [
        o("not-concern", "It is not a serious concern; spend what the country needs", "Debt is not a priority", L(["redistribution", -0.5, 0.4])),
        o("tax-wealthy", "Reduce it mainly by raising taxes on the wealthy and corporations", "Raise taxes on the wealthy to cut debt", L(["redistribution", -0.6, 0.4])),
        o("balanced", "Reduce it with a mix of spending cuts and tax increases", "Mix of cuts and taxes", L(["redistribution", 0, 0.4])),
        o("cuts", "Reduce it with spending cuts only, no new taxes", "Spending cuts only", L(["redistribution", 0.7, 0.4])),
        o("amendment", "Require a balanced budget every year by constitutional amendment", "Balanced budget amendment", L(["redistribution", 0.8, 0.4], ["executive", -0.2, 0.1])),
      ],
    },
    followUps: [
      {
        id: "debt.cut-first",
        attribute: "First cuts",
        prompt: "What should be cut first?",
        when: when("debt.priority", "balanced", "cuts", "amendment"),
        options: [
          o("defense", "Defense", "cut defense first", L(["force", 0.6, 0.3])),
          o("social", "Social programs", "cut social programs first", L(["redistribution", 0.7, 0.3])),
          o("aid", "Foreign aid", "cut foreign aid first", L(["engagement", 0.6, 0.3])),
          o("all", "Everything equally", "cut across the board", L(["redistribution", 0.4, 0.2])),
        ],
      },
    ],
  },
  {
    id: "tariffs",
    name: "Trade & tariffs",
    screener: {
      id: "tariffs.level",
      attribute: "Tariff level",
      prompt: "Which comes closest to your view on tariffs?",
      options: [
        o("high", "High tariffs on most imported goods", "High tariffs on most imports", L(["trade", -0.9, 0.5])),
        o("targeted", "Targeted tariffs on strategic goods and unfair trading partners", "Targeted tariffs", L(["trade", -0.3, 0.5])),
        o("low", "Low tariffs; mostly free trade", "Low tariffs", L(["trade", 0.5, 0.5])),
        o("none", "No tariffs at all", "No tariffs", L(["trade", 1, 0.5])),
      ],
    },
    followUps: [
      {
        id: "tariffs.authority",
        attribute: "Tariff authority",
        prompt: "Who should have the authority to impose tariffs?",
        when: when("tariffs.level", "high", "targeted", "low"),
        options: [
          o("president", "The president, acting alone", "tariffs set by the president", L(["executive", 0.7, 0.4])),
          o("congress", "Only Congress", "tariffs set by Congress", L(["executive", -0.6, 0.4])),
        ],
      },
      {
        id: "tariffs.displaced",
        attribute: "Displaced workers",
        prompt: "Should the government help workers who lose jobs to foreign competition?",
        when: when("tariffs.level", "low", "none"),
        options: [
          o("yes", "Yes, with retraining and income support", "help for displaced workers", L(["redistribution", -0.4, 0.3])),
          o("no", "No", "no special help for displaced workers", L(["redistribution", 0.6, 0.3])),
        ],
      },
    ],
  },
  {
    id: "ai",
    name: "AI & tech regulation",
    screener: {
      id: "ai.governance",
      attribute: "Frontier AI",
      prompt: "How should the most powerful AI systems be governed?",
      options: [
        o("pause", "Pause their development until they're proven safe", "Pause frontier AI", L(["technology", -1, 0.5], ["regulation", -0.7, 0.3])),
        o("license", "Require government licensing and safety testing before release", "License frontier AI", L(["technology", -0.5, 0.5], ["regulation", -0.5, 0.3])),
        o("targeted", "Rules only for specific harms, like fraud or deepfakes", "Targeted AI rules", L(["technology", 0.2, 0.5], ["regulation", 0.1, 0.3])),
        o("minimal", "Use minimal regulation", "Minimal AI regulation", L(["technology", 0.8, 0.5], ["regulation", 0.7, 0.3])),
      ],
    },
    followUps: [
      {
        id: "ai.jobs",
        attribute: "Job displacement",
        prompt: "If AI displaces many jobs, what should the government do?",
        options: [
          o("income", "Provide a guaranteed basic income", "basic income if AI displaces jobs", L(["redistribution", -0.8, 0.3])),
          o("retrain", "Fund retraining and transition help", "retraining for displaced workers", L(["redistribution", -0.2, 0.3])),
          o("market", "Let the market adjust", "let the labor market adjust", L(["redistribution", 0.7, 0.3])),
        ],
      },
      {
        id: "ai.states",
        attribute: "State AI laws",
        prompt: "Should states be able to pass their own AI laws?",
        when: when("ai.governance", "license", "targeted", "minimal"),
        options: [
          o("yes", "Yes", "state AI laws allowed", L(["federalism", -0.6, 0.3])),
          o("no", "No, there should be one national standard", "one national AI standard", L(["federalism", 0.6, 0.3])),
        ],
      },
    ],
  },
  {
    id: "voting-rules",
    name: "Voting rules",
    screener: {
      id: "voting-rules.access",
      attribute: "Ballot access",
      prompt: "Select all that apply: which voting rules should states adopt?",
      selection: "multiple",
      options: [
        o("max-access", "Automatic voter registration", "automatic voter registration", L(["voting", -0.7, 0.2])),
        o("access", "Same-day voter registration", "same-day voter registration", L(["voting", -0.6, 0.2])),
        o("mail", "No-excuse voting by mail", "no-excuse mail voting", L(["voting", -0.5, 0.2])),
        o("balanced", "Photo ID, with an acceptable ID provided free", "free voter photo ID", L(["voting", 0.2, 0.2])),
        o("signature", "Signature verification for mail ballots", "mail-ballot signature verification", L(["voting", 0.3, 0.2])),
        o("strict", "In-person voting unless a voter documents a need for an absentee ballot", "in-person voting by default", L(["voting", 0.8, 0.2])),
        { ...o("none", "None of these", "none of the listed voting rules"), exclusive: true },
      ],
    },
    followUps: [
      {
        id: "voting-rules.ranked-choice",
        attribute: "Ranked-choice voting",
        prompt: "Should elections use ranked-choice voting?",
        options: [
          o("yes", "Yes", "ranked-choice voting", L(["voting", -0.3, 0.2])),
          o("no", "No", "no ranked-choice voting", L(["voting", 0.3, 0.2])),
        ],
      },
      {
        id: "voting-rules.dc",
        attribute: "D.C. statehood",
        prompt: "Should Washington, D.C. become a state?",
        options: [
          o("yes", "Yes", "D.C. statehood", L(["voting", -0.6, 0.3])),
          o("no", "No", "no D.C. statehood", L(["voting", 0.5, 0.3])),
        ],
      },
      {
        id: "voting-rules.term-limits",
        attribute: "Congressional term limits",
        prompt: "Should members of Congress have term limits?",
        options: [
          o("yes", "Yes", "congressional term limits"),
          o("no", "No", "no congressional term limits"),
        ],
      },
    ],
  },
  {
    id: "judiciary",
    name: "Supreme Court & judiciary",
    screener: {
      id: "judiciary.court",
      attribute: "Court structure",
      prompt: "What should happen to the Supreme Court?",
      options: [
        o("expand", "Add more justices", "Expand the Supreme Court", L(["voting", -0.6, 0.3], ["executive", 0.2, 0.2])),
        o("term-limits", "Keep nine justices, but with 18-year term limits", "Term limits for justices", L(["voting", -0.3, 0.3])),
        o("keep", "Keep nine justices with lifetime appointments", "Keep nine justices for life", L(["voting", 0.4, 0.3])),
      ],
    },
    followUps: [
      {
        id: "judiciary.interpretation",
        attribute: "Constitutional interpretation",
        prompt: "How should judges interpret the Constitution?",
        options: [
          o("original", "By its original meaning when written", "originalist interpretation", L(["social", 0.5, 0.3], ["executive", -0.1, 0.1])),
          o("living", "As a living document that adapts to modern values", "living-constitution interpretation", L(["social", -0.5, 0.3])),
        ],
      },
      {
        id: "judiciary.ethics",
        attribute: "Ethics code",
        prompt: "Should Supreme Court justices be bound by an enforceable ethics code?",
        options: [
          o("yes", "Yes", "binding ethics code for justices", L(["executive", -0.3, 0.2])),
          o("no", "No, that would undermine judicial independence", "no external ethics code for justices", L(["voting", 0.3, 0.2])),
        ],
      },
    ],
  },
  {
    id: "israel",
    name: "Israel & Gaza",
    screener: {
      id: "israel.support",
      attribute: "U.S. support",
      prompt: "What should U.S. policy toward Israel be?",
      options: [
        o("strong", "Strong support, including military aid without conditions", "Unconditional support for Israel", L(["force", -0.6, 0.4], ["religion", 0.3, 0.1])),
        o("conditional", "Support, but with conditions on how military aid is used", "Conditional support for Israel", L(["force", -0.1, 0.4])),
        o("neutral", "Even-handed between Israel and the Palestinians", "Even-handed policy", L(["force", 0.3, 0.4])),
        o("end-aid", "End military aid to Israel", "End military aid to Israel", L(["force", 0.7, 0.4])),
      ],
    },
    followUps: [
      {
        id: "israel.solution",
        attribute: "Long-term outcome",
        prompt: "What long-term outcome should the U.S. support?",
        options: [
          o("two-state", "Two states, Israel and Palestine", "a two-state solution"),
          o("israel", "Israeli sovereignty over the territories", "Israeli sovereignty over the territories", L(["religion", 0.4, 0.2])),
          o("one-state", "One democratic state with equal rights for all", "a single democratic state", L(["identity", -0.3, 0.1])),
          o("none", "It's not America's place to decide", "no U.S. position on the outcome", L(["engagement", 0.6, 0.3])),
        ],
      },
      {
        id: "israel.boycotts",
        attribute: "Anti-boycott laws",
        prompt: "Should states be able to refuse contracts with companies that boycott Israel?",
        when: when("israel.support", "strong", "conditional", "neutral"),
        options: [
          o("yes", "Yes", "anti-boycott laws", L(["liberty", 0.3, 0.2])),
          o("no", "No, boycotts are protected speech", "boycotts protected", L(["liberty", -0.5, 0.2])),
        ],
      },
    ],
  },
  {
    id: "ukraine",
    name: "Ukraine & Russia",
    screener: {
      id: "ukraine.aid",
      attribute: "U.S. support",
      prompt: "How should the U.S. support Ukraine against Russia?",
      options: [
        o("full", "Whatever it takes, including the most advanced weapons", "Full support for Ukraine", L(["force", -0.8, 0.4], ["engagement", -0.7, 0.4])),
        o("continue", "Continued military and economic aid", "Continued aid to Ukraine", L(["force", -0.4, 0.4], ["engagement", -0.4, 0.4])),
        o("negotiate", "Limit aid and push both sides to a negotiated settlement", "Push for a settlement", L(["force", 0.4, 0.4], ["engagement", 0.3, 0.4])),
        o("end", "End all aid", "End aid to Ukraine", L(["force", 0.8, 0.4], ["engagement", 0.8, 0.4])),
      ],
    },
    followUps: [
      {
        id: "ukraine.nato",
        attribute: "NATO membership",
        prompt: "Should the U.S. support Ukraine joining NATO?",
        when: when("ukraine.aid", "full", "continue"),
        options: [
          o("yes", "Yes", "Ukraine in NATO", L(["engagement", -0.7, 0.3], ["force", -0.4, 0.2])),
          o("no", "No", "Ukraine outside NATO", L(["engagement", 0.2, 0.3])),
        ],
      },
      {
        id: "ukraine.territory",
        attribute: "Territorial concessions",
        prompt: "Should Ukraine give up territory to end the war?",
        when: when("ukraine.aid", "negotiate", "end"),
        options: [
          o("yes", "Yes, if that's what peace requires", "territorial concessions for peace", L(["force", 0.6, 0.3])),
          o("no", "No", "no territorial concessions", L(["force", -0.3, 0.3])),
        ],
      },
    ],
  },
  {
    id: "china",
    name: "China",
    screener: {
      id: "china.stance",
      attribute: "Overall stance",
      prompt: "How should the U.S. manage its economic relationship with China?",
      options: [
        o("rival", "Broadly reduce trade and investment ties", "Broadly reduce economic ties with China", L(["trade", -0.7, 0.5])),
        o("competitor", "Restrict strategic sectors while allowing other trade", "Restrict strategic trade with China", L(["trade", -0.1, 0.5], ["engagement", -0.2, 0.2])),
        o("partner", "Keep trade broadly open", "Keep trade with China broadly open", L(["trade", 0.7, 0.5])),
      ],
    },
    followUps: [
      {
        id: "china.decouple",
        attribute: "Economic ties",
        prompt: "Should the U.S. cut economic ties with China?",
        when: when("china.stance", "rival", "competitor"),
        options: [
          o("broad", "Broadly, across most industries", "broad decoupling from China", L(["trade", -0.9, 0.3])),
          o("strategic", "Only in strategic sectors like chips and defense", "decoupling in strategic sectors", L(["trade", -0.2, 0.3])),
          o("no", "No", "no decoupling", L(["trade", 0.6, 0.3])),
        ],
      },
      {
        id: "china.human-rights",
        attribute: "Human rights",
        prompt: "Should human rights concerns shape U.S. policy toward China?",
        options: [
          o("central", "Yes, they should be central", "human rights central to China policy", L(["engagement", -0.6, 0.3], ["force", -0.3, 0.1])),
          o("secondary", "Somewhat, but interests come first", "human rights secondary to interests", L(["engagement", 0.1, 0.3])),
          o("no", "No, that's China's business", "human rights left out of China policy", L(["engagement", 0.7, 0.3])),
        ],
      },
    ],
  },
];
