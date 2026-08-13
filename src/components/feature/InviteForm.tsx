"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { registerWithInviteCode } from "@/app/actions/invite";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { AGE_RANGES, COPY } from "@/lib/constants";

interface FormState {
  code: string;
  fullName: string;
  companyName: string;
  department: string;
  ageRange: string;
  message: string;
}

const INITIAL_STATE: FormState = {
  code: "",
  fullName: "",
  companyName: "",
  department: "",
  ageRange: "",
  message: "",
};

/**
 * 招待コード + 実名登録フォーム(docs/04-api-contract.md §1)。
 * Server Action の呼び出しと成功時の遷移に useRouter が必要なため 'use client'。
 */
export function InviteForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [fieldError, setFieldError] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (form.code.trim() === "") {
      setFieldError({ code: COPY.invite.errorEmpty });
      return;
    }

    setSubmitting(true);
    setFieldError({});
    setGeneralError(null);

    const result = await registerWithInviteCode({
      code: form.code,
      fullName: form.fullName,
      companyName: form.companyName,
      department: form.department,
      ageRange: form.ageRange,
      message: form.message,
    });

    setSubmitting(false);

    if (!result.ok) {
      if (result.field) {
        setFieldError({ [result.field]: result.error });
      } else {
        setGeneralError(result.error);
      }
      return;
    }

    router.push("/interview");
  }

  return (
    <Card>
      <form onSubmit={handleSubmit}>
        <p className="text-body">{COPY.invite.description}</p>

        <Field
          label={COPY.invite.codeLabel}
          placeholder={COPY.invite.codePlaceholder}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={form.code}
          onChange={(e) => update("code", e.target.value)}
          error={fieldError.code ?? null}
        />

        <Field
          label="氏名"
          value={form.fullName}
          onChange={(e) => update("fullName", e.target.value)}
          error={fieldError.fullName ?? null}
        />

        <Field
          label="会社名"
          value={form.companyName}
          onChange={(e) => update("companyName", e.target.value)}
          error={fieldError.companyName ?? null}
        />

        <Field
          label="部署(任意)"
          value={form.department}
          onChange={(e) => update("department", e.target.value)}
          error={fieldError.department ?? null}
        />

        <div>
          <label className="field__label" htmlFor="ageRange">
            年代(任意)
          </label>
          <select
            id="ageRange"
            className="field__input"
            value={form.ageRange}
            onChange={(e) => update("ageRange", e.target.value)}
          >
            <option value="">選択しない</option>
            {AGE_RANGES.map((range) => (
              <option key={range} value={range}>
                {range}
              </option>
            ))}
          </select>
          {fieldError.ageRange ? (
            <p className="field__error" role="alert">
              {fieldError.ageRange}
            </p>
          ) : null}
        </div>

        <Field
          label="一言(任意)"
          value={form.message}
          onChange={(e) => update("message", e.target.value)}
          error={fieldError.message ?? null}
        />

        {generalError ? (
          <p className="field__error" role="alert">
            {generalError}
          </p>
        ) : null}

        <Button type="submit" variant="primary" className="invite__submit" disabled={submitting}>
          {submitting ? "登録中…" : COPY.invite.submit}
        </Button>
      </form>
    </Card>
  );
}
