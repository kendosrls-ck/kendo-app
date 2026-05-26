// K-Sign · Tab Firme della dashboard Kendo App (admin)
// Mostra: statistiche richieste firma, lista filtrabile, drawer creazione nuova richiesta

import { useState, useEffect, useCallback } from "react";
import { supabase as sb } from "../App";

// Palette (allineata al brand Kendo)
const K = {
  gold: "#D4A843", goldHover: "#E8BC55", goldDim: "#8a6e28", goldBg: "#141008",
  black: "#080808", card: "#111111", surface: "#0e0e0e", surfaceHigh: "#181818",
  white: "#F5F5F5", muted: "#666", mutedMid: "#999", mutedLight: "#bbb",
  success: "#2a9d6f", successBg: "#081a12",
  danger: "#c0392b", dangerBg: "#160808",
  info: "#3a7bd5", border: "#1e1e1e", borderMid: "#2a2a2a",
};

// Helpers
const escapeHtml = (s) => s == null ? "" : String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RE_TEL = /^[+]?[0-9\s().\-]{8,20}$/;

const STATO_LABELS = {
  pending: { txt: "In attesa", color: K.gold, bg: K.goldBg },
  viewed: { txt: "Visualizzato", color: K.info, bg: "#0b1424" },
  signed: { txt: "Firmato", color: K.success, bg: K.successBg },
  expired: { txt: "Scaduto", color: K.danger, bg: K.dangerBg },
  cancelled: { txt: "Annullato", color: K.mutedLight, bg: "#0e0e0e" },
};

function StatusBadge({ stato }) {
  const s = STATO_LABELS[stato] || STATO_LABELS.pending;
  return (
    <span style={{
      display: "inline-block", padding: "3px 9px", borderRadius: 20, fontSize: 11,
      fontWeight: 500, background: s.bg, color: s.color, border: `1px solid ${s.color}33`
    }}>{s.txt}</span>
  );
}

