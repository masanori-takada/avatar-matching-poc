"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { selectSlot } from "@/app/actions/schedule";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/IconSprite";
import { COPY } from "@/lib/constants";
import type { MeetingSlot } from "@/types/domain";

export interface SlotPickerProps {
  matchId: string;
  slots: MeetingSlot[];
  /** サーバーで取得済みの自分の選択(未選択なら null) */
  initialSelectedSlotId: string | null;
}

/**
 * 面談候補日時の選択(docs/04-api-contract.md §5, poc/app.js renderers.reveal)。
 * カード選択とサーバーアクション呼び出しがあるため 'use client'。
 */
export function SlotPicker({ matchId, slots, initialSelectedSlotId }: SlotPickerProps) {
  const router = useRouter();
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(initialSelectedSlotId);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit() {
    if (!selectedSlotId || submitting) return;
    setSubmitting(true);
    setErrorMessage(null);
    setMessage(null);

    const result = await selectSlot({ matchId, slotId: selectedSlotId });
    setSubmitting(false);

    if (!result.ok) {
      setErrorMessage(result.error);
      return;
    }

    if (result.data.agreed) {
      router.push(`/matches/${matchId}/done`);
      return;
    }

    if (result.data.bothSelected) {
      setMessage(COPY.reveal.otherSlotChosen);
      return;
    }

    setMessage(COPY.reveal.waitingAfterSelect);
  }

  return (
    <>
      {slots.map((slot) => {
        const selected = selectedSlotId === slot.id;
        return (
          <button
            key={slot.id}
            type="button"
            className={selected ? "card slot is-selected" : "card slot"}
            aria-pressed={selected}
            onClick={() => {
              setSelectedSlotId(slot.id);
              setMessage(null);
              setErrorMessage(null);
            }}
          >
            <span className="icon-circle">
              <Icon name="i-calendar" />
            </span>
            <span className="slot__body">
              <span className="slot__label">{formatSlotLabel(slot.startsAt, slot.endsAt)}</span>
              <span className="slot__place">{slot.place}</span>
            </span>
          </button>
        );
      })}

      {errorMessage ? (
        <p className="field__error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {message ? (
        <p className="text-body" role="status">
          {message}
        </p>
      ) : null}

      <Button
        variant="primary"
        className="reveal__cta"
        disabled={!selectedSlotId || submitting}
        onClick={() => void handleSubmit()}
      >
        {COPY.reveal.slotSubmit}
      </Button>
    </>
  );
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

function pad2(value: number): string {
  return value.toString().padStart(2, "0");
}

function formatSlotLabel(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const month = start.getMonth() + 1;
  const day = start.getDate();
  const weekday = WEEKDAYS[start.getDay()];
  const startTime = `${pad2(start.getHours())}:${pad2(start.getMinutes())}`;
  const endTime = `${pad2(end.getHours())}:${pad2(end.getMinutes())}`;
  return `${month}月${day}日(${weekday}) ${startTime} – ${endTime}`;
}
