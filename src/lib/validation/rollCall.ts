export interface RollCall {
  id: string;
  billId: string | null;
  jurisdiction: string;
  congress: number | null;
  chamber: string;
  session: number | null;
  rollNumber: number;
  question: string;
  voteType: string;
  result: string;
  date: string;
  externalId: string | null;
  createdAt: string;
  updatedAt: string;
}
