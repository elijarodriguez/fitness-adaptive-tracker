"use client";

import { useEffect, useRef, useState } from "react";

type CoachPanelProps = {
  context: string;
};

export default function CoachPanel({ context }: CoachPanelProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    abortRef.current?.abort();
    window.speechSynthesis?.cancel();
  }, []);

  async function askCoach(event?: React.FormEvent) {
    event?.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 25_000);

    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim() || "Analyze this workout and tell me what to improve.",
          context,
        }),
        signal: controller.signal,
      });
      const data = (await response.json()) as { answer?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Gemini could not analyze this workout.");
      setAnswer(data.answer ?? null);
      setQuestion("");
    } catch (caught) {
      setError(caught instanceof DOMException && caught.name === "AbortError" ? "The coach took too long to respond. Try again." : caught instanceof Error ? caught.message : "Gemini could not analyze this workout.");
    } finally {
      window.clearTimeout(timeout);
      abortRef.current = null;
      setLoading(false);
    }
  }

  function cancelRequest() {
    abortRef.current?.abort();
  }

  function readAloud() {
    if (!answer || !("speechSynthesis" in window)) {
      setError("Spoken coaching is not available in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(answer);
    utterance.rate = 0.95;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => {
      setSpeaking(false);
      setError("The spoken analysis could not start.");
    };
    window.speechSynthesis.speak(utterance);
  }

  return (
    <section className="mt-5 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">Gemini coach</p>
          <h2 className="mt-1 text-lg font-semibold">Jarvis Lite workout analysis</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">Ask about this session, progression, effort, or recovery.</p>
        </div>
        {answer && <button type="button" onClick={readAloud} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]">{speaking ? "Speaking..." : "Read aloud"}</button>}
      </div>

      {answer && <div className="mt-5 whitespace-pre-wrap rounded-xl bg-[var(--surface)] px-4 py-4 text-sm leading-6 text-[var(--foreground)]">{answer}</div>}
      {error && <div role="alert" className="mt-4 rounded-xl border border-[#C97064]/40 bg-[#C97064]/10 px-4 py-3 text-sm text-[#E3A99E]">{error}</div>}

      <form onSubmit={askCoach} className="mt-5 flex flex-col gap-2 sm:flex-row">
        <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Was this workout good?" aria-label="Ask Gemini coach" className="min-h-11 min-w-0 flex-1 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none" />
        {loading ? <button type="button" onClick={cancelRequest} className="min-h-11 rounded-xl border border-[var(--line)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--warm)] hover:text-[var(--warm)]">Cancel</button> : <button type="submit" className="min-h-11 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-ink)] disabled:opacity-50">{answer ? "Ask Gemini" : "Analyze workout"}</button>}
      </form>
      <p className="mt-3 text-[11px] text-[var(--muted)]">Powered by Gemini through your Vercel server. Guidance is not medical advice.</p>
    </section>
  );
}
