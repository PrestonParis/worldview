"use server";

import { requireContributor } from "../auth/guard";
import { revalidatePath } from "next/cache";
import { billSchema, type BillInput } from "../validation/bill";
import * as billsDb from "../db/bills";
import { actionFailure, validationFailure, type ActionResult } from "./result";

export async function createBillAction(input: BillInput): Promise<ActionResult<{ id: string }>> {
  const denied = await requireContributor();
  if (denied) return denied;
  const parsed = billSchema.safeParse(input);
  if (!parsed.success) {
    return validationFailure(parsed.error);
  }
  try {
    const bill = await billsDb.createBill(parsed.data);
    revalidatePath("/data");
    revalidatePath("/legislation");
    return { ok: true, data: { id: bill.id } };
  } catch (err) {
    return actionFailure("bills.create", err);
  }
}

export async function updateBillAction(id: string, input: BillInput): Promise<ActionResult<{ id: string }>> {
  const denied = await requireContributor();
  if (denied) return denied;
  const parsed = billSchema.safeParse(input);
  if (!parsed.success) {
    return validationFailure(parsed.error);
  }
  try {
    const bill = await billsDb.updateBill(id, parsed.data);
    if (!bill) return { ok: false, error: "Bill not found" };
    revalidatePath("/data");
    revalidatePath("/legislation");
    return { ok: true, data: { id: bill.id } };
  } catch (err) {
    return actionFailure("bills.update", err);
  }
}

export async function deleteBillAction(id: string): Promise<ActionResult<null>> {
  const denied = await requireContributor();
  if (denied) return denied;
  try {
    await billsDb.deleteBill(id);
    revalidatePath("/data");
    revalidatePath("/legislation");
    return { ok: true, data: null };
  } catch (err) {
    return actionFailure("bills.delete", err);
  }
}
