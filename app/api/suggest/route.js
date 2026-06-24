// Serverless endpoint that asks Claude for karaoke song suggestions.
// The Anthropic API key stays on the server (set ANTHROPIC_API_KEY in Vercel).

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Server is missing ANTHROPIC_API_KEY." },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { name = "They", seed = "their setlist", current = "", useJp = false } =
    body || {};

  const jpRule = useJp
    ? ` Recommend Japanese karaoke songs only (J-pop, anime, Vocaloid, city pop, enka, etc.). Put the Japanese title in "title", and the artist plus romaji of the title in "artist". Write "why" in Japanese, under 8 characters.`
    : "";

  const prompt = `You are a karaoke song recommender. ${name} absolutely crushes ${seed}. Their current go-to songs: ${current || "none yet"}.
Suggest 4 OTHER karaoke songs they would nail, matching that vibe, energy, and vocal range. Avoid anything already in their list.${jpRule}
Respond ONLY with a raw JSON array, no markdown, no preamble. Each item: {"title":"","artist":"","why":"reason under 7 words"}.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("Anthropic API error:", res.status, detail);
      return Response.json(
        { error: "Upstream model error." },
        { status: 502 }
      );
    }

    const data = await res.json();
    if (!data || !Array.isArray(data.content)) {
      return Response.json({ error: "No content from model." }, { status: 502 });
    }

    const text = data.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    let clean = text.replace(/```json|```/g, "").trim();
    const start = clean.indexOf("[");
    const end = clean.lastIndexOf("]");
    if (start !== -1 && end !== -1) clean = clean.slice(start, end + 1);

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      return Response.json({ error: "Could not parse suggestions." }, { status: 502 });
    }
    if (!Array.isArray(parsed) && parsed && Array.isArray(parsed.songs)) {
      parsed = parsed.songs;
    }
    const list = Array.isArray(parsed)
      ? parsed.filter((s) => s && s.title).slice(0, 4)
      : [];

    return Response.json({ suggestions: list });
  } catch (e) {
    console.error("Suggestion request failed:", e);
    return Response.json({ error: "Request failed." }, { status: 500 });
  }
}
