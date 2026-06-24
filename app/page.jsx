"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, Plus, X, Sparkles, Music, Loader2, Star } from "lucide-react";

// ---- Theme: late-night KTV booth. Deep plum stage, neon mic glow. ----
const PALETTE = {
  bg: "#1a0f2e",
  bgDeep: "#120a21",
  surface: "#26183f",
  surfaceHi: "#311e4f",
  cream: "#f3e9ff",
  muted: "#a690c7",
  line: "#3d2a5c",
};

const PROFILES = [
  { id: "momo", name: "Momo", color: "#ff3d8b" },
  { id: "kai", name: "Kai", color: "#ffd166" },
  { id: "kanon", name: "Kanon", color: "#2de2e6" },
  { id: "clark", name: "CLARK", color: "#b084ff" },
];

const DB_KEY = "karaoke-db-v1";
const uid = () => Math.random().toString(36).slice(2, 9);

// ---- Bilingual labels (English / 日本語) ----
const STRINGS = {
  nowOnStage: ["Now on stage", "ただいま熱唱中"],
  tagline: [
    "Tap a singer, log a song they crush, and get fresh picks for the queue.",
    "歌い手を選んで、得意な曲を記録。次の一曲もおすすめします。",
  ],
  crushes: ["A song {name} crushes", "{name}の十八番"],
  songTitle: ["Song title", "曲名"],
  artist: ["Artist (optional)", "アーティスト（任意）"],
  add: ["Add", "追加"],
  wouldNail: ["More {name} would nail", "{name}におすすめの曲"],
  sugError: [
    "Couldn't load suggestions — give it another go.",
    "おすすめを取得できませんでした。もう一度お試しください。",
  ],
  setlist: ["{name}'S SETLIST", "{name}のセットリスト"],
  suggest: ["Suggest picks", "おすすめ"],
  emptyTitle: [
    "No songs yet. Add the first one {name} owns on the mic.",
    "まだ曲がありません。{name}の得意な一曲を追加しましょう。",
  ],
  saved: [
    "Saved automatically — your setlists are here next time too.",
    "自動保存されます。次回もセットリストはそのまま。",
  ],
};

const songCount = (n, jp) => (jp ? `${n}曲` : `${n} ${n === 1 ? "song" : "songs"}`);

// Detect Japanese text (hiragana / katakana / kanji / halfwidth kana)
const isJa = (s) => /[぀-ヿ一-龯ｦ-ﾟ]/.test(s || "");

