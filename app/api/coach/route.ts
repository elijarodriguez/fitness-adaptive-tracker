import { NextResponse } from "next/server";

const MAX_QUESTION_LENGTH = 500;
const MAX_CONTEXT_LENGTH = 12000;
const REQUEST_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 8;
const requestLog = new Map<string, number[]>();

function getClientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function isRateLimited(key: string) {
  const now = Date.now();
  const recent = (requestLog.get(key) ?? []).filter((time) => now - time < REQUEST_WINDOW_MS);
  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    requestLog.set(key, recent);
    return true;
  }
  recent.push(now);
  requestLog.set(key, recent);
  return false;
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Gemini is not configured. Add GEMINI_API_KEY to the Vercel environment." }, { status: 503 });
  }

  if (isRateLimited(getClientKey(request))) {
    return NextResponse.json({ error: "Coach limit reached. Please wait a minute before trying again." }, { status: 429 });
  }

  let body: { question?: unknown; context?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid coach request." }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "Analyze this workout and tell me what to improve.";
  const context = typeof body.context === "string" ? body.context : "";
  if (!context || question.length > MAX_QUESTION_LENGTH || context.length > MAX_CONTEXT_LENGTH) {
    return NextResponse.json({ error: "The coach request is too large or missing workout context." }, { status: 400 });
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
  const prompt = `You are Jarvis Lite, a concise strength and bodybuilding coach. Analyze only the workout data provided below. Be direct, practical, and encouraging without empty praise. Discuss exercise coverage, planned-versus-completed work, effort/RIR, progression, recovery risks, and one or two next actions when the data supports them. Never diagnose illness or injury. Say when data is missing. Keep the response under 220 words and use short headings or bullets. This is coaching guidance, not medical advice.\n\nWorkout data:\n${context}\n\nUser question:\n${question}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.35, maxOutputTokens: 350 },
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("Gemini request failed", response.status, detail.slice(0, 500));
      return NextResponse.json({ error: response.status === 429 ? "Gemini quota is temporarily exhausted. Try again later." : "Gemini could not analyze this workout." }, { status: response.status === 429 ? 429 : 502 });
    }

    const data = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const answer = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
    if (!answer) return NextResponse.json({ error: "Gemini returned an empty analysis." }, { status: 502 });
    return NextResponse.json({ answer, model });
  } catch (error) {
    console.error("Gemini connection failed", error);
    return NextResponse.json({ error: "Gemini is unavailable right now. Check the Vercel deployment configuration and try again." }, { status: 502 });
  }
}
