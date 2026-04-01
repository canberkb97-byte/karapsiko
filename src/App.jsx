import { useState, useRef, useEffect, useCallback } from "react";
import { CONFIG } from "./config.js";
import supabase from "./supabase.js";
import { MODES, MODE_KEYS } from "./prompts.js";

const C = {
  bg: "#121218", bg2: "#181820", bg3: "#1e1e28", border: "#252530",
  accent: "#2dd4bf", text: "#e8e8f0", textDim: "#8888a0", textMuted: "#555566",
};

const FaceLogo = ({ size = 48 }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "#000", flexShrink: 0 }}>
    <img src="/face.jpg" alt="" style={{ width: size * 1.3, height: size * 1.3, objectFit: "cover", filter: "contrast(1.2) brightness(1.1)" }} />
  </div>
);

const Disclaimer = ({ onAccept }) => (
  <div style={DS.overlay}><div style={DS.box}>
    <FaceLogo size={40} />
    <h2 style={DS.title}>KaraPsiko</h2>
    <div style={DS.text}>
      <p>Bu uygulama bir <strong style={{ color: C.text }}>psikolojik danışmanlık, terapi veya tıbbi destek hizmeti değildir.</strong></p>
      <p>KaraPsiko yalnızca iletişim stratejileri, müzakere teknikleri ve sosyal dinamikler hakkında bilgi ve öneri sunar.</p>
      <p>Psikolojik sorunlar yaşıyorsanız lütfen bir ruh sağlığı uzmanına başvurunuz.</p>
      <p style={{ color: C.textMuted, fontSize: 11, marginTop: 12 }}>Devam ederek bu koşulları kabul etmiş olursunuz.</p>
    </div>
    <button onClick={onAccept} style={DS.btn}>Okudum, Anladım</button>
  </div></div>
);

