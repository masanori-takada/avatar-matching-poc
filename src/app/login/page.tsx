"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/IconSprite";
import { COPY } from "@/lib/constants";

/**
 * メールOTPログイン画面(docs/04-api-contract.md, docs/06-implementation-plan.md フェーズ3)。
 * signInWithOtp はブラウザから呼ぶ必要があるため 'use client'。
 */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = email.trim();
    if (trimmed === "") {
      setStatus("error");
      setErrorMessage("メールアドレスを入力してください");
      return;
    }

    setStatus("sending");
    setErrorMessage(null);

    const supabase = createClient();
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/api/auth/callback` : undefined;

    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: redirectTo },
    });

    if (error) {
      setStatus("error");
      setErrorMessage("送信に失敗しました。時間をおいて再度お試しください。");
      return;
    }

    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <section className="app-viewport screen--invite">
        <div className="invite__brand">
          <span className="icon-circle icon-circle--lg">
            <Icon name="i-logo" />
          </span>
          <h1 className="invite__service" tabIndex={-1}>
            {COPY.serviceName}
          </h1>
        </div>
        <Card>
          <p className="text-body">確認メールを送信しました</p>
          <p className="text-note">
            {email} 宛にログイン用のリンクを送信しました。メール内のリンクを開いてログインしてください。
          </p>
        </Card>
      </section>
    );
  }

  return (
    <section className="app-viewport screen--invite">
      <div className="invite__brand">
        <span className="icon-circle icon-circle--lg">
          <Icon name="i-logo" />
        </span>
        <h1 className="invite__service" tabIndex={-1}>
          {COPY.serviceName}
        </h1>
        <p className="invite__catch">{COPY.catchphrase}</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <p className="text-body">メールアドレスを入力すると、ログイン用のリンクをお送りします。</p>
          <Field
            label="メールアドレス"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={status === "error" ? (errorMessage ?? undefined) : null}
          />
          <Button type="submit" variant="primary" className="invite__submit" disabled={status === "sending"}>
            {status === "sending" ? "送信中…" : "ログインリンクを送る"}
          </Button>
        </form>
      </Card>
    </section>
  );
}
