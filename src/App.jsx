import { useState, useRef, useEffect, useCallback } from "react";
import { CONFIG } from "./config.js";
import supabase from "./supabase.js";
import { MODES, MODE_KEYS } from "./prompts.js";

/* ═══════════════════════════════════════════════════
   CONSTANTS & HELPERS
   ═══════════════════════════════════════════════════ */

const STORAGE_KEY = "kp_chats";
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const loadChats = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
};
const saveChats = (chats) => localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));

const chatTitle = (msgs) => {
  const first = msgs.find(m => m.role === "user");
  if (!first) return "Yeni Sohbet";
  const t = first.content.slice(0, 48);
  return t.length < first.content.length ? t + "…" : t;
};

const formatTime = (ts) => {
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return "Az önce";
  if (diff < 3600000) return `${Math.floor(diff/60000)}dk önce`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}sa önce`;
  if (diff < 604800000) return `${Math.floor(diff/86400000)}g önce`;
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
};

/* ═══════════════════════════════════════════════════
   FACE LOGO
   ═══════════════════════════════════════════════════ */

const FaceLogo = ({ size = 48 }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "#000", flexShrink: 0, border: "1px solid rgba(192,57,43,0.15)" }}>
    <img src="/face.jpg" alt="" style={{ width: size * 1.3, height: size * 1.3, objectFit: "cover", filter: "contrast(1.2) brightness(1.1)" }} />
  </div>
);

/* ═══════════════════════════════════════════════════
   MODE ICONS
   ═══════════════════════════════════════════════════ */

const ModeIcon = ({ mode, size = 20 }) => {
  const c = "#c0392b";
  const icons = {
    oku: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/></svg>,
    planla: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
    konus: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
    coz: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  };
  return icons[mode] || null;
};

/* ═══════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════ */

export default function App() {
  // ── Auth state ──
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [authView, setAuthView] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authErr, setAuthErr] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [initializing, setInitializing] = useState(true);

  // ── Chat state ──
  const [mode, setMode] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [inp, setInp] = useState("");
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [qc, setQc] = useState(0);
  const MX = CONFIG.FREE_LIMIT;

  // ── History state ──
  const [chatId, setChatId] = useState(null);
  const [history, setHistory] = useState([]);
  const [sidebar, setSidebar] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const eRef = useRef(null);
  const tRef = useRef(null);

  // ── Init ──
  useEffect(() => {
    setHistory(loadChats());
    const check = async () => {
      const hash = window.location.hash;
      if (hash.includes("access_token")) {
        const params = new URLSearchParams(hash.replace("#", ""));
        const at = params.get("access_token");
        if (at) {
          try {
            const u = await supabase.getUser(at);
            if (u?.id) { setUser(u); setToken(at); const p = await supabase.getProfile(u.id, at); if (p) { setQc(p.query_count || 0); setIsPro(p.is_pro || false); } }
          } catch {}
          window.location.hash = "";
        }
      }
      const stored = sessionStorage.getItem("kp_token");
      if (stored) {
        try {
          const u = await supabase.getUser(stored);
          if (u?.id) { setUser(u); setToken(stored); const p = await supabase.getProfile(u.id, stored); if (p) { setQc(p.query_count || 0); setIsPro(p.is_pro || false); } }
        } catch {}
      }
      setInitializing(false);
    };
    check();
  }, []);

  useEffect(() => { if (token) sessionStorage.setItem("kp_token", token); }, [token]);
  useEffect(() => { eRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy, streaming]);

  // ── Save chat to localStorage ──
  useEffect(() => {
    if (!chatId || !mode || msgs.length === 0) return;
    setHistory(prev => {
      const exists = prev.findIndex(c => c.id === chatId);
      const entry = { id: chatId, mode, title: chatTitle(msgs), msgs, ts: Date.now() };
      let next;
      if (exists >= 0) { next = [...prev]; next[exists] = entry; }
      else { next = [entry, ...prev]; }
      if (next.length > 50) next = next.slice(0, 50);
      saveChats(next);
      return next;
    });
  }, [msgs, chatId, mode]);

  const rsz = useCallback(() => { const t = tRef.current; if (t) { t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 150) + "px"; } }, []);

  // ── Auth ──
  const handleAuth = async () => {
    if (!authEmail || !authPass) return;
    setAuthLoading(true); setAuthErr("");
    try {
      const fn = authView === "signup" ? supabase.signUp : supabase.signIn;
      const result = await fn.call(supabase, authEmail, authPass);
      if (result.error) { setAuthErr(result.error.message || result.error_description || "Hata."); }
      else if (result.access_token) {
        setToken(result.access_token);
        const u = await supabase.getUser(result.access_token);
        setUser(u);
        const p = await supabase.getProfile(u.id, result.access_token);
        if (p) { setQc(p.query_count || 0); setIsPro(p.is_pro || false); }
      } else if (authView === "signup") { setAuthErr("Kayıt başarılı! E-postanı doğrula ve giriş yap."); setAuthView("login"); }
    } catch { setAuthErr("Bağlantı hatası."); }
    setAuthLoading(false);
  };

  const handleLogout = () => { setUser(null); setToken(null); setMode(null); setMsgs([]); setChatId(null); sessionStorage.removeItem("kp_token"); };

  // ── Send message ──
  const send = async () => {
    if (!inp.trim() || busy || !mode) return;
    if (!isPro && qc >= MX) return;
    if (!chatId) setChatId(uid());
    const um = { role: "user", content: inp.trim() };
    const all = [...msgs, um];
    setMsgs(all); setInp(""); setBusy(true); setStreaming("");
    if (tRef.current) tRef.current.style.height = "auto";
    try {
      const ac = new AbortController();
      const to = setTimeout(() => ac.abort(), 90000);
      const r = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 2048, stream: true, system: MODES[mode].sys, messages: all.map(m => ({ role: m.role, content: m.content })) }),
        signal: ac.signal,
      });
      clearTimeout(to);
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e?.error?.message || `${r.status}`); }
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let acc = "", buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try { const p = JSON.parse(data); if (p.type === "content_block_delta" && p.delta?.type === "text_delta") { acc += p.delta.text; setStreaming(acc); } } catch {}
        }
      }
      if (acc) { setMsgs(prev => [...prev, { role: "assistant", content: acc }]); const nc = qc + 1; setQc(nc); if (user && token) supabase.updateQueryCount(user.id, nc, token).catch(() => {}); }
      else { setMsgs(prev => [...prev, { role: "assistant", content: "Yanıt alınamadı." }]); }
      setStreaming("");
    } catch (e) { setStreaming(""); setMsgs(p => [...p, { role: "assistant", content: e.name === "AbortError" ? "Zaman aşımı." : e.message }]); }
    setBusy(false);
  };

  // ── Navigation ──
  const startNew = (m) => { setMode(m); setMsgs([]); setChatId(uid()); setStreaming(""); setSidebar(false); };
  const openChat = (chat) => { setMode(chat.mode); setMsgs(chat.msgs); setChatId(chat.id); setStreaming(""); setSidebar(false); };
  const deleteChat = (id) => {
    setHistory(prev => { const next = prev.filter(c => c.id !== id); saveChats(next); return next; });
    if (chatId === id) { setMode(null); setMsgs([]); setChatId(null); }
    setDeleteConfirm(null);
  };
  const clearAll = () => { setHistory([]); saveChats([]); setMode(null); setMsgs([]); setChatId(null); };
  const openShopier = () => { const url = user?.email ? `${CONFIG.SHOPIER_URL}?email=${encodeURIComponent(user.email)}` : CONFIG.SHOPIER_URL; window.open(url, "_blank"); };
  const limitReached = !isPro && qc >= MX;

  // ── Render helpers ──
  const renderText = (txt) => txt.split("\n").map((ln, j) => {
    const isBold = /^\*\*(.+)\*\*$/.test(ln.trim());
    const isHeader = /^(\d+\.)?\s*[A-ZÇĞİÖŞÜ\s]{4,}/.test(ln.trim());
    const isNum = /^\d+\./.test(ln.trim());
    if (isBold) return <p key={j} className="msg-bold">{ln.trim().replace(/\*\*/g, "")}</p>;
    if (isHeader) return <p key={j} className="msg-header">{ln}</p>;
    if (isNum) return <p key={j} className="msg-num">{ln}</p>;
    return <p key={j} className="msg-text">{ln || "\u00A0"}</p>;
  });

  /* ═══ LOADING ═══ */
  if (initializing) return (
    <div className="kp-root kp-center"><div className="init-pulse"><FaceLogo size={52} /></div><style>{CSS}</style></div>
  );

  /* ═══ AUTH ═══ */
  if (!user) return (
    <div className="kp-root kp-center">
      <div className="auth-box">
        <div className="auth-glow" />
        <FaceLogo size={60} />
        <h1 className="auth-title">KARAPSİKO</h1>
        <p className="auth-sub">GÖLGE DANIŞMAN</p>
        <div className="divider" />
        <div className="auth-form">
          <input type="email" placeholder="E-posta" value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="auth-input" autoComplete="email" />
          <input type="password" placeholder="Şifre" value={authPass} onChange={e => setAuthPass(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleAuth(); }} className="auth-input" autoComplete="current-password" />
          {authErr && <p className="auth-err">{authErr}</p>}
          <button onClick={handleAuth} disabled={authLoading} className="btn-primary">
            {authLoading ? <span className="spinner" /> : authView === "login" ? "Giriş Yap" : "Kayıt Ol"}
          </button>
          <button onClick={() => supabase.signInWithGoogle()} className="btn-google">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Google ile Giriş
          </button>
          <button onClick={() => { setAuthView(authView === "login" ? "signup" : "login"); setAuthErr(""); }} className="auth-toggle">
            {authView === "login" ? "Hesabın yok mu? Kayıt ol" : "Zaten hesabın var? Giriş yap"}
          </button>
        </div>
      </div>
      <style>{CSS}</style>
    </div>
  );

  /* ═══ HOME ═══ */
  if (!mode) return (
    <div className="kp-root">
      <div className="topbar">
        <button className="topbar-menu" onClick={() => setSidebar(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5" strokeLinecap="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
          {history.length > 0 && <span className="badge">{history.length}</span>}
        </button>
        <div className="topbar-center"><FaceLogo size={22} /><span className="topbar-brand">KARAPSİKO</span></div>
        <div className="topbar-right">
          {isPro && <span className="pro-tag">PRO</span>}
          <button onClick={handleLogout} className="topbar-logout">Çıkış</button>
        </div>
      </div>

      <div className="home-scroll">
        <div className="hero">
          <div className="hero-glow" />
          <FaceLogo size={80} />
          <h1 className="hero-title">KARAPSİKO</h1>
          <p className="hero-sub">GÖLGE DANIŞMAN</p>
          <div className="divider" />
          <p className="hero-tag">Gücü elinde tut.</p>
        </div>

        <div className="mode-grid">
          {MODE_KEYS.map((k, i) => (
            <button key={k} className="mode-card" onClick={() => startNew(k)} style={{ animationDelay: `${i * 0.06}s` }}>
              <ModeIcon mode={k} size={22} />
              <span className="mode-label">{MODES[k].label}</span>
              <span className="mode-desc">{MODES[k].desc}</span>
            </button>
          ))}
        </div>

        {!isPro && (
          <div className="usage-box">
            <span className="usage-num">{qc}/{MX}</span>
            <div className="usage-track"><div className="usage-fill" style={{ width: `${Math.min((qc/MX)*100,100)}%` }} /></div>
            {limitReached && <button onClick={openShopier} className="btn-pro">PRO — {CONFIG.PRO_PRICE}</button>}
          </div>
        )}
        {isPro && <p className="pro-label-home">PRO — SINIRSIZ ERİŞİM</p>}

        {history.length > 0 && (
          <div className="recent">
            <div className="recent-head">
              <span className="recent-label">SON SOHBETLER</span>
              <button onClick={() => setSidebar(true)} className="recent-all">Tümü →</button>
            </div>
            {history.slice(0, 4).map(c => (
              <button key={c.id} className="recent-row" onClick={() => openChat(c)}>
                <div className="recent-icon"><ModeIcon mode={c.mode} size={14} /></div>
                <div className="recent-body">
                  <span className="recent-title">{c.title}</span>
                  <span className="recent-meta">{MODES[c.mode]?.label} · {formatTime(c.ts)}</span>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            ))}
          </div>
        )}
      </div>

      {sidebar && <Sidebar history={history} onOpen={openChat} onDelete={(id) => setDeleteConfirm(id)} onClear={clearAll} onClose={() => setSidebar(false)} deleteConfirm={deleteConfirm} onConfirmDelete={deleteChat} onCancelDelete={() => setDeleteConfirm(null)} />}
      <style>{CSS}</style>
    </div>
  );

  /* ═══ CHAT ═══ */
  const c = MODES[mode];
  return (
    <div className="kp-root">
      <div className="chat-hdr">
        <button onClick={() => { setMode(null); setMsgs([]); setChatId(null); }} className="hdr-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <div className="hdr-center"><ModeIcon mode={mode} size={16} /><span className="hdr-title">{c.label}</span></div>
        <button onClick={() => startNew(mode)} className="hdr-btn" title="Yeni sohbet">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
        </button>
      </div>

      <div className="tabs">
        {MODE_KEYS.map(k => (
          <button key={k} className={`tab ${k === mode ? "on" : ""}`} onClick={() => startNew(k)}>{MODES[k].label}</button>
        ))}
      </div>

      <div className="chat-area">
        {msgs.length === 0 && !streaming && (
          <div className="empty">
            <ModeIcon mode={mode} size={36} />
            <p className="empty-title">{c.desc}</p>
            <p className="empty-hint">{c.ph}</p>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.role === "assistant" && <div className="msg-tag">KARAPSİKO</div>}
            <div className="msg-body">{renderText(m.content)}</div>
          </div>
        ))}
        {busy && streaming && (
          <div className="msg assistant"><div className="msg-tag">KARAPSİKO</div><div className="msg-body">{renderText(streaming)}<span className="cursor">|</span></div></div>
        )}
        {busy && !streaming && (
          <div className="msg assistant"><div className="msg-tag">KARAPSİKO</div><div className="dots"><span/><span/><span/></div></div>
        )}
        <div ref={eRef} />
      </div>

      <div className="input-wrap">
        {limitReached ? (
          <div className="limit-box"><p className="limit-text">Ücretsiz sorgu limitin doldu.</p><button onClick={openShopier} className="btn-pro">PRO — {CONFIG.PRO_PRICE}</button></div>
        ) : (
          <div className="input-row">
            <textarea ref={tRef} value={inp} onChange={e => { setInp(e.target.value); rsz(); }} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={c.ph} className="input-ta" rows={1} />
            <button onClick={send} disabled={!inp.trim() || busy} className="send-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
            </button>
          </div>
        )}
      </div>

      {sidebar && <Sidebar history={history} onOpen={openChat} onDelete={(id) => setDeleteConfirm(id)} onClear={clearAll} onClose={() => setSidebar(false)} deleteConfirm={deleteConfirm} onConfirmDelete={deleteChat} onCancelDelete={() => setDeleteConfirm(null)} />}
      <style>{CSS}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   SIDEBAR
   ═══════════════════════════════════════════════════ */

function Sidebar({ history, onOpen, onDelete, onClear, onClose, deleteConfirm, onConfirmDelete, onCancelDelete }) {
  return (
    <>
      <div className="sb-overlay" onClick={onClose} />
      <div className="sb">
        <div className="sb-hdr">
          <span className="sb-title">Sohbet Geçmişi</span>
          <button onClick={onClose} className="sb-close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="sb-list">
          {history.length === 0 && <p className="sb-empty">Henüz sohbet yok.</p>}
          {[...history].sort((a,b) => b.ts - a.ts).map(ch => (
            <div key={ch.id} className="sb-item">
              {deleteConfirm === ch.id ? (
                <div className="sb-confirm">
                  <span className="sb-confirm-text">Silinsin mi?</span>
                  <button onClick={() => onConfirmDelete(ch.id)} className="sb-yes">Evet</button>
                  <button onClick={onCancelDelete} className="sb-no">İptal</button>
                </div>
              ) : (
                <>
                  <button className="sb-btn" onClick={() => onOpen(ch)}>
                    <ModeIcon mode={ch.mode} size={14} />
                    <div className="sb-btn-body">
                      <span className="sb-btn-title">{ch.title}</span>
                      <span className="sb-btn-meta">{MODES[ch.mode]?.label} · {formatTime(ch.ts)}</span>
                    </div>
                  </button>
                  <button className="sb-del" onClick={() => onDelete(ch.id)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="1.5" strokeLinecap="round"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
        {history.length > 0 && (
          <div className="sb-foot"><button onClick={onClear} className="sb-clear">Tümünü Sil</button></div>
        )}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════ */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --bg: #060608;
  --sf: #0c0c10;
  --sf2: #111116;
  --bd: #18181f;
  --bd2: #222230;
  --tx: #e8e4e0;
  --tx2: #888;
  --tx3: #444;
  --ac: #c0392b;
  --ac-dim: rgba(192,57,43,0.1);
  --ac-glow: rgba(192,57,43,0.06);
  --ff: 'Sora', -apple-system, sans-serif;
  --mono: 'JetBrains Mono', monospace;
  --r: 12px;
}
*{box-sizing:border-box;margin:0;padding:0}
html,body,#root{height:100%;overflow:hidden}

.kp-root{width:100%;height:100vh;background:var(--bg);display:flex;flex-direction:column;font-family:var(--ff);color:var(--tx);overflow:hidden;position:relative}
.kp-center{align-items:center;justify-content:center}

/* Init */
.init-pulse{animation:pulse 2s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:.4;transform:scale(.95)}50%{opacity:1;transform:scale(1)}}

/* Shared */
.divider{width:32px;height:1px;background:var(--bd);margin:20px 0}
.spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite;display:inline-block}
@keyframes spin{to{transform:rotate(360deg)}}

/* ══ AUTH ══ */
.auth-box{display:flex;flex-direction:column;align-items:center;padding:32px 28px;max-width:360px;width:100%;position:relative}
.auth-glow{position:absolute;top:-80px;left:50%;transform:translateX(-50%);width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,var(--ac-glow) 0%,transparent 70%);pointer-events:none}
.auth-title{font-size:26px;font-weight:700;letter-spacing:10px;margin-top:20px}
.auth-sub{font-size:10px;font-weight:500;letter-spacing:6px;color:var(--ac);margin-top:4px}
.auth-form{width:100%;display:flex;flex-direction:column;gap:10px}
.auth-input{background:var(--sf);border:1px solid var(--bd);border-radius:var(--r);padding:14px 16px;color:var(--tx);font-size:13px;font-family:var(--ff);outline:none;transition:border-color .2s}
.auth-input:focus{border-color:var(--ac)}
.auth-input::placeholder{color:var(--tx3)}
.btn-primary{padding:14px;background:var(--ac);color:#fff;border:none;border-radius:var(--r);font-size:13px;font-weight:600;letter-spacing:1.5px;cursor:pointer;font-family:var(--ff);transition:opacity .2s;display:flex;align-items:center;justify-content:center}
.btn-primary:hover{opacity:.9}.btn-primary:disabled{opacity:.5}
.btn-google{padding:14px;background:var(--sf2);color:var(--tx2);border:1px solid var(--bd);border-radius:var(--r);font-size:13px;font-weight:500;cursor:pointer;font-family:var(--ff);display:flex;align-items:center;justify-content:center;gap:8px;transition:border-color .2s}
.btn-google:hover{border-color:var(--bd2)}
.auth-toggle{background:none;border:none;color:var(--tx3);font-size:12px;cursor:pointer;padding:8px;font-family:var(--ff)}
.auth-toggle:hover{color:var(--tx2)}
.auth-err{color:var(--ac);font-size:12px;text-align:center}

/* ══ TOPBAR ══ */
.topbar{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--bd);background:var(--bg);position:relative;z-index:10;flex-shrink:0}
.topbar-menu{background:none;border:none;cursor:pointer;padding:4px;display:flex;align-items:center;position:relative}
.badge{position:absolute;top:-4px;right:-6px;background:var(--ac);color:#fff;font-size:8px;font-weight:700;width:16px;height:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:var(--mono)}
.topbar-center{display:flex;align-items:center;gap:8px}
.topbar-brand{font-size:12px;font-weight:700;letter-spacing:3px}
.topbar-right{display:flex;align-items:center;gap:8px}
.pro-tag{font-size:9px;font-weight:700;color:var(--ac);letter-spacing:2px;border:1px solid var(--ac);border-radius:4px;padding:2px 6px;font-family:var(--mono)}
.topbar-logout{background:none;border:none;color:var(--tx3);font-size:11px;cursor:pointer;font-family:var(--ff)}
.topbar-logout:hover{color:var(--tx2)}

/* ══ HOME ══ */
.home-scroll{flex:1;overflow-y:auto;display:flex;flex-direction:column;align-items:center;padding:20px 20px 40px;gap:28px}
.hero{text-align:center;display:flex;flex-direction:column;align-items:center;position:relative;padding-top:8px}
.hero-glow{position:absolute;top:-40px;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,var(--ac-glow) 0%,transparent 70%);pointer-events:none}
.hero-title{font-size:28px;font-weight:700;letter-spacing:10px;margin-top:16px}
.hero-sub{font-size:10px;font-weight:500;letter-spacing:6px;color:var(--ac);margin-top:4px}
.hero-tag{font-size:13px;color:var(--tx3);font-style:italic;letter-spacing:.5px}

.mode-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%;max-width:340px}
.mode-card{background:var(--sf);border:1px solid var(--bd);border-radius:var(--r);padding:20px 14px;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;transition:all .25s;text-align:center;animation:cardIn .4s ease-out both}
.mode-card:hover{border-color:var(--ac);background:var(--ac-dim);transform:translateY(-2px)}
@keyframes cardIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.mode-label{font-size:14px;font-weight:700;letter-spacing:2px}
.mode-desc{font-size:11px;color:var(--tx3);letter-spacing:.3px}

.usage-box{width:100%;max-width:340px;display:flex;flex-direction:column;align-items:center;gap:6px}
.usage-num{font-size:11px;color:var(--tx3);letter-spacing:1px;font-weight:500;font-family:var(--mono)}
.usage-track{width:100%;height:2px;background:var(--sf2);border-radius:1px;overflow:hidden}
.usage-fill{height:100%;background:var(--ac);border-radius:1px;transition:width .4s}
.btn-pro{margin-top:8px;padding:12px 28px;background:var(--ac);color:#fff;border:none;border-radius:var(--r);font-size:12px;font-weight:700;letter-spacing:1.5px;cursor:pointer;font-family:var(--ff);transition:opacity .2s}
.btn-pro:hover{opacity:.9}
.pro-label-home{font-size:11px;color:var(--tx3);letter-spacing:2px}

/* Recent */
.recent{width:100%;max-width:340px;display:flex;flex-direction:column;gap:6px}
.recent-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}
.recent-label{font-size:10px;font-weight:600;color:var(--tx3);letter-spacing:2.5px}
.recent-all{background:none;border:none;color:var(--ac);font-size:11px;cursor:pointer;font-family:var(--ff);font-weight:500}
.recent-row{display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--sf);border:1px solid var(--bd);border-radius:10px;cursor:pointer;transition:all .2s;text-align:left;width:100%}
.recent-row:hover{border-color:var(--bd2);background:var(--sf2)}
.recent-icon{flex-shrink:0;opacity:.5}
.recent-body{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.recent-title{font-size:12.5px;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:var(--ff)}
.recent-meta{font-size:10px;color:var(--tx3);font-family:var(--mono)}

/* ══ CHAT ══ */
.chat-hdr{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--bd);background:var(--bg);flex-shrink:0}
.hdr-btn{background:none;border:none;cursor:pointer;padding:6px;display:flex;align-items:center;border-radius:8px;transition:background .15s}
.hdr-btn:hover{background:var(--sf)}
.hdr-center{display:flex;align-items:center;gap:8px}
.hdr-title{font-size:13px;font-weight:700;letter-spacing:2.5px}

.tabs{display:flex;border-bottom:1px solid var(--bd);background:var(--bg);flex-shrink:0}
.tab{flex:1;padding:10px 0;background:none;border:none;border-bottom:2px solid transparent;font-size:11px;font-weight:600;letter-spacing:1.5px;cursor:pointer;transition:all .2s;text-align:center;color:var(--tx3);font-family:var(--ff)}
.tab.on{color:var(--tx);border-bottom-color:var(--ac)}
.tab:hover:not(.on){color:var(--tx2)}

.chat-area{flex:1;overflow-y:auto;padding:16px 14px;display:flex;flex-direction:column;gap:12px}
.empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;opacity:.25}
.empty-title{font-size:14px;color:var(--tx2);font-weight:500;letter-spacing:1px}
.empty-hint{font-size:12px;color:var(--tx3);text-align:center;max-width:260px;line-height:1.6}

.msg{max-width:88%;animation:msgIn .25s ease-out}
.msg.user{align-self:flex-end;background:var(--sf2);border:1px solid var(--bd);border-radius:14px 14px 4px 14px;padding:11px 15px}
.msg.assistant{align-self:flex-start;background:linear-gradient(165deg,rgba(14,8,8,.95),rgba(20,10,10,.95));border:1px solid rgba(192,57,43,.06);border-radius:14px 14px 14px 4px;padding:13px 15px}
@keyframes msgIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}

.msg-tag{font-size:8px;font-weight:700;color:var(--ac);letter-spacing:3px;margin-bottom:8px;font-family:var(--mono)}
.msg-body{font-size:13.5px;line-height:1.75;color:#bbb}
.msg-header{margin:0 0 4px;font-weight:700;color:var(--ac);font-size:12px;letter-spacing:1px}
.msg-bold{margin:0 0 4px;font-weight:700;color:var(--tx);font-size:13.5px}
.msg-num{margin:0 0 4px;color:#bbb;font-size:13.5px}
.msg-text{margin:0 0 4px;color:#bbb;font-size:13.5px}

.dots{display:flex;gap:5px;padding:4px 0}
.dots span{display:inline-block;width:5px;height:5px;border-radius:50%;background:var(--ac)}
.dots span:nth-child(1){animation:dot 1.4s infinite 0s}
.dots span:nth-child(2){animation:dot 1.4s infinite .15s}
.dots span:nth-child(3){animation:dot 1.4s infinite .3s}
@keyframes dot{0%,80%,100%{opacity:.2;transform:scale(.8)}40%{opacity:1;transform:scale(1.3)}}
.cursor{color:var(--ac);animation:blink 1s infinite;font-weight:300;font-size:14px}
@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}

.input-wrap{padding:10px 12px 14px;border-top:1px solid var(--bd);background:var(--bg);flex-shrink:0}
.input-row{display:flex;align-items:flex-end;gap:8px;background:var(--sf);border:1px solid var(--bd);border-radius:var(--r);padding:8px 12px;transition:border-color .2s}
.input-row:focus-within{border-color:var(--bd2)}
.input-ta{flex:1;background:transparent;border:none;outline:none;color:var(--tx);font-size:13.5px;font-family:var(--ff);line-height:1.5;resize:none;max-height:150px;padding:3px 0}
.input-ta::placeholder{color:var(--tx3)}
.send-btn{width:34px;height:34px;border-radius:50%;background:var(--ac);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .2s}
.send-btn:disabled{opacity:.15;cursor:default}
.send-btn:not(:disabled):hover{transform:scale(1.05)}

.limit-box{text-align:center;padding:6px 0}
.limit-text{font-size:12px;color:var(--tx3);margin-bottom:8px}

/* ══ SIDEBAR ══ */
.sb-overlay{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:100;animation:fadeIn .2s}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.sb{position:fixed;top:0;left:0;bottom:0;width:300px;max-width:85vw;background:var(--sf);border-right:1px solid var(--bd);z-index:101;display:flex;flex-direction:column;animation:slideIn .25s ease-out}
@keyframes slideIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}
.sb-hdr{display:flex;align-items:center;justify-content:space-between;padding:16px 16px 12px;border-bottom:1px solid var(--bd)}
.sb-title{font-size:13px;font-weight:700;letter-spacing:2px}
.sb-close{background:none;border:none;cursor:pointer;padding:4px;display:flex}
.sb-list{flex:1;overflow-y:auto;padding:8px}
.sb-empty{font-size:12px;color:var(--tx3);text-align:center;padding:24px}
.sb-item{border-radius:8px;overflow:hidden;display:flex;align-items:center}
.sb-item:hover{background:var(--sf2)}
.sb-btn{display:flex;align-items:center;gap:10px;padding:10px;background:none;border:none;cursor:pointer;width:100%;text-align:left;color:var(--tx);flex:1;min-width:0}
.sb-btn-body{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.sb-btn-title{font-size:12.5px;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:var(--ff)}
.sb-btn-meta{font-size:10px;color:var(--tx3);font-family:var(--mono)}
.sb-del{background:none;border:none;cursor:pointer;padding:8px;opacity:0;transition:opacity .2s;flex-shrink:0}
.sb-item:hover .sb-del{opacity:1}
.sb-del:hover svg{stroke:var(--ac)}
.sb-confirm{display:flex;align-items:center;gap:8px;padding:10px;font-family:var(--ff);width:100%}
.sb-confirm-text{font-size:12px;color:var(--tx2);flex:1}
.sb-yes{background:var(--ac);color:#fff;border:none;border-radius:6px;padding:5px 12px;font-size:11px;font-weight:600;cursor:pointer;font-family:var(--ff)}
.sb-no{background:var(--sf);color:var(--tx3);border:1px solid var(--bd);border-radius:6px;padding:5px 12px;font-size:11px;cursor:pointer;font-family:var(--ff)}
.sb-foot{padding:12px 16px;border-top:1px solid var(--bd)}
.sb-clear{background:none;border:none;color:var(--ac);font-size:11px;cursor:pointer;font-family:var(--ff);letter-spacing:.5px}
.sb-clear:hover{text-decoration:underline}

/* Scrollbar */
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:var(--bd);border-radius:4px}
::-webkit-scrollbar-thumb:hover{background:var(--bd2)}

/* Mobile */
@media(max-width:420px){
  .hero-title{font-size:22px;letter-spacing:8px}
  .mode-grid{gap:8px}
  .mode-card{padding:16px 10px}
}
`;
