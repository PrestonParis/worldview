import type { AxisId, ChoiceQuestion, IssueId, IssueModule, Statement } from "./types";

const AXIS_EXPLANATIONS: Record<AxisId, string> = {
  federalism: "This helps measure whether you prefer decisions to be made by states and localities or through uniform national rules.",
  executive: "This helps measure how much freedom a president should have relative to Congress, the courts, and independent agencies.",
  liberty: "This weighs privacy and due process against the government's power to prevent crime and protect national security.",
  voting: "This helps measure how you balance broad access to voting with rules intended to protect election integrity and institutional checks.",
  democracy: "This helps measure whether government must be chosen in free, competitive elections, or whether authority can rightly rest elsewhere.",
  ownership: "This weighs public or collective ownership against private ownership of industries and public services.",
  regulation: "This helps measure how much government should regulate markets, employers, and consumer safety.",
  redistribution: "This weighs progressive taxes and public benefits against lower taxes, limited benefits, and individual responsibility.",
  trade: "This weighs protecting domestic industries with tariffs and subsidies against lowering barriers to international trade.",
  engagement: "This helps measure the role you want alliances, treaties, international institutions, and foreign aid to play in U.S. policy.",
  force: "This weighs active military involvement abroad against a more restrained, defensive use of force.",
  social: "This helps measure your preference for changing or preserving social norms involving family, gender, and sexuality.",
  religion: "This helps measure what role religion should have in government and law, from a state that discourages it to one governed by religious law.",
  immigration: "This weighs higher immigration and a pluralistic national identity against lower immigration, enforcement, and assimilation.",
  justice: "This weighs criminal-justice reform and rehabilitation against stronger policing and punishment.",
  identity: "This weighs policies that address group disparities against policies that treat people without regard to race or group identity.",
  environment: "This weighs environmental protection and climate policy against energy costs, development, and economic growth.",
  technology: "This weighs caution and safety rules for powerful technologies against faster innovation and wider individual choice.",
};

const ISSUE_EXPLANATIONS: Record<IssueId, string> = {
  abortion: "Consider the law's overall limits, who should set them, and whether exceptions or public funding should apply.",
  guns: "Consider firearm access, public safety, due process, and which restrictions should apply to ownership or carrying.",
  immigration: "Consider legal immigration, the status of undocumented residents, border enforcement, asylum, and who should be admitted.",
  healthcare: "Consider who should provide coverage, how costs should be controlled, and which people or conditions public programs should cover.",
  taxes: "Consider how taxes should be distributed across income, wealth, corporations, inheritances, and families.",
  labor: "Consider wages, union power, worker classification, and whether benefits should be voluntary or required.",
  entitlements: "Consider how Social Security and Medicare should balance benefits, eligibility, taxes, and long-term financing.",
  climate: "Consider the urgency of climate change and the costs, technologies, and rules the response should involve.",
  policing: "Consider police funding, tactics, equipment, accountability, and the proper role of federal oversight.",
  "death-penalty": "Consider which crimes, if any, should permit execution and what appeals or alternative sentences should remain available.",
  drugs: "Consider criminal penalties, regulated access, treatment, and harm-reduction policies for marijuana and other drugs.",
  lgbtq: "Consider civil rights, religious exemptions, sports eligibility, identity documents, and transition-related medical policy.",
  "affirmative-action": "Consider whether policy should account for race or group disparities, rely on economic disadvantage, or treat applicants without group preferences.",
  education: "Consider which schools should receive public money, who should control curriculum, and how student debt should be handled.",
  speech: "Consider the difference between government restrictions and private platform rules, as well as liability and national-security concerns.",
  "voting-rules": "Consider access to the ballot, election safeguards, representation, voting systems, and limits on elected service.",
  judiciary: "Consider the Supreme Court's size and tenure, constitutional interpretation, judicial independence, and ethics enforcement.",
  israel: "Consider military aid, diplomatic alignment, the desired political outcome, and the speech rights involved in boycotts.",
  ukraine: "Consider military and economic aid, NATO membership, negotiations, and the risks of a longer war.",
  china: "Consider competition, trade, security, human rights, and whether economic ties should be narrowed.",
  tariffs: "Consider when import taxes are justified, who should impose them, and how displaced workers should be supported.",
  ai: "Consider safety rules for the most capable AI systems, economic disruption, and whether regulation should be state or national.",
  "religious-liberty": "Consider when religious exercise should justify an exemption from rules that otherwise apply to employers, businesses, or individuals.",
  housing: "Consider rent rules, construction, subsidies, zoning, neighborhood control, and the federal role in local housing policy.",
  "religion-law": "Consider whether any religious tradition should shape the law, how far religious law should reach, and who should interpret it.",
  regime: "Consider who should hold final political authority, what makes someone part of the nation, and how fundamental change should come about.",
  "economic-system": "Consider who should own businesses and industry, how much the market or the state should decide, and how much should be shared through taxes and public provision.",
  debt: "Consider whether debt reduction should rely on taxes, spending cuts, both, or neither, and which spending should bear any cuts.",
};

