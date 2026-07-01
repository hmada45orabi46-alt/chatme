import { useState, useEffect, useRef } from "react";

// ============================================================
// 🔧 SUPABASE CONFIG — ضع بياناتك هنا بعد إنشاء المشروع
// ============================================================
const SUPABASE_URL = "https://mospgvyadbulvogehjdy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vc3BndnlhZGJ1bHZvZ2VoamR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MTU1NzEsImV4cCI6MjA5ODQ5MTU3MX0.yyZD4YEtaBcPXsE7oHoIN10PwbdiXkYEYyYrS8v8ymw";
// ============================================================

// Google Meet Room ثابت للعيلة — غيّره لأي اسم تحبه
const FAMILY_MEET_ROOM = "chatme-family-room";
const MEET_LINK = `https://meet.google.com/new`;

// ─── Supabase Client (Vanilla, no npm needed in browser) ────
function createClient(url, key) {
  const headers = { "apikey": key, "Authorization": `Bearer ${key}`, "Content-Type": "application/json" };

  async function from(table) {
    return {
      async select(cols = "*", opts = {}) {
        let q = `${url}/rest/v1/${table}?select=${cols}`;
        if (opts.order) q += `&order=${opts.order}`;
        if (opts.limit) q += `&limit=${opts.limit}`;
        const r = await fetch(q, { headers: { ...headers, "Prefer": "return=representation" } });
        return { data: await r.json(), error: r.ok ? null : "error" };
      },
      async insert(row) {
        const r = await fetch(`${url}/rest/v1/${table}`, {
          method: "POST", headers: { ...headers, "Prefer": "return=representation" },
          body: JSON.stringify(row),
        });
        return { data: await r.json(), error: r.ok ? null : "error" };
      },
    };
  }

  // Realtime via SSE polling (simple fallback)
  function channel(name) {
    let cb = null;
    const iv = { id: null };
    return {
      on(event, filter, handler) { cb = handler; return this; },
      subscribe() {
        // Poll every 2 seconds for new messages
        iv.id = setInterval(async () => {
          const client = createClient(url, key);
          const t = await client.from("messages");
          const { data } = await t.select("*", { order: "created_at.desc", limit: 1 });
          if (data && data[0] && cb) cb({ new: data[0] });
        }, 2000);
        return { unsubscribe: () => clearInterval(iv.id) };
      },
    };
  }

  async function signUp(email, password, name) {
    const r = await fetch(`${url}/auth/v1/signup`, {
      method: "POST", headers,
      body: JSON.stringify({ email, password, data: { name } }),
    });
    return r.json();
  }

  async function signIn(email, password) {
    const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: "POST", headers,
      body: JSON.stringify({ email, password }),
    });
    return r.json();
  }

  return { from, channel, signUp, signIn };
}

// ─── Demo messages for preview ──────────────────────────────
const DEMO_MSGS = [
  { id: 1, sender_name: "ماما", text: "يا حبيبي إيه الأخبار؟ 💕", created_at: "2024-01-01T10:00:00", color: "#FF6584" },
  { id: 2, sender_name: "بابا", text: "متى هتيجي تزورنا؟ 🏠", created_at: "2024-01-01T10:01:00", color: "#43A89F" },
  { id: 3, sender_name: "أنت", text: "قريب إن شاء الله! ❤️", created_at: "2024-01-01T10:02:00", color: "#7C3AED", isMe: true },
];

const AVATARS = ["👨", "👩", "👴", "👵", "🧑", "👦", "👧", "🧔"];

