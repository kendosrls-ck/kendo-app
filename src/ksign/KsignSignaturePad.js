// K-Sign · Componente firma riutilizzabile
// Wrappa signature_pad in un componente React con stato controllato

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";

const KsignSignaturePad = forwardRef(function KsignSignaturePad(
  { height = 140, onChange, disabled = false },
  ref
) {
  const canvasRef = useRef(null);
  const padRef = useRef(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [loaded, setLoaded] = useState(false);

  // Carica signature_pad da CDN se non già presente
  useEffect(() => {
    if (window.SignaturePad) { setLoaded(true); return; }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/signature_pad@4.1.7/dist/signature_pad.umd.min.js";
    script.async = true;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Inizializza il signature pad
  useEffect(() => {
    if (!loaded || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const oldData = padRef.current?.toData();
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext("2d").scale(ratio, ratio);
      if (padRef.current) {
        padRef.current.clear();
        if (oldData?.length) { try { padRef.current.fromData(oldData); } catch (e) {} }
      } else {
        padRef.current = new window.SignaturePad(canvas, {
          backgroundColor: "rgb(255,255,255)",
          penColor: "rgb(10,10,10)",
          minWidth: 1.2,
          maxWidth: 3
        });
        padRef.current.addEventListener("endStroke", () => {
          setIsEmpty(padRef.current.isEmpty());
          onChange && onChange(padRef.current.toDataURL());
        });
      }
    };
    resize();
    let t;
    const onResize = () => { clearTimeout(t); t = setTimeout(resize, 150); };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", () => setTimeout(resize, 300));
    return () => { window.removeEventListener("resize", onResize); clearTimeout(t); };
  }, [loaded, onChange]);

  // API esposta al parent via ref
  useImperativeHandle(ref, () => ({
    clear: () => {
      if (padRef.current) { padRef.current.clear(); setIsEmpty(true); onChange && onChange(null); }
    },
    getDataURL: () => padRef.current?.toDataURL() || null,
    isEmpty: () => padRef.current?.isEmpty() ?? true,
  }));

  return (
    <div style={{ position: "relative", background: "#fff", border: "2px dashed #cbd5e1", borderRadius: 10, padding: 4 }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: `${height}px`, touchAction: "none", background: "#fff", borderRadius: 6, opacity: disabled ? 0.5 : 1 }}
      />
      {isEmpty && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none", color: "#cbd5e1", fontSize: 13, fontWeight: 500
        }}>
          Firma qui col dito o mouse
        </div>
      )}
    </div>
  );
});

export default KsignSignaturePad;