export default function Ksign() {
  const [stats, setStats] = useState({ month: 0, pending: 0, signed: 0, conv: 0 });
  const [richieste, setRichieste] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerType, setDrawerType] = useState("completo");
  const [templates, setTemplates] = useState({});
  const [clienti, setClienti] = useState([]);
  const [toast, setToast] = useState(null);

  // Load data
  const loadStats = useCallback(async () => {
    const start = new Date(); start.setDate(1); start.setHours(0,0,0,0);
    const queries = await Promise.allSettled([
      sb.from("ksign_richiesta").select("*", { count: "exact", head: true }).gte("created_at", start.toISOString()),
      sb.from("ksign_richiesta").select("*", { count: "exact", head: true }).in("stato", ["pending", "viewed"]),
      sb.from("ksign_richiesta").select("*", { count: "exact", head: true }).eq("stato", "signed").gte("created_at", start.toISOString()),
    ]);
    const g = (i) => queries[i].status === "fulfilled" ? (queries[i].value.count ?? 0) : 0;
    const month = g(0), pending = g(1), signed = g(2);
    setStats({ month, pending, signed, conv: month > 0 ? Math.round(signed / month * 100) : 0 });
  }, []);

  const loadRichieste = useCallback(async () => {
    setLoading(true);
    const { data } = await sb.from("ksign_richiesta").select("*").order("created_at", { ascending: false }).limit(100);
    setRichieste(data || []);
    setLoading(false);
  }, []);

  const loadTemplates = useCallback(async () => {
    const { data } = await sb.from("ksign_template").select("*").eq("attivo", true);
    const map = {};
    (data || []).forEach(t => map[t.codice] = t);
    setTemplates(map);
  }, []);

  const loadClienti = useCallback(async () => {
    const { data } = await sb.from("clienti").select("id, nome, cognome, email, telefono, pacchetto, status_crm").order("updated_at", { ascending: false }).limit(300);
    setClienti(data || []);
  }, []);

  useEffect(() => {
    loadStats(); loadRichieste(); loadTemplates(); loadClienti();
    const channel = sb.channel("ksign_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "ksign_richiesta" }, () => {
        loadStats(); loadRichieste();
      })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [loadStats, loadRichieste, loadTemplates, loadClienti]);

  // Filtered list
  const list = richieste.filter(r => {
    if (filter === "pending" && !["pending","viewed"].includes(r.stato)) return false;
    if (filter !== "all" && filter !== "pending" && r.stato !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = (r.firmatario_nome + " " + (r.firmatario_cognome || "")).toLowerCase();
      if (!name.includes(q) && !(r.firmatario_email || "").toLowerCase().includes(q) && !(r.firmatario_telefono || "").includes(q)) return false;
    }
    return true;
  });

  const showToast = (title, msg, link) => {
    setToast({ title, msg, link });
    setTimeout(() => setToast(null), link ? 10000 : 4000);
  };

  const copyLink = (token) => {
    if (!token) return;
    const link = `${window.location.origin}/firma/${encodeURIComponent(token)}`;
    if (navigator.clipboard) navigator.clipboard.writeText(link);
    showToast("Link copiato", "Pronto da incollare");
  };

  // Apre il client email con messaggio precompilato per la richiesta firma
  const inviaEmail = (r) => {
    if (!r.firmatario_email) { alert("Manca l'email del cliente. Aggiungila prima."); return; }
    const link = `${window.location.origin}/firma/${encodeURIComponent(r.token_pubblico)}`;
    const tipoDoc = (r.template_codici || []).includes("contratto_fitgo") && (r.template_codici || []).includes("liberatoria_fitgo")
      ? "il contratto e la liberatoria"
      : (r.template_codici || []).includes("contratto_fitgo") ? "il contratto"
      : "la liberatoria";
    const subject = `Firma documenti Fit And Go Padova - ${r.firmatario_nome || ""}`;
    const body = `Ciao ${r.firmatario_nome || ""},\n\nti invio il link per firmare ${tipoDoc} dell'iscrizione al centro Fit And Go Padova.\n\n${link}\n\nIl link è personale e valido per la sola firma di questi documenti. La firma si fa direttamente dal telefono in pochi minuti.\n\nSe hai dubbi rispondi a questa email o chiamaci.\n\nA presto,\nFit And Go Padova`;
    const mailto = `mailto:${encodeURIComponent(r.firmatario_email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  };

  // Apre WhatsApp con messaggio precompilato (link nel testo)
  const inviaWhatsApp = (r) => {
    const tel = (r.firmatario_telefono || "").replace(/[^0-9+]/g, "").replace(/^\+/, "");
    let cleaned = tel;
    if (cleaned.startsWith("0039")) cleaned = cleaned.slice(4);
    if (cleaned.startsWith("39") && cleaned.length >= 11) cleaned = cleaned.slice(2);
    if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
    if (!cleaned) { alert("Manca il telefono del cliente."); return; }
    const link = `${window.location.origin}/firma/${encodeURIComponent(r.token_pubblico)}`;
    const tipoDoc = (r.template_codici || []).includes("contratto_fitgo") && (r.template_codici || []).includes("liberatoria_fitgo")
      ? "il contratto e la liberatoria"
      : (r.template_codici || []).includes("contratto_fitgo") ? "il contratto"
      : "la liberatoria";
    const text = `Ciao ${r.firmatario_nome || ""}! 😊\n\nTi mando il link per firmare ${tipoDoc} dell'iscrizione al centro Fit And Go Padova ⚡\n\n${link}\n\nLa firma si fa direttamente dal telefono, ci vogliono pochi minuti. 💪`;
    // Backup clipboard
    try { navigator.clipboard?.writeText(text); } catch (_) {}
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const url = isMobile
      ? `https://wa.me/39${cleaned}?text=${encodeURIComponent(text)}`
      : `https://web.whatsapp.com/send?phone=39${cleaned}&text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div style={{ background: K.black, minHeight: "100%", color: K.white, padding: 16 }}>
      {/* HEADER SEZIONE */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: K.white, marginBottom: 4 }}>K-Sign · Firme</h1>
          <p style={{ fontSize: 13, color: K.muted }}>Gestione firme digitali Fit And Go</p>
        </div>
        <button onClick={() => { setDrawerType("completo"); setDrawerOpen(true); }}
          style={{ background: `linear-gradient(135deg, ${K.gold}, ${K.goldDim})`, color: K.black, border: "none",
            borderRadius: 10, padding: "12px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          + Nuova firma
        </button>
      </div>

      {/* STATISTICHE */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        <StatCard label="Inviati questo mese" value={stats.month} accent={K.gold} />
        <StatCard label="In attesa firma" value={stats.pending} accent={K.gold} />
        <StatCard label="Firmati" value={stats.signed} accent={K.success} />
        <StatCard label="Tasso conversione" value={stats.conv + "%"} accent={K.info} />
      </div>

      {/* AZIONI RAPIDE */}
      <div style={{ background: K.card, border: `1px solid ${K.border}`, borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: K.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontWeight: 600 }}>Crea richiesta firma</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
          <QuickAction label="Solo Liberatoria" sub="6 firme · dichiarazioni salute + GDPR" onClick={() => { setDrawerType("liberatoria"); setDrawerOpen(true); }} />
          <QuickAction label="Solo Contratto" sub="4 firme · abbonamento" onClick={() => { setDrawerType("contratto"); setDrawerOpen(true); }} />
          <QuickAction label="Pacchetto completo" sub="10 firme · liberatoria + contratto" highlight onClick={() => { setDrawerType("completo"); setDrawerOpen(true); }} />
        </div>
      </div>

      {/* LISTA */}
      <div style={{ background: K.card, border: `1px solid ${K.border}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${K.border}`, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: K.white }}>Richieste firma</h2>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca cliente..."
            style={{ background: K.surface, border: `1px solid ${K.borderMid}`, borderRadius: 8, padding: "6px 10px", fontSize: 13, color: K.white, minWidth: 200 }} />
        </div>
        <div style={{ display: "flex", gap: 4, padding: "8px 16px", borderBottom: `1px solid ${K.border}`, overflowX: "auto" }}>
          {[["all", "Tutte"], ["pending", "In attesa"], ["signed", "Firmati"], ["expired", "Scaduti"]].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)}
              style={{ background: filter === k ? K.goldBg : "transparent", color: filter === k ? K.gold : K.mutedMid,
                border: filter === k ? `1px solid ${K.goldDim}` : "1px solid transparent",
                borderRadius: 6, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
              {l}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: K.muted }}>Caricamento...</div>
        ) : list.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: K.muted }}>
            <div style={{ fontSize: 14, color: K.mutedLight, marginBottom: 4 }}>Nessuna richiesta</div>
            <div style={{ fontSize: 12 }}>Clicca "Nuova firma" per iniziare</div>
          </div>
        ) : (
          <div>
            {list.map(r => (
              <div key={r.id} style={{ padding: "12px 16px", borderBottom: `1px solid ${K.border}`, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: K.gold, color: K.black, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                  {((r.firmatario_nome || "?")[0] + (r.firmatario_cognome?.[0] || "")).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: K.white }}>{escapeHtml(r.firmatario_nome || "?")} {escapeHtml(r.firmatario_cognome || "")}</div>
                  <div style={{ fontSize: 11, color: K.muted }}>{(r.template_codici || []).join(" + ")} · {new Date(r.created_at).toLocaleString("it-IT", {day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit"})}</div>
                </div>
                <StatusBadge stato={r.stato} />
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  {r.firmatario_email && (
                    <button onClick={() => inviaEmail(r)} title="Invia per email"
                      style={{ background: "transparent", color: K.gold, border: `1px solid ${K.goldDim}`, borderRadius: 6, padding: "5px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                      📧
                    </button>
                  )}
                  {r.firmatario_telefono && (
                    <button onClick={() => inviaWhatsApp(r)} title="Invia per WhatsApp"
                      style={{ background: "transparent", color: K.gold, border: `1px solid ${K.goldDim}`, borderRadius: 6, padding: "5px 8px", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                      💬
                    </button>
                  )}
                  <button onClick={() => copyLink(r.token_pubblico)} title="Copia link"
                    style={{ background: "transparent", color: K.gold, border: `1px solid ${K.goldDim}`, borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                    📋 Copia
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {drawerOpen && <NewRequestDrawer type={drawerType} templates={templates} clienti={clienti} onClose={() => setDrawerOpen(false)} onCreated={(link, nome) => { showToast("Richiesta creata ✓", `${nome}: link generato`, link); loadStats(); loadRichieste(); }} />}

      {toast && (
        <div style={{ position: "fixed", bottom: 16, right: 16, background: K.surfaceHigh, color: K.white, border: `1px solid ${K.goldDim}`, padding: 14, borderRadius: 10, maxWidth: 360, zIndex: 1000, boxShadow: "0 8px 24px rgba(0,0,0,.4)" }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{toast.title}</div>
          <div style={{ fontSize: 12, color: K.mutedLight, marginTop: 4 }}>{toast.msg}</div>
          {toast.link && (
            <div style={{ marginTop: 8 }}>
              <input readOnly value={toast.link} onClick={e => e.target.select()}
                style={{ width: "100%", fontSize: 11, padding: 6, background: K.surface, border: `1px solid ${K.border}`, color: K.mutedLight, borderRadius: 6 }} />
              <button onClick={() => { navigator.clipboard?.writeText(toast.link); }}
                style={{ marginTop: 6, fontSize: 11, color: K.gold, background: "transparent", border: "none", cursor: "pointer" }}>📋 Copia link</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div style={{ background: K.card, border: `1px solid ${K.border}`, borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 11, color: K.muted, fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: accent || K.white }}>{value}</div>
    </div>
  );
}

function QuickAction({ label, sub, highlight, onClick }) {
  return (
    <button onClick={onClick}
      style={{ textAlign: "left", padding: 12,
        background: highlight ? K.goldBg : K.surface,
        border: highlight ? `1px solid ${K.goldDim}` : `1px solid ${K.border}`,
        borderRadius: 8, cursor: "pointer", color: K.white }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: highlight ? K.gold : K.white }}>{label}</div>
      <div style={{ fontSize: 11, color: K.muted, marginTop: 2 }}>{sub}</div>
    </button>
  );
}

function NewRequestDrawer({ type, templates, clienti, onClose, onCreated }) {
  const [mode, setMode] = useState("existing"); // existing | new
  const [selected, setSelected] = useState(null);
  const [searchClient, setSearchClient] = useState("");
  const [nuovoNome, setNuovoNome] = useState("");
  const [nuovoEmail, setNuovoEmail] = useState("");
  const [nuovoTel, setNuovoTel] = useState("");
  const [pacchetto, setPacchetto] = useState("");
  const [importo, setImporto] = useState("");
  const [pagamento, setPagamento] = useState("Carta di credito");
  const [canale, setCanale] = useState("whatsapp");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const typeConfig = {
    liberatoria: { title: "Solo Liberatoria", codici: ["liberatoria_fitgo"] },
    contratto: { title: "Solo Contratto", codici: ["contratto_fitgo"] },
    completo: { title: "Pacchetto Completo", codici: ["liberatoria_fitgo", "contratto_fitgo"] },
  }[type];

  const hasContratto = typeConfig.codici.includes("contratto_fitgo");
  const pacchetti = templates["contratto_fitgo"]?.contenuto?.pacchetti_disponibili || [];

  const matches = clienti.filter(c => {
    if (!searchClient || searchClient.length < 2) return false;
    const q = searchClient.toLowerCase();
    return (c.nome + " " + (c.cognome || "")).toLowerCase().includes(q)
      || (c.email || "").toLowerCase().includes(q)
      || (c.telefono || "").includes(q);
  }).slice(0, 8);

  async function submit(e) {
    e.preventDefault();
    setError("");
    let payload = {
      template_codici: typeConfig.codici,
      canale_invio: canale,
      richiede_otp: true,
      reminder_attivo: true,
      stato: "pending",
      negozio: "FIT Padova",
    };
    if (mode === "existing" && selected) {
      payload.cliente_id = selected.id;
      payload.firmatario_nome = selected.nome;
      payload.firmatario_cognome = selected.cognome;
      payload.firmatario_email = selected.email;
      payload.firmatario_telefono = selected.telefono;
    } else if (mode === "new") {
      if (nuovoNome.trim().length < 2) { setError("Nome non valido"); return; }
      if (nuovoEmail && !RE_EMAIL.test(nuovoEmail)) { setError("Email non valida"); return; }
      if (!RE_TEL.test(nuovoTel)) { setError("Telefono non valido"); return; }
      const parts = nuovoNome.trim().split(/\s+/);
      payload.firmatario_nome = parts[0];
      payload.firmatario_cognome = parts.slice(1).join(" ");
      payload.firmatario_email = nuovoEmail || null;
      payload.firmatario_telefono = nuovoTel;
    } else {
      setError("Seleziona un cliente o inserisci nuovo");
      return;
    }
    if (!payload.firmatario_telefono || !RE_TEL.test(payload.firmatario_telefono)) {
      setError("Telefono obbligatorio (per OTP)"); return;
    }
    if (hasContratto) {
      const imp = parseFloat(importo);
      if (!pacchetto) { setError("Pacchetto obbligatorio"); return; }
      if (!isFinite(imp) || imp <= 0) { setError("Importo non valido"); return; }
      payload.dati_compilati = { pacchetto, importo: imp, metodo_pagamento: pagamento };
    }
    setSubmitting(true);
    const { data, error: err } = await sb.from("ksign_richiesta").insert(payload).select().single();
    setSubmitting(false);
    if (err) { setError("Errore: " + err.message); return; }
    await sb.from("ksign_audit_log").insert({
      richiesta_id: data.id, evento: "request_created",
      descrizione: "Richiesta creata da staff Kendo App",
      attore_tipo: "staff"
    });
    const link = `${window.location.origin}/firma/${encodeURIComponent(data.token_pubblico)}`;
    onCreated(link, payload.firmatario_nome);
    onClose();
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 999 }} />
      <div style={{ position: "fixed", top: 0, right: 0, height: "100%", width: "min(480px, 100%)", background: K.card, borderLeft: `1px solid ${K.goldDim}`, zIndex: 1000, overflowY: "auto", boxShadow: "-8px 0 24px rgba(0,0,0,.5)" }}>
        <div style={{ position: "sticky", top: 0, background: K.card, borderBottom: `1px solid ${K.border}`, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: K.white }}>{typeConfig.title}</h3>
            <p style={{ fontSize: 11, color: K.muted, marginTop: 2 }}>Compila per generare la richiesta firma</p>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: K.mutedLight, fontSize: 24, cursor: "pointer" }}>×</button>
        </div>
        <form onSubmit={submit} style={{ padding: 16 }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: K.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Cliente</label>
            <div style={{ display: "flex", gap: 6, marginTop: 6, background: K.surface, padding: 4, borderRadius: 8 }}>
              <button type="button" onClick={() => setMode("existing")} style={{ flex: 1, padding: 7, fontSize: 12, fontWeight: 600, border: "none", borderRadius: 6, cursor: "pointer", background: mode === "existing" ? K.gold : "transparent", color: mode === "existing" ? K.black : K.mutedLight }}>Esistente</button>
              <button type="button" onClick={() => setMode("new")} style={{ flex: 1, padding: 7, fontSize: 12, fontWeight: 600, border: "none", borderRadius: 6, cursor: "pointer", background: mode === "new" ? K.gold : "transparent", color: mode === "new" ? K.black : K.mutedLight }}>Nuovo</button>
            </div>
          </div>

          {mode === "existing" && (
            <div style={{ position: "relative", marginBottom: 14 }}>
              {!selected ? (
                <>
                  <input type="text" value={searchClient} onChange={e => setSearchClient(e.target.value)} placeholder="Cerca nome, email, telefono..."
                    style={{ width: "100%", padding: 10, background: K.surface, border: `1px solid ${K.borderMid}`, borderRadius: 8, color: K.white, fontSize: 13 }} />
                  {matches.length > 0 && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: K.surfaceHigh, border: `1px solid ${K.borderMid}`, borderRadius: 8, marginTop: 4, maxHeight: 240, overflowY: "auto", zIndex: 10 }}>
                      {matches.map(c => (
                        <button type="button" key={c.id} onClick={() => { setSelected(c); setSearchClient(""); }}
                          style={{ display: "block", width: "100%", textAlign: "left", padding: 10, background: "transparent", border: "none", borderBottom: `1px solid ${K.border}`, cursor: "pointer", color: K.white }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{c.nome} {c.cognome}</div>
                          <div style={{ fontSize: 11, color: K.muted }}>{c.telefono || ""} · {c.email || ""}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ background: K.successBg, border: `1px solid ${K.success}55`, padding: 10, borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: K.success }}>{selected.nome} {selected.cognome}</div>
                    <div style={{ fontSize: 11, color: K.mutedLight }}>{selected.telefono} · {selected.email}</div>
                  </div>
                  <button type="button" onClick={() => setSelected(null)} style={{ background: "transparent", border: "none", color: K.muted, cursor: "pointer", fontSize: 18 }}>×</button>
                </div>
              )}
            </div>
          )}

          {mode === "new" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              <input value={nuovoNome} onChange={e => setNuovoNome(e.target.value)} placeholder="Nome e Cognome" style={inputStyle()} />
              <input value={nuovoEmail} onChange={e => setNuovoEmail(e.target.value)} placeholder="Email (facoltativa)" type="email" style={inputStyle()} />
              <input value={nuovoTel} onChange={e => setNuovoTel(e.target.value)} placeholder="Telefono (+39 333 1234567)" type="tel" required style={inputStyle()} />
            </div>
          )}

          {hasContratto && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: K.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>Dettagli contratto</label>
              <select value={pacchetto} onChange={e => setPacchetto(e.target.value)} style={{ ...inputStyle(), marginBottom: 8 }}>
                <option value="">Seleziona pacchetto...</option>
                {pacchetti.map(p => <option key={p.codice} value={p.codice}>{p.nome}</option>)}
              </select>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input value={importo} onChange={e => setImporto(e.target.value)} type="number" min="0" step="0.01" placeholder="Importo €" style={inputStyle()} />
                <select value={pagamento} onChange={e => setPagamento(e.target.value)} style={inputStyle()}>
                  {["Carta di credito","Bancomat","PagoDIL","APPAGO","Service Pay","Bonifico","Contanti"].map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: K.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 6 }}>Canale (preview)</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              {[["whatsapp","WhatsApp"],["email","Email"],["sms","SMS"]].map(([k, l]) => (
                <button type="button" key={k} onClick={() => setCanale(k)}
                  style={{ padding: 10, fontSize: 12, fontWeight: 600, borderRadius: 8, cursor: "pointer",
                    background: canale === k ? K.successBg : K.surface,
                    color: canale === k ? K.success : K.mutedLight,
                    border: canale === k ? `1px solid ${K.success}` : `1px solid ${K.border}` }}>
                  {l}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 10, color: K.muted, marginTop: 4 }}>Per ora copi-incolli tu il link, l'invio automatico arriva nella Fase 2</div>
          </div>

          {error && <div style={{ background: K.dangerBg, color: K.danger, padding: 10, borderRadius: 8, fontSize: 12, marginBottom: 14, border: `1px solid ${K.danger}55` }}>{error}</div>}

          <button type="submit" disabled={submitting}
            style={{ width: "100%", padding: 14, background: `linear-gradient(135deg, ${K.gold}, ${K.goldDim})`, color: K.black, border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: submitting ? "wait" : "pointer", opacity: submitting ? 0.6 : 1 }}>
            {submitting ? "Creazione..." : "Crea richiesta firma"}
          </button>
        </form>
      </div>
    </>
  );
}

function inputStyle() {
  return { width: "100%", padding: 10, background: K.surface, border: `1px solid ${K.borderMid}`, borderRadius: 8, color: K.white, fontSize: 13 };
}