const FONT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700&family=Noto+Sans+JP:wght@500;700&display=swap');
`;

export default function KaraokeApp() {
  const [db, setDb] = useState(null); // { momo:{songs:[]}, ... }
  const [active, setActive] = useState("momo");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSug, setLoadingSug] = useState(false);
  const [sugError, setSugError] = useState("");
  const [jp, setJp] = useState(false);
  const titleRef = useRef(null);

  // t("crushes", { name }) -> localized string with {name} filled in
  const t = (key, vars = {}) => {
    let s = STRINGS[key][jp ? 1 : 0];
    Object.entries(vars).forEach(([k, v]) => (s = s.replace(`{${k}}`, v)));
    return s;
  };

  // ---- Load the saved database on mount ----
  useEffect(() => {
    let data = null;
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (raw) data = JSON.parse(raw);
    } catch (e) {
      /* first run — no key yet */
    }
    if (!data) {
      data = {};
      PROFILES.forEach((p) => (data[p.id] = { songs: [] }));
    }
    PROFILES.forEach((p) => {
      if (!data[p.id]) data[p.id] = { songs: [] };
    });
    setDb(data);
  }, []);

  const persist = (next) => {
    setDb(next);
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(next));
    } catch (e) {
      console.error("Could not save setlist:", e);
    }
  };

  const profile = PROFILES.find((p) => p.id === active);
  const songs = db?.[active]?.songs ?? [];

  const addSong = (t, a) => {
    const cleanT = t.trim();
    if (!cleanT || !db) return;
    const song = { id: uid(), title: cleanT, artist: a.trim(), addedAt: Date.now() };
    const next = {
      ...db,
      [active]: { songs: [song, ...(db[active]?.songs ?? [])] },
    };
    persist(next);
  };

  const removeSong = (id) => {
    const next = {
      ...db,
      [active]: { songs: db[active].songs.filter((s) => s.id !== id) },
    };
    persist(next);
  };

  const handleAdd = () => {
    if (!title.trim()) return;
    addSong(title, artist);
    getSuggestions(title, artist);
    setTitle("");
    setArtist("");
    titleRef.current?.focus();
  };

  // ---- AI song suggestions (Claude, via our serverless API route) ----
  const getSuggestions = async (sTitle, sArtist) => {
    setLoadingSug(true);
    setSugError("");
    setSuggestions([]);

    const setlist = db?.[active]?.songs ?? [];
    // Ask for Japanese picks if JP mode is on, or anything in play looks Japanese.
    const useJp = jp || isJa(sTitle) || setlist.some((s) => isJa(s.title));

    const current = setlist
      .slice(0, 8)
      .map((s) => `${s.title}${s.artist ? " — " + s.artist : ""}`)
      .join("; ");
    const seed = sTitle ? `"${sTitle}"${sArtist ? " by " + sArtist : ""}` : "their setlist";

    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name,
          seed,
          current,
          useJp,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "request failed");
      const list = Array.isArray(data.suggestions) ? data.suggestions : [];
      if (list.length === 0) throw new Error("empty");
      setSuggestions(list);
    } catch (e) {
      setSugError(t("sugError"));
    } finally {
      setLoadingSug(false);
    }
  };

  if (!db) {
    return (
      <div style={{ background: PALETTE.bgDeep, color: PALETTE.cream }} className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" size={28} />
      </div>
    );
  }

  return (
    <div
      style={{
        background: `radial-gradient(1100px 500px at 50% -10%, ${PALETTE.surface} 0%, ${PALETTE.bg} 45%, ${PALETTE.bgDeep} 100%)`,
        color: PALETTE.cream,
        fontFamily: "Inter, 'Noto Sans JP', system-ui, sans-serif",
        minHeight: "100vh",
      }}
    >
      <style>{FONT_CSS}</style>
      <style>{`
        @keyframes glowPulse { 0%,100%{opacity:.85} 50%{opacity:1} }
        @keyframes popIn { from{opacity:0; transform:translateY(6px) scale(.98)} to{opacity:1; transform:none} }
        .song-row{ animation: popIn .25s ease both; }
        .lift{ transition: transform .15s ease, box-shadow .15s ease; }
        .lift:hover{ transform: translateY(-2px); }
        input::placeholder{ color:${PALETTE.muted}; }
        @media (prefers-reduced-motion: reduce){ *{animation:none!important} }
      `}</style>

      <div className="max-w-3xl mx-auto px-5 py-8">
        {/* ---- Language toggle ---- */}
        <div className="flex justify-end mb-2">
          <button
            onClick={() => setJp((v) => !v)}
            className="lift rounded-full px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5"
            style={{ background: PALETTE.surface, border: `1px solid ${profile.color}66`, color: profile.color }}
          >
            <span style={{ opacity: jp ? 0.5 : 1 }}>EN</span>
            <span style={{ opacity: 0.4 }}>/</span>
            <span style={{ opacity: jp ? 1 : 0.5 }}>日本語</span>
          </button>
        </div>

        {/* ---- Marquee header (the signature) ---- */}
        <div className="flex flex-col items-center text-center mb-8">
          <div
            className="flex items-center gap-2 px-4 py-1 rounded-full mb-4"
            style={{ border: `1px solid ${profile.color}55`, color: profile.color, animation: "glowPulse 2.6s ease-in-out infinite" }}
          >
            <Mic size={14} />
            <span className="text-xs font-semibold tracking-widest uppercase">{t("nowOnStage")}</span>
          </div>
          <h1
            style={{
              fontFamily: "Anton, sans-serif",
              fontSize: "clamp(2.6rem, 9vw, 4.6rem)",
              lineHeight: 0.92,
              letterSpacing: "0.02em",
              textShadow: `0 0 30px ${profile.color}66, 0 0 8px ${profile.color}88`,
              color: PALETTE.cream,
            }}
          >
            {jp ? "ファミリーカラオケ" : "FAMILY KARAOKE"}
          </h1>
          <p style={{ color: PALETTE.muted }} className="mt-3 text-sm">
            {t("tagline")}
          </p>
        </div>

        {/* ---- Singer selector ---- */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          {PROFILES.map((p) => {
            const isOn = p.id === active;
            const count = db[p.id]?.songs?.length ?? 0;
            return (
              <button
                key={p.id}
                onClick={() => {
                  setActive(p.id);
                  setSuggestions([]);
                  setSugError("");
                }}
                className="lift rounded-2xl py-4 px-2 flex flex-col items-center gap-2"
                style={{
                  background: isOn ? PALETTE.surfaceHi : PALETTE.surface,
                  border: `1px solid ${isOn ? p.color : PALETTE.line}`,
                  boxShadow: isOn ? `0 10px 30px -10px ${p.color}99` : "none",
                  outline: "none",
                }}
              >
                <span
                  className="flex items-center justify-center rounded-full font-bold"
                  style={{
                    width: 46,
                    height: 46,
                    fontFamily: "Anton, sans-serif",
                    fontSize: 20,
                    color: PALETTE.bgDeep,
                    background: p.color,
                    boxShadow: isOn ? `0 0 18px ${p.color}aa` : "none",
                  }}
                >
                  {p.name[0]}
                </span>
                <span className="text-xs font-semibold truncate w-full text-center" style={{ color: isOn ? PALETTE.cream : PALETTE.muted }}>
                  {p.name}
                </span>
                <span className="text-[10px]" style={{ color: PALETTE.muted }}>
                  {songCount(count, jp)}
                </span>
              </button>
            );
          })}
        </div>

        {/* ---- Add a song ---- */}
        <div
          className="rounded-2xl p-4 mb-6"
          style={{ background: PALETTE.surface, border: `1px solid ${PALETTE.line}` }}
        >
          <div className="flex items-center gap-2 mb-3" style={{ color: profile.color }}>
            <Star size={15} />
            <span className="text-sm font-semibold">{t("crushes", { name: profile.name })}</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder={t("songTitle")}
              className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: PALETTE.bgDeep, color: PALETTE.cream, border: `1px solid ${PALETTE.line}` }}
            />
            <input
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder={t("artist")}
              className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: PALETTE.bgDeep, color: PALETTE.cream, border: `1px solid ${PALETTE.line}` }}
            />
            <button
              onClick={handleAdd}
              className="lift rounded-xl px-4 py-2.5 flex items-center justify-center gap-1.5 text-sm font-bold"
              style={{ background: profile.color, color: PALETTE.bgDeep }}
            >
              <Plus size={16} /> {t("add")}
            </button>
          </div>
        </div>

        {/* ---- Suggestions ---- */}
        {(loadingSug || suggestions.length > 0 || sugError) && (
          <div className="mb-6 rounded-2xl p-4" style={{ background: PALETTE.surface, border: `1px dashed ${profile.color}77` }}>
            <div className="flex items-center gap-2 mb-3" style={{ color: profile.color }}>
              <Sparkles size={15} />
              <span className="text-sm font-semibold">{t("wouldNail", { name: profile.name })}</span>
              {loadingSug && <Loader2 size={14} className="animate-spin" />}
            </div>
            {sugError && <p className="text-xs" style={{ color: PALETTE.muted }}>{sugError}</p>}
            <div className="grid sm:grid-cols-2 gap-2">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => {
                    addSong(s.title, s.artist || "");
                    setSuggestions((prev) => prev.filter((_, j) => j !== i));
                  }}
                  className="lift text-left rounded-xl px-3 py-2.5 flex items-start gap-2"
                  style={{ background: PALETTE.bgDeep, border: `1px solid ${PALETTE.line}` }}
                >
                  <Plus size={15} style={{ color: profile.color, marginTop: 2, flexShrink: 0 }} />
                  <span>
                    <span className="block text-sm font-semibold" style={{ color: PALETTE.cream }}>{s.title}</span>
                    <span className="block text-xs" style={{ color: PALETTE.muted }}>
                      {s.artist}{s.artist && s.why ? " · " : ""}{s.why}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ---- The setlist ---- */}
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 style={{ fontFamily: "Anton, sans-serif", color: profile.color }} className="text-2xl">
            {t("setlist", { name: profile.name })}
          </h2>
          <button
            onClick={() => getSuggestions("", "")}
            disabled={loadingSug}
            className="text-xs font-semibold flex items-center gap-1.5 rounded-full px-3 py-1.5"
            style={{ color: profile.color, border: `1px solid ${profile.color}55` }}
          >
            <Sparkles size={13} /> {t("suggest")}
          </button>
        </div>

        {songs.length === 0 ? (
          <div
            className="rounded-2xl py-10 px-4 text-center"
            style={{ background: PALETTE.surface, border: `1px solid ${PALETTE.line}` }}
          >
            <Music size={26} style={{ color: PALETTE.muted, margin: "0 auto 10px" }} />
            <p className="text-sm" style={{ color: PALETTE.muted }}>
              {t("emptyTitle", { name: profile.name })}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {songs.map((s, i) => (
              <div
                key={s.id}
                className="song-row lift rounded-xl px-4 py-3 flex items-center gap-3"
                style={{ background: PALETTE.surface, border: `1px solid ${PALETTE.line}` }}
              >
                <span
                  style={{ fontFamily: "Anton, sans-serif", color: profile.color, minWidth: 26 }}
                  className="text-lg"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: PALETTE.cream }}>{s.title}</p>
                  {s.artist && <p className="text-xs truncate" style={{ color: PALETTE.muted }}>{s.artist}</p>}
                </div>
                <button onClick={() => removeSong(s.id)} className="opacity-60 hover:opacity-100" style={{ color: PALETTE.muted }}>
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-[11px] mt-8" style={{ color: PALETTE.muted }}>
          {t("saved")}
        </p>
      </div>
    </div>
  );
}
