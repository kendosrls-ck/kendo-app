import React from "react";

/**
 * ErrorBoundary - Cattura i crash di render React e mostra
 * un messaggio leggibile invece della schermata bianca.
 *
 * Quando vedi questo schermo, fai uno screenshot e mandalo:
 * il messaggio di errore dice ESATTAMENTE dove e' il bug.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log in console (visibile in DevTools, F12)
    // eslint-disable-next-line no-console
    console.error("[Kendo ErrorBoundary]", error, info);
    this.setState({ info });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, info: null });
    // tentativo soft di ricarica
    if (typeof window !== "undefined") window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const errMsg = this.state.error?.message || String(this.state.error || "Errore sconosciuto");
    const stack = this.state.info?.componentStack || "";

    return (
      <div style={{
        minHeight: "100vh",
        background: "#080808",
        color: "#F5F5F5",
        padding: "32px 20px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <div style={{
          maxWidth: 520,
          background: "#111",
          border: "1px solid #2e2510",
          borderRadius: 12,
          padding: 24
        }}>
          <div style={{
            fontSize: 28,
            marginBottom: 12,
            color: "#D4A843",
            textAlign: "center"
          }}>
            ⚠️ Si è verificato un errore
          </div>
          <div style={{
            fontSize: 13,
            color: "#bbb",
            marginBottom: 16,
            textAlign: "center",
            lineHeight: 1.6
          }}>
            L'app si è bloccata su una schermata. Premi il pulsante qui sotto per ricaricare.
            Se l'errore si ripresenta, fai uno screenshot di questo messaggio e mandalo al tuo sviluppatore.
          </div>
          <div style={{
            background: "#160808",
            border: "1px solid #2e1010",
            borderRadius: 8,
            padding: "12px 14px",
            fontSize: 12,
            color: "#c0392b",
            fontFamily: "monospace",
            marginBottom: 16,
            wordBreak: "break-word"
          }}>
            {errMsg}
          </div>
          {stack ? (
            <details style={{ marginBottom: 16, fontSize: 11, color: "#666" }}>
              <summary style={{ cursor: "pointer", color: "#999" }}>
                Dettagli tecnici
              </summary>
              <pre style={{
                whiteSpace: "pre-wrap",
                marginTop: 8,
                background: "#0e0e0e",
                padding: 10,
                borderRadius: 6,
                fontSize: 10,
                color: "#888",
                maxHeight: 240,
                overflow: "auto"
              }}>
                {stack}
              </pre>
            </details>
          ) : null}
          <button onClick={this.handleReset} style={{
            background: "#D4A843",
            color: "#080808",
            border: "none",
            borderRadius: 8,
            padding: "12px 16px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            width: "100%"
          }}>
            🔄 Ricarica l'app
          </button>
        </div>
      </div>
    );
  }
}
