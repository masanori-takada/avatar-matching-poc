"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { submitAnswer, completeInterview } from "@/app/actions/interview";
import { Bubble } from "@/components/ui/Bubble";
import { Button } from "@/components/ui/Button";
import { COPY } from "@/lib/constants";
import type { InterviewQuestion } from "@/types/domain";

export interface InterviewChatProps {
  questions: InterviewQuestion[];
  initialAnswers: Array<{ questionId: string; answer: string }>;
}

interface AnsweredItem {
  questionId: string;
  questionText: string;
  answer: string;
}

/**
 * AIインタビューのチャットUI(poc/app.js renderers.interview 相当)。
 * タイピングバブル600ms、進捗バー、選択肢ボタン、IME中のEnter無視を再現する。
 */
export function InterviewChat({ questions, initialAnswers }: InterviewChatProps) {
  const router = useRouter();
  const viewportRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  const [answered, setAnswered] = useState<AnsweredItem[]>(() => {
    const byId = new Map(initialAnswers.map((a) => [a.questionId, a.answer]));
    return questions
      .filter((q) => byId.has(q.id))
      .map((q) => ({ questionId: q.id, questionText: q.text, answer: byId.get(q.id) ?? "" }));
  });
  const [showTyping, setShowTyping] = useState(false);
  const [textValue, setTextValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentQuestion = questions[answered.length] ?? null;
  const done = currentQuestion === null;

  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [answered.length, showTyping]);

  async function handleAnswer(rawAnswer: string) {
    const question = questions[answered.length];
    if (!question || submitting || showTyping) return;

    const answer = rawAnswer.trim();
    if (answer === "") return;

    setSubmitting(true);
    setErrorMessage(null);

    const result = await submitAnswer({ questionId: question.id, answer });

    setSubmitting(false);

    if (!result.ok) {
      setErrorMessage(result.error);
      return;
    }

    setTextValue("");
    setShowTyping(true);

    window.setTimeout(() => {
      setAnswered((prev) => [...prev, { questionId: question.id, questionText: question.text, answer }]);
      setShowTyping(false);
    }, 600);
  }

  function handleTextKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // IME変換確定のEnterでは送信しない(isComposing中は無視)
    if (event.key === "Enter" && !event.nativeEvent.isComposing && textValue.trim() !== "") {
      void handleAnswer(textValue);
    }
  }

  async function handleFinish() {
    if (finishing) return;
    setFinishing(true);
    setErrorMessage(null);

    const result = await completeInterview();

    if (!result.ok) {
      setFinishing(false);
      setErrorMessage(result.error);
      return;
    }

    router.push("/waiting");
  }

  const progressCount = done ? questions.length : answered.length + 1;
  const progressPercent = Math.round((answered.length / questions.length) * 100);

  return (
    <section className="app-viewport screen--interview">
      <div className="interview__head">
        <h1 className="screen-title interview__title" tabIndex={-1}>
          {COPY.interview.title}
        </h1>
        <span className="interview__progress">
          {progressCount} / {questions.length}
        </span>
      </div>
      <div className="progress">
        <div className="progress__fill" style={{ width: `${progressPercent}%` }} />
      </div>

      <div className="chat interview__chat" ref={viewportRef}>
        <Bubble variant="ai">{COPY.interview.intro}</Bubble>

        {answered.map((item) => (
          <div key={item.questionId}>
            <Bubble variant="ai">{item.questionText}</Bubble>
            <Bubble variant="self">{item.answer}</Bubble>
          </div>
        ))}

        {currentQuestion ? (
          <>
            <Bubble variant="ai">{currentQuestion.text}</Bubble>
            {showTyping ? null : currentQuestion.kind === "choice" ? (
              <div className="choices">
                {currentQuestion.options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className="choice"
                    disabled={submitting}
                    onClick={() => void handleAnswer(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <Bubble variant="ai">{COPY.interview.outro}</Bubble>
        )}

        {showTyping ? <Bubble variant="typing" /> : null}
      </div>

      {errorMessage ? (
        <p className="field__error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      {currentQuestion && currentQuestion.kind === "free" && !showTyping ? (
        <div className="interview__input">
          <label className="sr-only" htmlFor="interviewText">
            回答を入力
          </label>
          <input
            id="interviewText"
            ref={textInputRef}
            className="field__input"
            type="text"
            placeholder={COPY.interview.inputPlaceholder}
            autoComplete="off"
            spellCheck={false}
            value={textValue}
            disabled={submitting}
            onChange={(e) => setTextValue(e.target.value)}
            onKeyDown={handleTextKeyDown}
          />
          <button
            type="button"
            className="interview__send"
            disabled={textValue.trim() === "" || submitting}
            onClick={() => void handleAnswer(textValue)}
          >
            {COPY.interview.send}
          </button>
        </div>
      ) : null}

      {done ? (
        <div className="interview__actions">
          <Button variant="primary" onClick={() => void handleFinish()} disabled={finishing}>
            {finishing ? "送信中…" : COPY.interview.finish}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
