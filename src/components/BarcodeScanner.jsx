/**
 * BarcodeScanner.jsx
 *
 * Production-grade camera barcode scanner using @zxing/browser.
 * Supports: EAN-13, EAN-8, Code-128, Code-39, QR Code, UPC-A, UPC-E, Data Matrix, PDF417.
 *
 * Usage:
 *   <BarcodeScanner
 *     open={isOpen}
 *     onScan={(barcode) => handleBarcode(barcode)}
 *     onClose={() => setOpen(false)}
 *     hint="Scan the product barcode or OEM number"
 *   />
 *
 * How it works:
 *   1. Opens the user's camera (prefers rear camera on mobile)
 *   2. Continuously decodes barcodes in real-time via ZXing
 *   3. On first successful decode → calls onScan(result) once and stops
 *   4. User can switch cameras if multiple are available
 *   5. Cleans up camera stream on close / unmount
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { T, FONT } from "../theme";

// ─── ZXing dynamic import (tree-shakeable) ────────────────────────────────────
let BrowserMultiFormatReader = null;
async function getReader() {
  if (!BrowserMultiFormatReader) {
    const mod = await import("@zxing/browser");
    BrowserMultiFormatReader = mod.BrowserMultiFormatReader;
  }
  return BrowserMultiFormatReader;
}

// ─── Overlay styles ───────────────────────────────────────────────────────────
const OVERLAY = {
  position: "fixed",
  inset: 0,
  zIndex: 3000,
  background: "rgba(0,0,0,0.92)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
};

const VIDEO_WRAPPER = {
  position: "relative",
  width: "100%",
  maxWidth: 480,
  borderRadius: 16,
  overflow: "hidden",
  boxShadow: "0 0 0 2px #F59E0B, 0 8px 48px rgba(0,0,0,0.7)",
};

export function BarcodeScanner({ open, onScan, onClose, hint }) {
  const videoRef       = useRef(null);
  const readerRef      = useRef(null);
  const controlsRef    = useRef(null); // ZXing scan controls
  const scannedRef     = useRef(false); // prevent double-fire

  const [cameras, setCameras]     = useState([]);
  const [activeCam, setActiveCam] = useState(null); // deviceId string
  const [status, setStatus]       = useState("starting"); // "starting" | "scanning" | "error"
  const [errorMsg, setErrorMsg]   = useState("");
  const [lastScan, setLastScan]   = useState("");

  // ── Stop any active scan / release camera ─────────────────────────────────
  const stopScan = useCallback(() => {
    try {
      controlsRef.current?.stop();
    } catch {}
    controlsRef.current = null;

    // Release video track
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  // ── List available cameras ────────────────────────────────────────────────
  const listCameras = useCallback(async () => {
    try {
      const Reader = await getReader();
      const devs = await BrowserMultiFormatReader.listVideoInputDevices();
      setCameras(devs);

      // Prefer rear camera: look for "back", "rear", "environment" in label
      const rear = devs.find((d) =>
        /back|rear|environment/i.test(d.label)
      );
      return rear?.deviceId || devs[0]?.deviceId || null;
    } catch {
      return null;
    }
  }, []);

  // ── Start scanning with a given deviceId ─────────────────────────────────
  const startScan = useCallback(async (deviceId) => {
    if (!videoRef.current) return;
    stopScan();
    scannedRef.current = false;
    setStatus("starting");
    setLastScan("");

    try {
      const Reader = await getReader();
      const reader = new Reader();
      readerRef.current = reader;

      // Hints: increase decode frequency and support more formats
      const hints = new Map();
      // DecodeHintType.TRY_HARDER = 3
      hints.set(3, true);

      const controls = await reader.decodeFromVideoDevice(
        deviceId || undefined,
        videoRef.current,
        (result, err, controls) => {
          if (result && !scannedRef.current) {
            scannedRef.current = true;
            const text = result.getText();
            setLastScan(text);
            // Brief flash before closing so user sees the scan
            setTimeout(() => {
              stopScan();
              onScan(text);
            }, 300);
          }
          // Ignore NotFoundException (no barcode in frame) — it's normal
        }
      );

      controlsRef.current = controls;
      setStatus("scanning");
    } catch (err) {
      const msg =
        err?.name === "NotAllowedError"
          ? "Camera permission denied. Please allow camera access in your browser settings."
          : err?.name === "NotFoundError"
          ? "No camera found on this device."
          : err?.message || "Camera error";
      setErrorMsg(msg);
      setStatus("error");
    }
  }, [stopScan, onScan]);

  // ── Open: list cameras then start ─────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      stopScan();
      setStatus("starting");
      setErrorMsg("");
      setLastScan("");
      scannedRef.current = false;
      return;
    }

    let cancelled = false;
    (async () => {
      const deviceId = await listCameras();
      if (cancelled) return;
      if (!deviceId) {
        setErrorMsg("No camera found. Please connect a camera.");
        setStatus("error");
        return;
      }
      setActiveCam(deviceId);
      await startScan(deviceId);
    })();

    return () => {
      cancelled = true;
      stopScan();
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Switch camera ─────────────────────────────────────────────────────────
  const switchCamera = async (deviceId) => {
    setActiveCam(deviceId);
    await startScan(deviceId);
  };

  if (!open) return null;

  return (
    <div style={OVERLAY} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ width: "100%", maxWidth: 480 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingInline: 4 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", fontFamily: FONT.ui }}>
              📷 Scan Barcode
            </div>
            {hint && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 3, fontFamily: FONT.ui }}>
                {hint}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 8,
              color: "#fff",
              width: 36,
              height: 36,
              cursor: "pointer",
              fontSize: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONT.ui,
            }}
          >
            ✕
          </button>
        </div>

        {/* Video */}
        <div style={VIDEO_WRAPPER}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: "100%", display: "block", minHeight: 260, background: "#000", objectFit: "cover" }}
          />

          {/* Scan frame overlay */}
          {status === "scanning" && (
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
              {/* Corner markers */}
              {[
                { top: 24, left: 24, borderTop: "3px solid #F59E0B", borderLeft: "3px solid #F59E0B" },
                { top: 24, right: 24, borderTop: "3px solid #F59E0B", borderRight: "3px solid #F59E0B" },
                { bottom: 24, left: 24, borderBottom: "3px solid #F59E0B", borderLeft: "3px solid #F59E0B" },
                { bottom: 24, right: 24, borderBottom: "3px solid #F59E0B", borderRight: "3px solid #F59E0B" },
              ].map((s, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    width: 28,
                    height: 28,
                    borderRadius: 3,
                    ...s,
                  }}
                />
              ))}

              {/* Scan line animation */}
              <div style={{
                position: "absolute",
                left: 24,
                right: 24,
                height: 2,
                background: "linear-gradient(90deg, transparent, #F59E0B, transparent)",
                animation: "scanLine 1.8s ease-in-out infinite",
                top: "50%",
              }} />
            </div>
          )}

          {/* Starting spinner */}
          {status === "starting" && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(0,0,0,0.5)",
            }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontFamily: FONT.ui }}>
                  Starting camera…
                </div>
              </div>
            </div>
          )}

          {/* Success flash */}
          {lastScan && (
            <div style={{
              position: "absolute", inset: 0,
              background: "rgba(16,185,129,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              pointerEvents: "none",
            }}>
              <div style={{
                background: T.emerald,
                color: "#fff",
                borderRadius: 10,
                padding: "10px 20px",
                fontSize: 13,
                fontWeight: 700,
                fontFamily: FONT.mono,
                maxWidth: 280,
                textAlign: "center",
                wordBreak: "break-all",
              }}>
                ✓ {lastScan}
              </div>
            </div>
          )}
        </div>

        {/* Error state */}
        {status === "error" && (
          <div style={{
            marginTop: 14,
            background: "#EF444420",
            border: "1px solid #EF444455",
            borderRadius: 10,
            padding: "14px 16px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>🚫</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#EF4444", marginBottom: 4, fontFamily: FONT.ui }}>
              Camera unavailable
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontFamily: FONT.ui, lineHeight: 1.55 }}>
              {errorMsg}
            </div>
          </div>
        )}

        {/* Status */}
        {status === "scanning" && !lastScan && (
          <div style={{ textAlign: "center", marginTop: 14 }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: FONT.ui }}>
              Hold the barcode steady in the frame…
            </div>
          </div>
        )}

        {/* Camera switcher — only show if multiple cameras */}
        {cameras.length > 1 && status === "scanning" && (
          <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "center", flexWrap: "wrap" }}>
            {cameras.map((cam, i) => (
              <button
                key={cam.deviceId}
                onClick={() => switchCamera(cam.deviceId)}
                style={{
                  background: activeCam === cam.deviceId ? T.amber : "rgba(255,255,255,0.08)",
                  color: activeCam === cam.deviceId ? "#000" : "#fff",
                  border: `1px solid ${activeCam === cam.deviceId ? T.amber : "rgba(255,255,255,0.15)"}`,
                  borderRadius: 8,
                  padding: "6px 14px",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: FONT.ui,
                }}
              >
                {cam.label || `Camera ${i + 1}`}
              </button>
            ))}
          </div>
        )}

        {/* Supported formats */}
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: FONT.ui }}>
            EAN-13 · Code-128 · QR Code · UPC · Code-39 · Data Matrix
          </div>
        </div>

      </div>

      {/* CSS keyframes injected inline */}
      <style>{`
        @keyframes scanLine {
          0%   { top: 25%; opacity: 0.4; }
          50%  { top: 75%; opacity: 1; }
          100% { top: 25%; opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

export default BarcodeScanner;
