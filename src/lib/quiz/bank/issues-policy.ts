import type { Condition, IssueModule } from "../types";
import { item, L, noneOfThese, o, when } from "./helpers";

// Economic, governance, tech, and foreign-policy issue modules.
// Independent yes/no policies are grouped into one checklist per module.

// Foundation answers that rule out a module's premise. Someone who wants
// private enterprise abolished isn't asked to tune tax brackets or the
// minimum wage; someone who rejects elections isn't asked about mail ballots.
const communist: Condition = when("economic-system.system", "communism");
const noState: Condition = when("regime.authority", "no-state");
const undemocratic: Condition = when("regime.authority", "unelected");

export const policyIssues: IssueModule[] = [
  {
    id: "economic-system",
    name: "Economic system",
    foundation: true,
    screener: {
      id: "economic-system.system",
      attribute: "Economic system",
      prompt: "Which economic system comes closest to the one you want?",
      options: [
        o("communism", "Communism: private ownership of business abolished, with production planned in common", "Communism", L(["ownership", -1, 0.5], ["regulation", -0.9, 0.4], ["redistribution", -1, 0.4])),
        o("socialism", "Socialism: major industries owned by the public or by their workers", "Socialism", L(["ownership", -0.7, 0.5], ["regulation", -0.6, 0.4], ["redistribution", -0.8, 0.4])),
        o("social-democracy", "Capitalism with a large welfare state, strong unions, and tight regulation", "Social democracy", L(["ownership", -0.3, 0.5], ["regulation", -0.6, 0.4], ["redistribution", -0.7, 0.4])),
        o("state-directed", "Private enterprise steered by the state toward national goals", "State-directed capitalism", L(["ownership", -0.2, 0.5], ["regulation", -0.5, 0.4], ["redistribution", -0.2, 0.4])),
        o("mixed", "A market economy with moderate regulation and a basic safety net", "Mixed market economy", L(["ownership", 0.2, 0.5], ["regulation", 0, 0.4], ["redistribution", 0, 0.4])),
        o("free-market", "Free-market capitalism with low taxes and light regulation", "Free-market capitalism", L(["ownership", 0.6, 0.5], ["regulation", 0.6, 0.4], ["redistribution", 0.6, 0.4])),
        o("laissez-faire", "Laissez-faire: the market decides nearly everything, and government does little beyond protecting property", "Laissez-faire capitalism", L(["ownership", 0.9, 0.5], ["regulation", 0.95, 0.4], ["redistribution", 0.95, 0.4])),
      ],
    },
    followUps: [],
  },
  {
    id: "healthcare",
    name: "Health care",
    unless: communist,
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
          o("no", "No", "no government coverage for undocumented immigrants", L(["immigration", 0.7, 0.3])),
        ],
      },
    ],
  },
  {
    id: "taxes",
    name: "Taxes",
    unless: { any: [communist, noState] },
    screener: {
      id: "taxes.top-rate",
      attribute: "Top income tax rate",
      prompt: "What should the top federal income tax rate be?",
      options: [
        o("70", "70% or higher", "Top rate of 70%+", L(["redistribution", -0.9, 0.5])),
        o("50", "Around 50%", "Top rate around 50%", L(["redistribution", -0.5, 0.5])),
        o("40", "Around 40%", "Top rate around 40%", L(["redistribution", -0.2, 0.5])),
        o("37", "Around 37%, the current top rate", "Top rate kept around 37%", L(["redistribution", 0.1, 0.5])),
        o("30", "Around 30%", "Top rate around 30%", L(["redistribution", 0.4, 0.5])),
        o("flat", "One flat rate for everyone, around 15–20%", "Flat tax", L(["redistribution", 0.7, 0.5])),
        o("none", "There should be no federal income tax", "No income tax", L(["redistribution", 1, 0.5], ["ownership", 0.6, 0.2])),
      ],
    },
    followUps: [
      {
        id: "taxes.corporate",
        attribute: "Corporate tax rate",
        prompt: "What should the federal corporate tax rate be?",
        options: [
          o("35", "35% or higher", "corporate rate of 35%+", L(["redistribution", -0.7, 0.3], ["regulation", -0.4, 0.2])),
          o("28", "Around 28%", "corporate rate around 28%", L(["redistribution", -0.3, 0.3])),
          o("21", "Around 21%, the current rate", "corporate rate kept around 21%", L(["redistribution", 0.2, 0.3])),
          o("15", "15% or lower", "corporate rate of 15% or lower", L(["redistribution", 0.6, 0.3])),
          o("0", "Zero", "no corporate income tax", L(["redistribution", 0.9, 0.3])),
        ],
      },
      {
        id: "taxes.policies",
        attribute: "Wealth, inheritance & child credits",
        prompt: "Select all you support: which of these taxes and credits should the U.S. have?",
        selection: "checklist",
        options: [
          item("wealth", "An annual tax on fortunes above $50 million", "a wealth tax", L(["redistribution", -0.8, 0.3]), "no wealth tax", L(["redistribution", 0, 0.3])),
          item("estate", "A tax on inheritances above a few million dollars", "estate tax on large inheritances", L(["redistribution", -0.3, 0.3]), "no estate tax", L(["redistribution", 0.6, 0.3])),
          item("child-credit", "A child tax credit paid even to families with no income", "fully refundable child tax credit", L(["redistribution", -0.6, 0.3]), "child tax credit limited to working families or none", L(["redistribution", 0.4, 0.3])),
          noneOfThese,
        ],
      },
    ],
  },
  {
    id: "labor",
    name: "Labor & minimum wage",
    unless: communist,
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
        id: "labor.benefits",
        attribute: "Gig work & paid leave",
        prompt: "Select all you support: which of these labor policies should the U.S. adopt?",
        selection: "checklist",
        options: [
          item("gig", "Classifying gig workers, like rideshare drivers, as employees with benefits", "gig workers as employees", L(["regulation", -0.6, 0.3]), "gig workers as contractors", L(["regulation", 0.4, 0.3])),
          item("leave-program", "A national paid family leave program for all workers", "national paid leave program", L(["redistribution", -0.6, 0.3], ["federalism", 0.4, 0.1]), "no national paid leave program", L(["redistribution", 0.4, 0.3], ["federalism", -0.2, 0.1])),
          item("leave-mandate", "Requiring employers to provide paid family leave", "employer paid-leave mandate", L(["regulation", -0.5, 0.3]), "paid leave left to employers", L(["regulation", 0.5, 0.3])),
          noneOfThese,
        ],
      },
    ],
  },
  {
    id: "entitlements",
    name: "Social Security & Medicare",
    unless: { any: [communist, noState] },
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
        id: "entitlements.changes",
        attribute: "Eligibility & benefits",
        prompt: "Select all you support: which of these changes to Social Security and Medicare should the U.S. make?",
        selection: "checklist",
        options: [
          item("medicare-60", "Lowering the Medicare eligibility age to 60", "Medicare at 60", L(["redistribution", -0.6, 0.3], ["ownership", -0.3, 0.2]), "Medicare age kept at 65", L(["redistribution", 0.2, 0.3], ["ownership", 0.1, 0.2])),
          item("means-test", "Reducing Social Security benefits for wealthy retirees", "means-tested benefits", L(["redistribution", -0.2, 0.2]), "full benefits regardless of wealth", L(["redistribution", 0.3, 0.2])),
          item("retire-70", "Raising the full retirement age to 70", "retirement age of 70", L(["redistribution", 0.6, 0.3]), "retirement age kept below 70", L(["redistribution", -0.1, 0.3])),
          noneOfThese,
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
        id: "climate.policies",
        attribute: "Carbon tax, nuclear, cars & Paris",
        prompt: "Select all you support: which of these energy and climate policies should the U.S. adopt?",
        selection: "checklist",
        options: [
          item("nuclear", "Building many more nuclear power plants", "more nuclear power", L(["technology", 0.5, 0.3]), "no new nuclear power", L(["technology", -0.7, 0.3])),
          item("paris", "Staying in the Paris climate agreement", "in the Paris agreement", L(["engagement", -0.5, 0.3], ["environment", -0.3, 0.2]), "out of the Paris agreement", L(["engagement", 0.6, 0.3], ["environment", 0.4, 0.2])),
          item("carbon-tax", "A tax on carbon emissions, with the money returned to households", "carbon tax with dividend", L(["environment", -0.4, 0.3]), "no carbon tax", L(["environment", 0.4, 0.3])),
          item("gas-cars", "Phasing out sales of new gas-powered cars by 2035", "phase out new gas cars by 2035", L(["environment", -0.6, 0.3], ["regulation", -0.6, 0.2]), "no gas-car phase-out", L(["environment", 0.2, 0.3], ["regulation", 0.4, 0.2])),
          noneOfThese,
        ],
      },
    ],
  },
  {
    id: "housing",
    name: "Housing & zoning",
    unless: communist,
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
        id: "housing.policies",
        attribute: "Rent, zoning & federal role",
        prompt: "Select all you support: which of these housing policies should the U.S. adopt?",
        selection: "checklist",
        options: [
          item("rent-control", "Letting cities cap rent increases", "rent control allowed", L(["regulation", -0.6, 0.3]), "no rent control", L(["regulation", 0.6, 0.3])),
          item("apartments", "Allowing apartments in neighborhoods zoned only for single-family homes", "end single-family-only zoning", L(["regulation", 0.3, 0.3], ["social", -0.1, 0.2]), "keep single-family zoning", L(["regulation", -0.2, 0.3], ["social", 0.3, 0.2])),
          item("federal-pressure", "Federal pressure on cities to allow more housing", "federal pressure on local zoning", L(["federalism", 0.6, 0.3]), "zoning left to localities", L(["federalism", -0.7, 0.3])),
          noneOfThese,
        ],
      },
    ],
  },
  {
    id: "debt",
    name: "Federal debt",
    unless: { any: [communist, noState] },
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
    unless: { any: [noState, undemocratic] },
    // Replaces the voting-rules.access checklist (bank 3.1.0), which mixed
    // access and safeguards, allowed contradictory picks, and bundled claims.
    screener: {
      id: "voting-rules.priority",
      attribute: "Access vs. safeguards",
      prompt: "When setting voting rules, what should come first?",
      options: [
        o("access", "Making voting as easy as possible", "access first", L(["voting", -0.8, 0.5])),
        o("lean-access", "Mostly ease of voting, with basic safeguards", "mostly access", L(["voting", -0.4, 0.5])),
        o("both", "Ease of voting and security equally", "access and security equally", L(["voting", 0, 0.5])),
        o("lean-security", "Mostly security, while keeping voting accessible", "mostly security", L(["voting", 0.4, 0.5])),
        o("security", "Preventing fraud, even if voting becomes harder", "security first", L(["voting", 0.8, 0.5])),
      ],
    },
    followUps: [
      {
        id: "voting-rules.rules",
        attribute: "Election rules",
        prompt: "Select all you support: which of these election rules should the U.S. adopt?",
        selection: "checklist",
        options: [
          item("photo-id", "Requiring voters to show a photo ID", "photo ID required", L(["voting", 0.5, 0.3]), "no photo ID requirement", L(["voting", -0.5, 0.3])),
          item("mail", "Letting any voter vote by mail without needing an excuse", "mail voting for anyone", L(["voting", -0.5, 0.3]), "mail voting limited to voters with a reason", L(["voting", 0.6, 0.3])),
          item("registration", "Registering eligible citizens automatically, for example when they get a driver's license", "automatic voter registration", L(["voting", -0.6, 0.3]), "self-registration", L(["voting", 0.4, 0.3])),
          item("ranked-choice", "Ranked-choice voting", "ranked-choice voting", L(["voting", -0.3, 0.2]), "no ranked-choice voting", L(["voting", 0.3, 0.2])),
          item("dc", "Statehood for Washington, D.C.", "D.C. statehood", L(["voting", -0.6, 0.3]), "no D.C. statehood", L(["voting", 0.5, 0.3])),
          item("term-limits", "Term limits for members of Congress", "congressional term limits", {}, "no congressional term limits", {}),
          noneOfThese,
        ],
      },
    ],
  },
  {
    id: "judiciary",
    name: "Supreme Court & judiciary",
    unless: { any: [noState, undemocratic] },
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
