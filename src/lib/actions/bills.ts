"use server";

import { revalidatePath } from "next/cache";
import { billSchema, type BillInput } from "../validation/bill";
import * as billsDb from "../db/bills";
import type { ActionResult } from "./entities";

export async function createBillAction(
  input: BillInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = billSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const bill = await billsDb.createBill(parsed.data);
    revalidatePath("/data");
    revalidatePath("/legislation");
    return { ok: true, data: { id: bill.id } };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function updateBillAction(
  id: string,
  input: BillInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = billSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const bill = await billsDb.updateBill(id, parsed.data);
    if (!bill) return { ok: false, error: "Bill not found" };
    revalidatePath("/data");
    revalidatePath("/legislation");
    return { ok: true, data: { id: bill.id } };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function deleteBillAction(
  id: string,
): Promise<ActionResult<null>> {
  try {
    await billsDb.deleteBill(id);
    revalidatePath("/data");
    revalidatePath("/legislation");
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
