// Plain-English definitions for the campaign-finance and lobbying terms used
// across /money. Shown as hover/focus definitions (components/money/term.tsx)
// and as the glossary on the overview.

export const GLOSSARY = {
  receipts: {
    term: "Receipts",
    def: "Everything a campaign committee took in during the cycle: contributions, transfers from other committees, loans, and refunds.",
  },
  disbursements: {
    term: "Disbursements",
    def: "Everything a committee paid out: operating costs, ads, staff, transfers, loan repayments, and refunds.",
  },
  cashOnHand: {
    term: "Cash on hand",
    def: "Money a committee had in the bank at the end of its latest reporting period.",
  },
  individual: {
    term: "Individual contribution",
    def: "A gift from a person to a campaign or committee. Capped per election by federal limits.",
  },
  pac: {
    term: "PAC",
    def: "Political action committee: a committee that pools money from members or employees and gives it to candidates, within contribution limits.",
  },
  superPac: {
    term: "Super PAC",
    def: "A committee that can raise and spend unlimited sums but may not give to or coordinate with candidates. It spends independently instead.",
  },
  partyCommittee: {
    term: "Party committee",
    def: "A national, state, or local party organization (for example the DSCC or NRSC) that raises money and supports its nominees.",
  },
  candidateCommittee: {
    term: "Candidate committee",
    def: "The official campaign committee a candidate registers with the FEC to raise and spend money for their race.",
  },
  jfc: {
    term: "Joint fundraising committee",
    def: "A committee set up by two or more candidates or committees to raise money together and split the proceeds, such as a candidate's \"Victory Fund\".",
  },
  transfer: {
    term: "Transfer",
    def: "Money moved between affiliated committees, such as a joint fundraising committee passing its share to a campaign.",
  },
  independentExpenditure: {
    term: "Independent expenditure",
    def: "Spending that expressly supports or opposes a candidate and is made without coordinating with any campaign. Reported on FEC Schedule E.",
  },
  coordinatedExpenditure: {
    term: "Coordinated expenditure",
    def: "Party spending made in cooperation with a nominee's campaign, subject to its own limits.",
  },
  outsideSpending: {
    term: "Outside spending",
    def: "Money spent to help or defeat candidates by groups other than the campaigns themselves: super PACs, party committees, and nonprofits.",
  },
  lobbyingClient: {
    term: "Lobbying client",
    def: "The company, trade group, or organization paying for lobbying on its behalf.",
  },
  lobbyingRegistrant: {
    term: "Lobbying registrant",
    def: "The lobbying firm (or the organization itself, when lobbying in-house) that registers and files the disclosure reports.",
  },
  lobbyist: {
    term: "Lobbyist",
    def: "A person paid to contact members of Congress, staff, or executive-branch officials on behalf of a client.",
  },
  cycle: {
    term: "Election cycle",
    def: "The two-year period ending with a federal general election. The 2026 cycle runs from January 2025 through December 2026.",
  },
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;
