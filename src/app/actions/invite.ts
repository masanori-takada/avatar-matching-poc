"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AGE_RANGES } from "@/lib/constants";
import type { ActionResult } from "@/types/domain";

/**
 * 招待コード検証 + 実名登録(docs/04-api-contract.md §1)。
 * service_role の使用はこのファイルの `consume_invite_code` 呼び出しに限る。
 */

export interface RegisterWithInviteCodeInput {
  code: string;
  fullName: string;
  companyName: string;
  department?: string;
  ageRange?: string;
  message?: string;
}

export async function registerWithInviteCode(
  input: RegisterWithInviteCodeInput,
): Promise<ActionResult<{ organizationId: string }>> {
  const user = await requireUser();

  const code = input.code.trim();
  if (code === "") {
    return { ok: false, error: "招待コードを入力してください", field: "code" };
  }

  const fullName = input.fullName.trim();
  if (fullName === "" || fullName.length > 60) {
    return { ok: false, error: "氏名を1〜60字で入力してください", field: "fullName" };
  }

  const companyName = input.companyName.trim();
  if (companyName === "" || companyName.length > 100) {
    return { ok: false, error: "会社名を1〜100字で入力してください", field: "companyName" };
  }

  const department = (input.department ?? "").trim();
  if (department.length > 100) {
    return { ok: false, error: "部署は100字以内で入力してください", field: "department" };
  }

  const ageRange = (input.ageRange ?? "").trim();
  if (ageRange !== "" && !AGE_RANGES.includes(ageRange)) {
    return { ok: false, error: "年代の指定が正しくありません", field: "ageRange" };
  }

  const message = (input.message ?? "").trim();
  if (message.length > 100) {
    return { ok: false, error: "一言は100字以内で入力してください", field: "message" };
  }

  const supabase = await createClient();

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existingProfile) {
    return { ok: false, error: "すでに登録済みです" };
  }

  const admin = createAdminClient();
  const { data: rpcResult, error: rpcError } = await admin.rpc("consume_invite_code", {
    p_code: code,
    p_user_id: user.id,
  });

  if (rpcError) {
    const message = rpcError.message ?? "";
    if (message.includes("EXPIRED_CODE")) {
      return { ok: false, error: "この招待コードは有効期限が切れています", field: "code" };
    }
    if (message.includes("EXHAUSTED_CODE")) {
      return { ok: false, error: "この招待コードは利用上限に達しています", field: "code" };
    }
    if (message.includes("ALREADY_REGISTERED")) {
      return { ok: false, error: "すでに登録済みです" };
    }
    return { ok: false, error: "招待コードが正しくありません", field: "code" };
  }

  const organizationId = rpcResult?.[0]?.organization_id;
  if (!organizationId) {
    return { ok: false, error: "招待コードが正しくありません", field: "code" };
  }

  const { error: identityError } = await supabase.from("identities").insert({
    profile_id: user.id,
    full_name: fullName,
    company_name: companyName,
    department: department || null,
    message: message || null,
  });

  if (identityError) {
    return { ok: false, error: "登録に失敗しました。もう一度お試しください。" };
  }

  if (ageRange !== "") {
    await supabase.from("profiles").update({ age_range: ageRange }).eq("id", user.id);
  }

  revalidatePath("/");

  return { ok: true, data: { organizationId } };
}