const DS = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 20 },
  box: { background: C.bg2, border: "1px solid " + C.border, borderRadius: 16, padding: "28px 24px", maxWidth: 400, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 },
  title: { margin: 0, fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: 2 },
  text: { fontSize: 13, lineHeight: 1.7, color: C.textDim, textAlign: "center" },
  btn: { marginTop: 8, padding: "13px 40px", background: C.accent, color: "#000", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, letterSpacing: 1, cursor: "pointer", width: "100%" },
};

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [authView, setAuthView] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authErr, setAuthErr] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [mode, setMode] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [inp, setInp] = useState("");
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState("");
  const [qc, setQc] = useState(0);
  const [convos, setConvos] = useState([]);
  const [activeConvo, setActiveConvo] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const MX = CONFIG.FREE_LIMIT;
  const eRef = useRef(null);
  const tRef = useRef(null);

  useEffect(() => { if (localStorage.getItem("kp_disclaimer") === "true") setDisclaimerAccepted(true); }, []);
  const acceptDisclaimer = () => { setDisclaimerAccepted(true); localStorage.setItem("kp_disclaimer", "true"); };

  useEffect(() => {
    const check = async () => {
      const hash = window.location.hash;
      if (hash.includes("access_token")) {
        const params = new URLSearchParams(hash.replace("#", ""));
        const at = params.get("access_token");
        if (at) { try { const u = await supabase.getUser(at); if (u?.id) { setUser(u); setToken(at); const p = await supabase.getProfile(u.id, at); if (p) { setQc(p.query_count || 0); setIsPro(p.is_pro || false); } } } catch {} window.location.hash = ""; }
      }
      const stored = sessionStorage.getItem("kp_token");
      if (stored) { try { const u = await supabase.getUser(stored); if (u?.id) { setUser(u); setToken(stored); const p = await supabase.getProfile(u.id, stored); if (p) { setQc(p.query_count || 0); setIsPro(p.is_pro || false); } } } catch {} }
      setInitializing(false);
    };
    check();
  }, []);

  useEffect(() => { if (token) sessionStorage.setItem("kp_token", token); }, [token]);
  useEffect(() => { eRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy, streaming]);
  useEffect(() => { if (user && token) { supabase.getConversations(user.id, token).then(data => { if (Array.isArray(data)) setConvos(data); }).catch(() => {}); } }, [user, token]);

  const rsz = useCallback(() => { const t = tRef.current; if (t) { t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 150) + "px"; } }, []);

  const handleAuth = async () => {
    if (!authEmail || !authPass) return;
    setAuthLoading(true); setAuthErr("");
    try {
      const fn = authView === "signup" ? supabase.signUp : supabase.signIn;
      const result = await fn.call(supabase, authEmail, authPass);
      if (result.error) { setAuthErr(result.error.message || result.error_description || "Hata."); }
      else if (result.access_token) { setToken(result.access_token); const u = await supabase.getUser(result.access_token); setUser(u); const p = await supabase.getProfile(u.id, result.access_token); if (p) { setQc(p.query_count || 0); setIsPro(p.is_pro || false); } }
      else if (authView === "signup") { setAuthErr("Kayıt başarılı! E-postanı doğrula ve giriş yap."); setAuthView("login"); }
    } catch { setAuthErr("Bağlantı hatası."); }
    setAuthLoading(false);
  };

  const handleLogout = () => { setUser(null); setToken(null); setMode(null); setMsgs([]); setActiveConvo(null); setConvos([]); sessionStorage.removeItem("kp_token"); };

  const loadConvo = (conv) => { setMode(conv.mode); setMsgs(conv.messages || []); setActiveConvo(conv.id); setShowHistory(false); };

  const newChat = () => { setMsgs([]); setActiveConvo(null); };

  const deleteConvo = async (convId, e) => {
    e.stopPropagation();
    await supabase.deleteConversation(convId, token);
    setConvos(prev => prev.filter(c => c.id !== convId));
    if (activeConvo === convId) { setMsgs([]); setActiveConvo(null); }
  };

  const send = async () => {
    if (!inp.trim() || busy || !mode) return;
    if (!isPro && qc >= MX) return;
    const um = { role: "user", content: inp.trim() };
    const all = [...msgs, um];
    setMsgs(all); setInp(""); setBusy(true); setStreaming("");
    if (tRef.current) tRef.current.style.height = "auto";
    try {
      const ac = new AbortController();
      const to = setTimeout(() => ac.abort(), 90000);
      const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 2048, stream: true, system: MODES[mode].sys, messages: all.map(m => ({ role: m.role, content: m.content })) }), signal: ac.signal });
      clearTimeout(to);
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e?.error?.message || "" + r.status); }
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let acc = "", buf = "";
      while (true) { const { done, value } = await reader.read(); if (done) break; buf += decoder.decode(value, { stream: true }); const lines = buf.split("\n"); buf = lines.pop() || ""; for (const line of lines) { if (!line.startsWith("data: ")) continue; const data = line.slice(6).trim(); if (data === "[DONE]") continue; try { const p = JSON.parse(data); if (p.type === "content_block_delta" && p.delta?.type === "text_delta") { acc += p.delta.text; setStreaming(acc); } } catch {} } }
      if (acc) {
        const finalMsgs = [...all, { role: "assistant", content: acc }];
        setMsgs(finalMsgs);
        const nc = qc + 1; setQc(nc);
        if (user && token) { supabase.updateQueryCount(user.id, nc, token).catch(() => {}); }
        const title = um.content.slice(0, 50) + (um.content.length > 50 ? "..." : "");
        if (activeConvo) {
          await supabase.updateConversation(activeConvo, finalMsgs, title, token);
          setConvos(prev => prev.map(c => c.id === activeConvo ? { ...c, messages: finalMsgs, title, updated_at: new Date().toISOString() } : c));
        } else {
          const newConv = await supabase.createConversation(user.id, mode, title, finalMsgs, token);
          if (newConv) { setActiveConvo(newConv.id); setConvos(prev => [newConv, ...prev]); }
        }
      } else { setMsgs(prev => [...prev, { role: "assistant", content: "Yanıt alınamadı." }]); }
      setStreaming("");
    } catch (e) { setStreaming(""); setMsgs(p => [...p, { role: "assistant", content: e.name === "AbortError" ? "Zaman aşımı." : e.message }]); }
    setBusy(false);
  };

  const pick = m => { setMode(m); setMsgs([]); setActiveConvo(null); setStreaming(""); setShowHistory(false); };
  const openShopier = () => { const url = user?.email ? CONFIG.SHOPIER_URL + "?email=" + encodeURIComponent(user.email) : CONFIG.SHOPIER_URL; window.open(url, "_blank"); };
  const renderText = (txt) => txt.split("\n").map((ln, j) => { const hd = /^(\d+\.)?\s*[A-ZÇĞİÖŞÜ\s]{4,}/.test(ln.trim()); return <p key={j} style={{ margin: "0 0 5px", fontWeight: hd ? 700 : 400, color: hd ? C.accent : "#c8c8d8", fontSize: hd ? 12.5 : 13.5, letterSpacing: hd ? 1 : 0 }}>{ln || "\u00A0"}</p>; });
  const limitReached = !isPro && qc >= MX;
  const modeConvos = convos.filter(c => c.mode === mode);

  if (initializing) return (<div style={{ ...S.root, alignItems: "center", justifyContent: "center" }}><FaceLogo size={48} /><style>{CSS}</style></div>);
  if (!disclaimerAccepted) return (<div style={S.root}><Disclaimer onAccept={acceptDisclaimer} /><style>{CSS}</style></div>);

  if (!user) return (
    <div style={S.root}><div style={S.auth}>
      <FaceLogo size={56} /><h1 style={{ ...S.title, fontSize: 22, marginTop: 16 }}>KARAPSİKO</h1><p style={S.sub}>GÖLGE DANIŞMAN</p><div style={{ height: 24 }} />
      <div style={S.af}>
        <input type="email" placeholder="E-posta" value={authEmail} onChange={e => setAuthEmail(e.target.value)} style={S.ai} />
        <input type="password" placeholder="Şifre (min 6 karakter)" value={authPass} onChange={e => setAuthPass(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleAuth(); }} style={S.ai} />
        {authErr && <p style={S.ae}>{authErr}</p>}
        <button onClick={handleAuth} disabled={authLoading} style={S.ab}>{authLoading ? "..." : authView === "login" ? "Giriş Yap" : "Kayıt Ol"}</button>
        <button onClick={() => supabase.signInWithGoogle()} style={S.gb}>Google ile Giriş</button>
        <button onClick={() => { setAuthView(authView === "login" ? "signup" : "login"); setAuthErr(""); }} style={S.at2}>{authView === "login" ? "Hesabın yok mu? Kayıt ol" : "Zaten hesabın var? Giriş yap"}</button>
      </div>
    </div><style>{CSS}</style></div>
  );

  if (!mode) return (
    <div style={S.root}><div style={S.home}>
      <div style={S.ub2}><span style={S.ue}>{user.email}</span><div style={{ display: "flex", gap: 8, alignItems: "center" }}>{isPro && <span style={S.pb2}>PRO</span>}<button onClick={handleLogout} style={S.lo}>Çıkış</button></div></div>
      <div style={S.brand}><FaceLogo size={68} /><div style={{ height: 18 }} /><h1 style={S.title}>KARAPSİKO</h1><p style={S.sub}>GÖLGE DANIŞMAN</p><div style={S.line} /><p style={S.tag}>Gücü elinde tut.</p></div>
      <div style={S.grid}>{MODE_KEYS.map(k => (<button key={k} onClick={() => pick(k)} style={S.card} onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.background = "#1a1a24"; }} onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.bg2; }}><span style={S.cn}>{MODES[k].label}</span><span style={S.cd}>{MODES[k].desc}</span></button>))}</div>
      {!isPro && <div style={S.usg}><span style={S.ul}>{qc}/{MX}</span><div style={S.ut}><div style={{ ...S.uf, width: Math.min((qc/MX)*100,100) + "%" }} /></div>{limitReached && <button onClick={openShopier} style={S.pb}>PRO — {CONFIG.PRO_PRICE}</button>}</div>}
      {isPro && <p style={{ fontSize: 11, color: C.textMuted, letterSpacing: 2 }}>PRO — SINIRSIZ ERİŞİM</p>}
    </div><style>{CSS}</style></div>
  );

  const c = MODES[mode];
  return (
    <div style={S.root}>
      <div style={S.hdr}>
        <button onClick={() => { setMode(null); setMsgs([]); setActiveConvo(null); }} style={S.bk}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>
        <div style={S.hc}><FaceLogo size={22} /><span style={S.ht}>{c.label}</span></div>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={newChat} style={S.iconBtn} title="Yeni sohbet">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          </button>
          <button onClick={() => setShowHistory(!showHistory)} style={S.iconBtn} title="Geçmiş">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={modeConvos.length > 0 ? C.accent : C.textMuted} strokeWidth="2" strokeLinecap="round"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/></svg>
          </button>
        </div>
      </div>

      {showHistory && (
        <div style={S.histPanel}>
          <div style={S.histHeader}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.text, letterSpacing: 1 }}>Sohbet Geçmişi</span>
            <button onClick={() => setShowHistory(false)} style={S.iconBtn}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          {modeConvos.length === 0 && <p style={{ fontSize: 12, color: C.textMuted, textAlign: "center", padding: 20 }}>Henüz sohbet yok.</p>}
          {modeConvos.map(conv => (
            <div key={conv.id} onClick={() => loadConvo(conv)} style={{ ...S.histItem, borderColor: conv.id === activeConvo ? C.accent : C.border }}>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <p style={{ margin: 0, fontSize: 12, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{conv.title || "Sohbet"}</p>
                <p style={{ margin: "2px 0 0", fontSize: 10, color: C.textMuted }}>{new Date(conv.updated_at).toLocaleDateString("tr-TR")}</p>
              </div>
              <button onClick={(e) => deleteConvo(conv.id, e)} style={{ ...S.iconBtn, padding: 4 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e74c3c" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={S.tb}>{MODE_KEYS.map(k => (<button key={k} onClick={() => pick(k)} style={{ ...S.tbn, color: k === mode ? C.text : C.textMuted, borderBottomColor: k === mode ? C.accent : "transparent" }}>{MODES[k].label}</button>))}</div>
      <div style={S.ca}>
        {msgs.length === 0 && !streaming && <div style={S.emp}><FaceLogo size={44} /><p style={S.et}>{c.desc}</p></div>}
        {msgs.map((m, i) => (<div key={i} style={m.role === "user" ? S.ubub : S.abub}>{m.role === "assistant" && <div style={S.atag}>KARAPSİKO</div>}<div style={S.mt}>{renderText(m.content)}</div></div>))}
        {busy && streaming && <div style={S.abub}><div style={S.atag}>KARAPSİKO</div><div style={S.mt}>{renderText(streaming)}<span style={S.cur}>|</span></div></div>}
        {busy && !streaming && <div style={S.abub}><div style={S.atag}>KARAPSİKO</div><div style={S.dots}><span className="kd kd1"/><span className="kd kd2"/><span className="kd kd3"/></div></div>}
        <div ref={eRef} />
      </div>
      <div style={S.iw}>
        {limitReached ? <div style={S.lb}><p style={S.lt}>Limit doldu.</p><button onClick={openShopier} style={S.ps}>PRO — {CONFIG.PRO_PRICE}</button></div>
        : <div style={S.ir}><textarea ref={tRef} value={inp} onChange={e => { setInp(e.target.value); rsz(); }} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={c.ph} style={S.ta} rows={1} /><button onClick={send} disabled={!inp.trim() || busy} style={{ ...S.sb, opacity: !inp.trim() || busy ? 0.2 : 1 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button></div>}
      </div>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = "@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap');*{box-sizing:border-box}.kd{display:inline-block;width:5px;height:5px;border-radius:50%;background:#2dd4bf}.kd1{animation:kp 1.4s infinite 0s}.kd2{animation:kp 1.4s infinite .15s}.kd3{animation:kp 1.4s infinite .3s}@keyframes kp{0%,80%,100%{opacity:.2;transform:scale(.8)}40%{opacity:1;transform:scale(1.3)}}@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}textarea::placeholder,input::placeholder{color:#555566}::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#252530;border-radius:3px}";

const S = {
  root:{width:"100%",height:"100vh",background:"#121218",display:"flex",flexDirection:"column",fontFamily:"'DM Sans',sans-serif",color:"#e8e8f0",overflow:"hidden"},
  auth:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"28px 24px",gap:4},
  af:{width:"100%",maxWidth:300,display:"flex",flexDirection:"column",gap:10},
  ai:{background:"#181820",border:"1px solid #252530",borderRadius:8,padding:"12px 14px",color:"#e8e8f0",fontSize:13.5,fontFamily:"'DM Sans',sans-serif",outline:"none"},
  ab:{padding:"13px",background:"#2dd4bf",color:"#000",border:"none",borderRadius:8,fontSize:13,fontWeight:700,letterSpacing:1,cursor:"pointer"},
  gb:{padding:"13px",background:"#1e1e28",color:"#8888a0",border:"1px solid #252530",borderRadius:8,fontSize:13,fontWeight:500,cursor:"pointer"},
  at2:{background:"none",border:"none",color:"#555566",fontSize:12,cursor:"pointer",marginTop:4,padding:4},
  ae:{color:"#e74c3c",fontSize:12,margin:0,textAlign:"center"},
  home:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"16px 20px",gap:20,overflowY:"auto"},
  ub2:{width:"100%",maxWidth:380,display:"flex",justifyContent:"space-between",alignItems:"center",padding:"0 4px"},
  ue:{fontSize:11,color:"#555566",letterSpacing:.5},
  pb2:{fontSize:9,fontWeight:700,color:"#2dd4bf",letterSpacing:2,border:"1px solid #2dd4bf",borderRadius:4,padding:"2px 6px"},
  lo:{background:"none",border:"none",color:"#555566",fontSize:11,cursor:"pointer"},
  brand:{textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center"},
  title:{margin:0,fontSize:24,fontWeight:700,letterSpacing:8,color:"#e8e8f0"},
  sub:{margin:"4px 0 0",fontSize:10,fontWeight:500,letterSpacing:5,color:"#2dd4bf"},
  line:{width:28,height:1,background:"#252530",margin:"14px 0"},
  tag:{margin:0,fontSize:13,color:"#555566",fontStyle:"italic",letterSpacing:.5},
  grid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,width:"100%",maxWidth:380},
  card:{background:"#181820",border:"1px solid #252530",borderRadius:10,padding:"16px 10px",display:"flex",flexDirection:"column",alignItems:"center",gap:3,cursor:"pointer",transition:"all .2s",textAlign:"center"},
  cn:{fontSize:12.5,fontWeight:700,color:"#e8e8f0",letterSpacing:1.5},
  cd:{fontSize:10,color:"#555566"},
  usg:{width:"100%",maxWidth:380,display:"flex",flexDirection:"column",alignItems:"center",gap:6},
  ul:{fontSize:10,color:"#555566",letterSpacing:2,fontWeight:500},
  ut:{width:"100%",height:2,background:"#1e1e28",borderRadius:1,overflow:"hidden"},
  uf:{height:"100%",background:"#2dd4bf",borderRadius:1,transition:"width .4s"},
  pb:{marginTop:10,padding:"13px 30px",background:"#2dd4bf",color:"#000",border:"none",borderRadius:8,fontSize:12,fontWeight:700,letterSpacing:1.5,cursor:"pointer"},
  hdr:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",borderBottom:"1px solid #252530",background:"#121218"},
  bk:{background:"none",border:"none",cursor:"pointer",padding:"4px 6px",display:"flex",alignItems:"center"},
  hc:{display:"flex",alignItems:"center",gap:7},
  ht:{fontSize:12,fontWeight:700,letterSpacing:2.5,color:"#e8e8f0"},
  iconBtn:{background:"none",border:"none",cursor:"pointer",padding:"4px 6px",display:"flex",alignItems:"center"},
  histPanel:{background:"#181820",borderBottom:"1px solid #252530",maxHeight:"50vh",overflowY:"auto",padding:"8px 12px"},
  histHeader:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8},
  histItem:{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderRadius:8,border:"1px solid #252530",marginBottom:6,cursor:"pointer",transition:"all .2s"},
  tb:{display:"flex",borderBottom:"1px solid #252530",background:"#121218",overflowX:"auto"},
  tbn:{flex:"0 0 auto",padding:"9px 12px",background:"none",border:"none",borderBottom:"2px solid transparent",fontSize:10,fontWeight:600,letterSpacing:1,cursor:"pointer",transition:"all .2s",textAlign:"center",whiteSpace:"nowrap"},
  ca:{flex:1,overflowY:"auto",padding:"14px 12px",display:"flex",flexDirection:"column",gap:10},
  emp:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12,opacity:.3},
  et:{fontSize:13,color:"#555566",margin:0,fontWeight:500,letterSpacing:1},
  ubub:{alignSelf:"flex-end",background:"#1e1e28",border:"1px solid #252530",borderRadius:"13px 13px 3px 13px",padding:"10px 14px",maxWidth:"82%"},
  abub:{alignSelf:"flex-start",background:"linear-gradient(160deg,#161620,#1a1a28)",border:"1px solid #252530",borderRadius:"13px 13px 13px 3px",padding:"12px 14px",maxWidth:"90%"},
  atag:{fontSize:8.5,fontWeight:700,color:"#2dd4bf",letterSpacing:2.5,marginBottom:6},
  mt:{fontSize:13.5,lineHeight:1.7,color:"#c8c8d8"},
  dots:{display:"flex",gap:5,padding:"3px 0"},
  cur:{color:"#2dd4bf",animation:"blink 1s infinite",fontWeight:300,fontSize:14},
  iw:{padding:"10px 12px 14px",borderTop:"1px solid #252530",background:"#121218"},
  ir:{display:"flex",alignItems:"flex-end",gap:8,background:"#181820",border:"1px solid #252530",borderRadius:11,padding:"7px 10px"},
  ta:{flex:1,background:"transparent",border:"none",outline:"none",color:"#e8e8f0",fontSize:13.5,fontFamily:"'DM Sans',sans-serif",lineHeight:1.5,resize:"none",maxHeight:150,padding:"3px 0"},
  sb:{width:32,height:32,borderRadius:"50%",background:"#2dd4bf",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"opacity .2s"},
  lb:{textAlign:"center",padding:"4px 0"},
  lt:{fontSize:11.5,color:"#555566",margin:"0 0 8px"},
  ps:{padding:"10px 22px",background:"#2dd4bf",color:"#000",border:"none",borderRadius:8,fontSize:11.5,fontWeight:700,letterSpacing:1.5,cursor:"pointer"},
};
