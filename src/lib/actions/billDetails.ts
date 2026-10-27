"use server";

import { requireContributor } from "../auth/guard";
import { revalidatePath } from "next/cache";
import {
  billCosponsorSchema,
  billActionSchema,
  billCommitteeSchema,
  billRelationSchema,
  billTextVersionSchema,
  type BillCosponsorInput,
  type BillActionInput,
  type BillCommitteeInput,
  type BillRelationInput,
  type BillTextVersionInput,
} from "../validation/billDetail";
import * as bd from "../db/billDetails";
import { actionFailure, validationFailure, type ActionResult } from "./result";

function revalidate(billId: string) {
  revalidatePath("/data/bills");
  revalidatePath(`/data/bills/${billId}/edit`);
  revalidatePath("/legislation");
  revalidatePath(`/legislation/${billId}`);
}

async function run<T>(billId: string, fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    revalidate(billId);
    return { ok: true, data };
  } catch (err) {
    return actionFailure("bill-details.write", err);
  }
}

export async function createCosponsorAction(input: BillCosponsorInput): Promise<ActionResult<{ id: string }>> {
  const denied = await requireContributor();
  if (denied) return denied;
  const parsed = billCosponsorSchema.safeParse(input);
  if (!parsed.success) {
    return validationFailure(parsed.error);
  }
  return run(parsed.data.billId, async () => ({
    id: (await bd.createCosponsor(parsed.data)).id,
  }));
}

export async function createActionAction(input: BillActionInput): Promise<ActionResult<{ id: string }>> {
  const denied = await requireContributor();
  if (denied) return denied;
  const parsed = billActionSchema.safeParse(input);
  if (!parsed.success) {
    return validationFailure(parsed.error);
  }
  return run(parsed.data.billId, async () => ({
    id: (await bd.createAction(parsed.data)).id,
  }));
}

export async function createCommitteeAction(input: BillCommitteeInput): Promise<ActionResult<{ id: string }>> {
  const denied = await requireContributor();
  if (denied) return denied;
  const parsed = billCommitteeSchema.safeParse(input);
  if (!parsed.success) {
    return validationFailure(parsed.error);
  }
  return run(parsed.data.billId, async () => ({
    id: (await bd.createCommittee(parsed.data)).id,
  }));
}

export async function createRelationAction(input: BillRelationInput): Promise<ActionResult<{ id: string }>> {
  const denied = await requireContributor();
  if (denied) return denied;
  const parsed = billRelationSchema.safeParse(input);
  if (!parsed.success) {
    return validationFailure(parsed.error);
  }
  return run(parsed.data.billId, async () => ({
    id: (await bd.createRelation(parsed.data)).id,
  }));
}

export async function createTextVersionAction(input: BillTextVersionInput): Promise<ActionResult<{ id: string }>> {
  const denied = await requireContributor();
  if (denied) return denied;
  const parsed = billTextVersionSchema.safeParse(input);
  if (!parsed.success) {
    return validationFailure(parsed.error);
  }
  return run(parsed.data.billId, async () => ({
    id: (await bd.createTextVersion(parsed.data)).id,
  }));
}

export async function deleteBillChildAction(
  kind: "cosponsor" | "action" | "committee" | "relation" | "textVersion",
  id: string,
  billId: string,
): Promise<ActionResult<null>> {
  const denied = await requireContributor();
  if (denied) return denied;
  const del = {
    cosponsor: bd.deleteCosponsor,
    action: bd.deleteAction,
    committee: bd.deleteCommittee,
    relation: bd.deleteRelation,
    textVersion: bd.deleteTextVersion,
  }[kind];
  return run(billId, async () => {
    await del(id);
    return null;
  });
}
