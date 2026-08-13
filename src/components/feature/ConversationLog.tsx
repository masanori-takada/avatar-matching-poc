import { Bubble } from "@/components/ui/Bubble";
import { Card } from "@/components/ui/Card";
import { COPY } from "@/lib/constants";
import type { ConversationTurn } from "@/types/domain";

export interface ConversationLogProps {
  turns: ConversationTurn[];
  timeLabel: string;
  /** 閲覧者が profile_a か('a'/'b' の話者ラベルをこの値に応じて反転させる) */
  viewerIsProfileA: boolean;
}

/**
 * アバター間会話の全ターン表示(docs/03-data-model.md §2.9, FR-5.2)。
 * DB は speaker を 'a'/'b' で保存する。閲覧者によって「自分/相手」が入れ替わるため、
 * 表示側で viewerIsProfileA を見て反転する。
 */
export function ConversationLog({ turns, timeLabel, viewerIsProfileA }: ConversationLogProps) {
  return (
    <Card className="log">
      <h2 className="section-title log__title">{timeLabel}</h2>
      <div className="chat chat--log">
        {turns.map((turn, index) => {
          const isViewer = viewerIsProfileA ? turn.speaker === "a" : turn.speaker === "b";
          return (
            <Bubble
              key={index}
              variant={isViewer ? "self" : "ai"}
              who={isViewer ? "あなたのアバター" : "お相手のアバター"}
            >
              {turn.text}
            </Bubble>
          );
        })}
      </div>
      <p className="text-note">{COPY.report.logNote}</p>
    </Card>
  );
}