const QUESTION_EXPLANATIONS: Record<string, string> = {
  "regime.authority": "This is about who makes the decisions in the end. In a representative democracy voters choose officials who make the laws; in a direct democracy citizens decide themselves. If you'd prefer rule by someone who doesn't answer to voters, the next question asks who.",
  "regime.ruler": "Pick who should hold power when it doesn't come from elections. A monarch here means one who actually governs, not a ceremonial head of state alongside an elected parliament.",
  "economic-system.system": "Pick the system you would choose if starting from scratch. Communism abolishes private ownership of business; socialism puts major industries under public or worker ownership; the capitalist options differ in how much the state taxes, regulates, and steers private enterprise.",
  "guns.laws": "Red-flag laws let a court order a temporary firearm removal after reviewing evidence that a person poses a danger. A mandatory buyback requires current owners of newly prohibited weapons to transfer them to the government for compensation. Leave unchecked anything you oppose.",
  "immigration.enforcement": "Dreamers are undocumented people who entered the United States as children, including but not limited to DACA recipients. Asylum is legal protection requested by someone who says they face persecution. Leave unchecked anything you oppose.",
  "policing.reforms": "A federal pattern-or-practice investigation examines whether a law-enforcement agency repeatedly violates constitutional or federal rights. Leave unchecked anything you oppose.",
  "drugs.policies": "At supervised consumption sites, people use previously obtained drugs under staff supervision and can receive overdose care or treatment referrals. Leave unchecked anything you oppose.",
  "lgbtq.policies": "An “X” marker is a nonbinary sex or gender designation offered on some government identity documents. Leave unchecked anything you oppose.",
  "affirmative-action.policies": "A set-aside reserves some public contracts or contracting opportunities for businesses that meet specified ownership criteria. Leave unchecked anything you oppose.",
  "speech.limits": "Federal law (Section 230) generally shields online platforms from liability for user posts and lets them moderate content. Leave unchecked anything you oppose.",
  "religious-liberty.exemptions": "Each item is an exemption or permission granted on religious grounds. Leave unchecked anything you oppose.",
  "abortion.access": "Telehealth prescriptions let a clinician prescribe abortion pills after a remote consultation. Leave unchecked anything you oppose.",
  "taxes.policies": "A wealth tax is charged on net worth rather than annual income. A fully refundable child credit can produce a payment even when a family owes no income tax. Leave unchecked anything you oppose.",
  "labor.benefits": "Employee status usually brings wage and benefit protections; independent-contractor status generally provides more flexibility but fewer protections. Leave unchecked anything you oppose.",
  "entitlements.changes": "Means-testing reduces or removes benefits for people above an income or wealth threshold. Leave unchecked anything you oppose.",
  "climate.policies": "A carbon tax charges for emissions; a dividend returns the revenue to households. The Paris Agreement is an international framework in which countries set their own emissions targets. Leave unchecked anything you oppose.",
  "housing.policies": "Rent control limits how much a landlord may raise rent. Single-family-only zoning prevents duplexes or apartment buildings in designated residential areas. Leave unchecked anything you oppose.",
  "voting-rules.rules": "In ranked-choice voting, voters rank candidates; lower-ranked choices can be redistributed until a candidate meets the required threshold. Leave unchecked anything you oppose.",
  "abortion.limit": "Viability means the stage at which a fetus may be able to survive outside the uterus with medical support; the timing varies by pregnancy.",
  "drugs.policy": "Legalizing a drug lets adults buy it from licensed, regulated sellers; decriminalizing possession means people caught with a small amount get a fine or a treatment referral instead of arrest, while selling stays illegal. Marijuana is illegal under federal law but legal for adult use in 24 states and D.C. and for medical use in about 40. Portugal decriminalized possession of all drugs in 2001; Oregon did the same in 2020 and reversed it in 2024.",
  "education.choice": "Charter schools are free, publicly funded schools run independently of the local school district. A voucher gives a family public money to pay private-school tuition. Under universal school choice, every family can take its child's share of education funding to any school, often through an education savings account that can also cover tutoring or homeschool costs; Arizona became the first state to offer this to all students in 2022.",
  "religious-liberty.vendors": "The question asks when a generally available commercial service may be refused because providing it conflicts with the vendor's religious beliefs.",
  "healthcare.system": "Single-payer uses one public insurer; a public option adds a government plan alongside private plans; market-based systems rely more heavily on private coverage.",
  "healthcare.preexisting": "A pre-existing-condition rule prevents insurers from denying coverage or charging more because of a person's health history.",
  "taxes.top-rate": "The top rate is marginal: it applies only to taxable income above the highest bracket's threshold (in 2026, $640,600 for single filers and $768,700 for married couples filing jointly), not to all of a person's income. The top rate was 91–92% in the 1950s, 70% through 1980, 28% after the 1986 tax reform, and 39.6% before the 2017 tax law cut it to 37%. Individual income taxes supply about half of federal revenue.",
  "entitlements.solvency": "Solvency means having enough dedicated revenue and reserves to pay scheduled benefits over time.",
  "debt.priority": "The national debt is the accumulated amount the federal government has borrowed; an annual deficit adds to it.",
  "tariffs.level": "A tariff is a tax on imported goods, collected from the importer and often reflected in business costs or consumer prices.",
  "tariffs.authority": "The Constitution gives Congress tariff authority, although Congress has delegated some of that authority to presidents under federal law.",
  "ai.governance": "The most powerful, or frontier, AI systems are general-purpose models near the leading edge of current capabilities.",
  "judiciary.interpretation": "Originalism emphasizes the Constitution's original public meaning; a living-constitution approach applies its principles in light of modern conditions.",
  "israel.boycotts": "These laws concern government contracts with businesses that boycott Israel, creating a dispute between anti-discrimination policy and free-speech rights.",
  "ukraine.nato": "NATO membership requires agreement from all member countries and carries a collective-defense commitment.",
};

export function explainStatement(statement: Statement): string {
  const axis = statement.id.split(".")[0] as AxisId;
  return AXIS_EXPLANATIONS[axis];
}

export function explainQuestion(question: ChoiceQuestion, module: IssueModule): string {
  return QUESTION_EXPLANATIONS[question.id] ?? ISSUE_EXPLANATIONS[module.id];
}
