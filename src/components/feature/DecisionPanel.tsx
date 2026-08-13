"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { decideMatch } from "@/app/actions/decisions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmSheet } from "@/components/shell/ConfirmSheet";
import { COPY } from "@/lib/constants";
import type { MatchDecisionValue } from "@/types/domain";

export interface DecisionPanelProps {
  matchId: string;
  /** サーバーで取得済みの自分の判断(未判断なら null) */
  initialDecision: MatchDecisionValue | null;
  /** サーバーで取得済みのマッチステータスが 'mutual' か */
  initialMutual: boolean;
}

/**
 * 会話ログ・相性レポート画面の判断パネル(docs/04-api-contract.md §4, FR-5.5〜5.7)。
 * 確認シートの開閉と Server Action 呼び出しがあるため 'use client'。
 */
export function DecisionPanel({ matchId, initialDecision, initialMutual }: DecisionPanelProps) {
  const router = useRouter();
  const [decision, setDecision] = useState<MatchDecisionValue | null>(initialDecision);
  const [mutual, setMutual] = useState(initialMutual);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleAccept() {
    if (submitting) return;
    setSubmitting(true);
    setErrorMessage(null);

    const result = await decideMatch({ matchId, decision: "accept" });
    setSubmitting(false);

    if (!result.ok) {
      setErrorMessage(result.error);
      return;
    }

    setDecision("accept");
    setMutual(result.data.mutual);

    if (result.data.mutual) {
      router.push(`/matches/${matchId}/reveal`);
    }
  }

  async function handleDeclineConfirm() {
    setSheetOpen(false);
    if (submitting) return;
    setSubmitting(true);
    setErrorMessage(null);

    const result = await decideMatch({ matchId, decision: "decline" });
    setSubmitting(false);

    if (!result.ok) {
      setErrorMessage(result.error);
      return;
    }

    router.push(`/matches/${matchId}/declined`);
  }

  if (decision === "accept") {
    return (
      <Card className="decision">
        {mutual ? (
          <>
            <p className="card-title">{COPY.report.acceptedTitle}</p>
            <Button variant="primary" onClick={() => router.push(`/matches/${matchId}/reveal`)}>
              {COPY.report.seeReveal}
            </Button>
          </>
        ) : (
          <p className="text-body">{COPY.report.waitingPartner}</p>
        )}
      </Card>
    );
  }

  return (
    <>
      <Card className="decision">
        <p className="text-note decision__note">{COPY.report.decisionNote}</p>
        {errorMessage ? (
          <p className="field__error" role="alert">
            {errorMessage}
          </p>
        ) : null}
        <Button variant="primary" onClick={() => void handleAccept()} disabled={submitting}>
          {COPY.report.accept}
        </Button>
        <Button variant="secondary" onClick={() => setSheetOpen(true)} disabled={submitting}>
          {COPY.report.decline}
        </Button>
      </Card>

      <ConfirmSheet
        open={sheetOpen}
        title={COPY.report.declineSheetTitle}
        message={COPY.report.declineSheetMessage}
        confirmLabel={COPY.report.declineSheetConfirm}
        danger
        onConfirm={() => void handleDeclineConfirm()}
        onCancel={() => setSheetOpen(false)}
      />
    </>
  );
}