export default function ChatMe() {
  const [screen, setScreen] = useState("splash"); // splash | login | register | chat
  const [messages, setMessages] = useState(DEMO_MSGS);
  const [input, setInput] = useState("");
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("🧑");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCall, setShowCall] = useState(false);
  const [callType, setCallType] = useState("video"); // video | audio
  const [isDemo, setIsDemo] = useState(true);
  const [msgCount, setMsgCount] = useState(DEMO_MSGS.length);
  const messagesEnd = useRef(null);
  const supabase = useRef(null);

  const isConfigured = SUPABASE_URL !== "YOUR_SUPABASE_URL";

  useEffect(() => {
    setTimeout(() => setScreen("login"), 2000);
  }, []);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isConfigured) supabase.current = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }, []);

  const handleRegister = async () => {
    if (!name || !email || !password) { setError("ملأ كل الحقول"); return; }
    setLoading(true); setError("");
    if (!isConfigured) {
      setUser({ name, email, avatar });
      setIsDemo(true);
      setScreen("chat");
      setLoading(false);
      return;
    }
    try {
      const res = await supabase.current.signUp(email, password, name);
      if (res.user) { setUser({ name, email, avatar, id: res.user.id }); setScreen("chat"); }
      else setError("فيه مشكلة في التسجيل");
    } catch { setError("تأكد من الإنترنت"); }
    setLoading(false);
  };

  const handleLogin = async () => {
    if (!email || !password) { setError("ملأ الإيميل والباسورد"); return; }
    setLoading(true); setError("");
    if (!isConfigured) {
      setUser({ name: "زائر", email, avatar: "🧑" });
      setIsDemo(true);
      setScreen("chat");
      setLoading(false);
      return;
    }
    try {
      const res = await supabase.current.signIn(email, password);
      if (res.access_token) {
        setUser({ name: res.user?.user_metadata?.name || email, email, id: res.user.id });
        setScreen("chat");
      } else setError("إيميل أو باسورد غلط");
    } catch { setError("تأكد من الإنترنت"); }
    setLoading(false);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const msg = {
      id: Date.now(),
      sender_name: user?.name || "أنت",
      text: input,
      created_at: new Date().toISOString(),
      color: "#7C3AED",
      isMe: true,
    };
    setMessages(prev => [...prev, msg]);
    setInput("");

    if (isConfigured && supabase.current) {
      const t = await supabase.current.from("messages");
      await t.insert({ sender_name: user.name, text: input, user_id: user.id });
    }
  };

  const startCall = (type) => {
    setCallType(type);
    setShowCall(true);
  };

  const openMeet = () => {
    window.open(MEET_LINK, "_blank");
  };

  // ── SPLASH ──────────────────────────────────────────────
  if (screen === "splash") return (
    <div style={styles.fullCenter}>
      <div style={styles.splashLogo}>
        <div style={{ fontSize: 64, marginBottom: 8 }}>💬</div>
        <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: -1, color: "#fff" }}>CHAT ME</div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>تواصل مع عيلتك</div>
      </div>
      <div style={styles.splashDots}>
        {[0,1,2].map(i => <div key={i} style={{ ...styles.dot, animationDelay: `${i*0.3}s` }} />)}
      </div>
      <style>{splashAnim}</style>
    </div>
  );

  // ── LOGIN ───────────────────────────────────────────────
  if (screen === "login") return (
    <div style={styles.authWrap}>
      <div style={styles.authCard}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 44 }}>💬</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#7C3AED", letterSpacing: -0.5 }}>CHAT ME</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>سجّل دخولك وابدأ الدردشة</div>
        </div>

        {!isConfigured && (
          <div style={styles.demoWarning}>
            ⚠️ وضع تجريبي — ضع Supabase keys لتفعيل الحفظ الحقيقي
          </div>
        )}

        <input style={styles.input} placeholder="الإيميل" value={email} onChange={e => setEmail(e.target.value)} />
        <input style={styles.input} placeholder="الباسورد" type="password" value={password} onChange={e => setPassword(e.target.value)} />
        {error && <div style={styles.errorMsg}>{error}</div>}

        <button style={styles.btnPrimary} onClick={handleLogin} disabled={loading}>
          {loading ? "جاري الدخول..." : "دخول"}
        </button>
        <button style={styles.btnGhost} onClick={() => { setError(""); setScreen("register"); }}>
          حساب جديد؟ سجّل الآن
        </button>
      </div>
    </div>
  );

  // ── REGISTER ────────────────────────────────────────────
  if (screen === "register") return (
    <div style={styles.authWrap}>
      <div style={styles.authCard}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 44 }}>👤</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#7C3AED" }}>إنشاء حساب</div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: "#888", marginBottom: 8, textAlign: "right" }}>اختار صورتك</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            {AVATARS.map(a => (
              <button key={a} onClick={() => setAvatar(a)}
                style={{ fontSize: 28, background: avatar === a ? "#EDE9FE" : "#f5f5f5",
                  border: avatar === a ? "2px solid #7C3AED" : "2px solid transparent",
                  borderRadius: 14, padding: 6, cursor: "pointer" }}>
                {a}
              </button>
            ))}
          </div>
        </div>

        <input style={styles.input} placeholder="اسمك" value={name} onChange={e => setName(e.target.value)} />
        <input style={styles.input} placeholder="الإيميل" value={email} onChange={e => setEmail(e.target.value)} />
        <input style={styles.input} placeholder="الباسورد (6 حروف على الأقل)" type="password" value={password} onChange={e => setPassword(e.target.value)} />
        {error && <div style={styles.errorMsg}>{error}</div>}

        <button style={styles.btnPrimary} onClick={handleRegister} disabled={loading}>
          {loading ? "جاري التسجيل..." : "سجّل الآن"}
        </button>
        <button style={styles.btnGhost} onClick={() => { setError(""); setScreen("login"); }}>
          عندك حساب؟ سجّل دخول
        </button>
      </div>
    </div>
  );

  // ── CALL OVERLAY ────────────────────────────────────────
  if (showCall) return (
    <div style={{ ...styles.fullCenter, background: "#0f0f1a" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 80, marginBottom: 16, animation: "pulse 1.5s infinite" }}>
          {callType === "video" ? "📹" : "📞"}
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 8 }}>
          {callType === "video" ? "مكالمة فيديو" : "مكالمة صوتية"}
        </div>
        <div style={{ color: "rgba(255,255,255,0.5)", marginBottom: 32, fontSize: 14 }}>
          هيفتحلك Google Meet لبدء المكالمة مع العيلة
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
          <button onClick={openMeet} style={{
            background: "linear-gradient(135deg, #7C3AED, #a855f7)",
            border: "none", color: "#fff", borderRadius: 20,
            padding: "14px 40px", fontSize: 16, fontWeight: 700, cursor: "pointer",
            boxShadow: "0 4px 20px rgba(124,58,237,0.5)",
          }}>
            🎥 ابدأ المكالمة
          </button>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
            ابعت اللينك لعيلتك عشان ينضموا
          </div>
          <button onClick={() => setShowCall(false)} style={{
            background: "#ff4444", border: "none", color: "#fff",
            borderRadius: 50, width: 56, height: 56, fontSize: 20,
            cursor: "pointer", marginTop: 8,
          }}>✕</button>
        </div>
      </div>
      <style>{`@keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.1)} }`}</style>
    </div>
  );

  // ── CHAT ────────────────────────────────────────────────
  return (
    <div style={styles.chatWrap}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 36 }}>💬</div>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18, letterSpacing: -0.5 }}>CHAT ME</div>
            <div style={{ fontSize: 11, opacity: 0.75 }}>
              {isDemo ? "وضع تجريبي 🟡" : "العيلة متصلة 🟢"}
            </div>
          </div>
        </div>

        {/* Call Buttons */}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => startCall("audio")} style={styles.callBtn} title="مكالمة صوتية">
            📞
          </button>
          <button onClick={() => startCall("video")} style={styles.callBtn} title="مكالمة فيديو">
            📹
          </button>
        </div>
      </div>

      {/* Demo Banner */}
      {isDemo && (
        <div style={styles.demoBanner}>
          🚀 وضع تجريبي — الرسائل مش بتتحفظ على سيرفر. اقرأ التعليمات أسفل
        </div>
      )}

      {/* Messages */}
      <div style={styles.messagesArea}>
        {messages.map((msg) => (
          <div key={msg.id} style={{
            display: "flex",
            flexDirection: msg.isMe ? "row-reverse" : "row",
            alignItems: "flex-end",
            gap: 8,
            marginBottom: 12,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: "50%",
              background: msg.color || "#7C3AED",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 700, color: "#fff", flexShrink: 0,
            }}>
              {msg.sender_name?.charAt(0) || "؟"}
            </div>
            <div style={{ maxWidth: "72%" }}>
              {!msg.isMe && (
                <div style={{ fontSize: 11, color: msg.color || "#7C3AED", marginBottom: 3, fontWeight: 700 }}>
                  {msg.sender_name}
                </div>
              )}
              <div style={{
                background: msg.isMe
                  ? "linear-gradient(135deg, #7C3AED, #a855f7)"
                  : "#f0f0f0",
                color: msg.isMe ? "#fff" : "#1a1a1a",
                borderRadius: msg.isMe ? "18px 4px 18px 18px" : "4px 18px 18px 18px",
                padding: "10px 14px",
                fontSize: 15,
                lineHeight: 1.5,
                wordBreak: "break-word",
                boxShadow: msg.isMe ? "0 2px 12px rgba(124,58,237,0.3)" : "0 1px 4px rgba(0,0,0,0.08)",
              }}>
                {msg.text}
                <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4, textAlign: msg.isMe ? "left" : "right" }}>
                  {new Date(msg.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                  {msg.isMe && " ✓✓"}
                </div>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEnd} />
      </div>

      {/* Input */}
      <div style={styles.inputBar}>
        <button onClick={sendMessage} style={styles.sendBtn}>➤</button>
        <input
          style={styles.textInput}
          placeholder="اكتب رسالة..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMessage()}
        />
        <button onClick={() => setInput(p => p + "❤️")} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer" }}>😊</button>
      </div>

      {/* Setup Guide */}
      <div style={styles.guide}>
        <details>
          <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: 13, color: "#7C3AED", padding: "10px 0" }}>
            📖 ازاي أشيل التطبيق على النت؟ (اضغط هنا)
          </summary>
          <div style={{ fontSize: 12, lineHeight: 2, color: "#444", paddingTop: 8 }}>
            <b>الخطوة 1 — Supabase (مجاني):</b><br />
            ① روح supabase.com واعمل حساب<br />
            ② اعمل New Project<br />
            ③ روح SQL Editor وشغّل:<br />
            <code style={styles.code}>
              {`create table messages (
  id uuid default gen_random_uuid() primary key,
  sender_name text,
  text text,
  user_id text,
  created_at timestamptz default now()
);`}
            </code>
            ④ روح Settings {">"} API<br />
            ⑤ انسخ Project URL و anon key<br />
            ⑥ حطهم في السطرين الأوائل من الكود<br />
            <br />
            <b>الخطوة 2 — Vercel (مجاني):</b><br />
            ① روح vercel.com واعمل حساب<br />
            ② ارفع الملف على GitHub<br />
            ③ استورده على Vercel<br />
            ④ هياخدك دقيقتين ويديك لينك 🎉<br />
            <br />
            <b>الخطوة 3 — ابعت اللينك لعيلتك!</b>
          </div>
        </details>
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────
const styles = {
  fullCenter: {
    height: "100vh", display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    background: "linear-gradient(135deg, #4C1D95, #7C3AED, #a855f7)",
    fontFamily: "'Cairo','Tajawal',sans-serif",
  },
  splashLogo: { textAlign: "center" },
  splashDots: { display: "flex", gap: 8, marginTop: 40 },
  dot: {
    width: 10, height: 10, borderRadius: "50%",
    background: "rgba(255,255,255,0.6)",
    animation: "bounce 1.2s infinite",
  },
  authWrap: {
    minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    background: "linear-gradient(135deg, #F5F3FF, #EDE9FE)",
    fontFamily: "'Cairo','Tajawal',sans-serif", padding: 16,
  },
  authCard: {
    background: "#fff", borderRadius: 24, padding: "32px 28px",
    width: "100%", maxWidth: 360,
    boxShadow: "0 8px 40px rgba(124,58,237,0.15)",
    direction: "rtl",
  },
  input: {
    width: "100%", padding: "12px 16px", borderRadius: 14,
    border: "1.5px solid #E5E7EB", fontSize: 14,
    marginBottom: 12, outline: "none", textAlign: "right",
    fontFamily: "'Cairo','Tajawal',sans-serif",
    boxSizing: "border-box", display: "block",
    transition: "border 0.2s",
  },
  btnPrimary: {
    width: "100%", padding: "13px", borderRadius: 14,
    background: "linear-gradient(135deg, #7C3AED, #a855f7)",
    border: "none", color: "#fff", fontSize: 15, fontWeight: 700,
    cursor: "pointer", marginBottom: 10, fontFamily: "'Cairo','Tajawal',sans-serif",
    boxShadow: "0 4px 16px rgba(124,58,237,0.35)",
  },
  btnGhost: {
    width: "100%", padding: "11px", borderRadius: 14,
    background: "transparent", border: "1.5px solid #E5E7EB",
    color: "#7C3AED", fontSize: 14, fontWeight: 600,
    cursor: "pointer", fontFamily: "'Cairo','Tajawal',sans-serif",
  },
  errorMsg: {
    background: "#FEE2E2", color: "#DC2626", borderRadius: 10,
    padding: "8px 14px", fontSize: 13, marginBottom: 10, textAlign: "center",
  },
  demoWarning: {
    background: "#FEF3C7", color: "#92400E", borderRadius: 10,
    padding: "8px 14px", fontSize: 12, marginBottom: 14, textAlign: "center",
  },
  chatWrap: {
    height: "100vh", display: "flex", flexDirection: "column",
    background: "#FAFAFA", fontFamily: "'Cairo','Tajawal',sans-serif",
    direction: "rtl", maxWidth: 480, margin: "0 auto",
  },
  header: {
    background: "linear-gradient(135deg, #7C3AED, #a855f7)",
    padding: "12px 16px", display: "flex",
    alignItems: "center", justifyContent: "space-between",
    color: "#fff", boxShadow: "0 2px 16px rgba(124,58,237,0.4)",
  },
  callBtn: {
    background: "rgba(255,255,255,0.2)", border: "none",
    borderRadius: 12, padding: "8px 10px", fontSize: 20,
    cursor: "pointer", color: "#fff",
  },
  demoBanner: {
    background: "#FEF3C7", color: "#78350F",
    padding: "6px 14px", fontSize: 11, textAlign: "center",
  },
  messagesArea: {
    flex: 1, overflowY: "auto", padding: "16px 12px",
  },
  inputBar: {
    display: "flex", alignItems: "center", gap: 8,
    padding: "10px 12px",
    background: "#fff", borderTop: "1px solid #E5E7EB",
  },
  sendBtn: {
    background: "linear-gradient(135deg, #7C3AED, #a855f7)",
    border: "none", color: "#fff",
    width: 44, height: 44, borderRadius: "50%",
    fontSize: 18, cursor: "pointer", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 2px 10px rgba(124,58,237,0.4)",
  },
  textInput: {
    flex: 1, padding: "10px 14px",
    border: "1.5px solid #E5E7EB", borderRadius: 22,
    fontSize: 14, outline: "none", textAlign: "right",
    fontFamily: "'Cairo','Tajawal',sans-serif",
    background: "#F9FAFB",
  },
  guide: {
    background: "#fff", borderTop: "1px solid #E5E7EB",
    padding: "0 16px 8px",
  },
  code: {
    display: "block", background: "#1e1e2e", color: "#a6e3a1",
    borderRadius: 8, padding: "8px 10px", fontSize: 10,
    margin: "6px 0", whiteSpace: "pre-wrap", direction: "ltr",
    fontFamily: "monospace",
  },
};

const splashAnim = `
  @keyframes bounce {
    0%, 60%, 100% { transform: translateY(0); opacity: 1; }
    30% { transform: translateY(-10px); opacity: 0.6; }
  }
`;
