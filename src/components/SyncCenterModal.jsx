import { Modal, Btn } from "./ui";
import { T, FONT } from "../theme";

function formatDateTime(ts) {
  if (!ts) return "--";
  try {
    return new Date(ts).toLocaleString([], {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "--";
  }
}

function formatElapsed(ts) {
  if (!ts) return "--";
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatRetryTime(ts) {
  if (!ts) return "Ready";
  const delta = ts - Date.now();
  if (delta <= 0) return "Ready now";
  const secs = Math.ceil(delta / 1000);
  if (secs < 60) return `in ${secs}s`;
  const mins = Math.ceil(secs / 60);
  return `in ${mins}m`;
}

export function SyncCenterModal({
  open,
  onClose,
  status,
  items,
  onSyncNow,
  onRetryItem,
  onDiscardItem,
  actionBusy,
  itemBusy = {},
}) {
  const pendingCount = Number(status?.pendingCount || 0);
  const syncing = Boolean(status?.isSyncing);
  const offline = status?.isOnline === false;

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={780}
      title="Sync Center"
      subtitle="Review pending backend sync jobs and resolve stuck entries"
    >
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            border: `1px solid ${syncing ? `${T.sky}44` : pendingCount > 0 ? `${T.amber}44` : `${T.emerald}44`}`,
            background: syncing ? T.skyBg : pendingCount > 0 ? T.amberGlow : T.emeraldBg,
            color: syncing ? T.sky : pendingCount > 0 ? T.amber : T.emerald,
            borderRadius: 999,
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: 700,
            fontFamily: FONT.ui,
          }}
        >
          {syncing ? (
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                border: `2px solid ${T.sky}`,
                borderTopColor: "transparent",
                animation: "spin 0.8s linear infinite",
              }}
            />
          ) : (
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: pendingCount > 0 ? T.amber : T.emerald,
                boxShadow: `0 0 10px ${pendingCount > 0 ? `${T.amber}99` : `${T.emerald}99`}`,
                animation: pendingCount > 0 ? "pulse 1.2s ease-in-out infinite" : "none",
              }}
            />
          )}
          {syncing ? "Syncing..." : pendingCount > 0 ? `${pendingCount} pending` : "All synced"}
        </div>

        <div style={{ fontSize: 12, color: T.t3, fontFamily: FONT.ui }}>
          Last sync: <span style={{ color: T.t2 }}>{formatDateTime(status?.lastSyncedAt)}</span>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Btn
            size="sm"
            variant="sky"
            onClick={() => onSyncNow?.()}
            disabled={actionBusy || syncing || pendingCount === 0}
            loading={Boolean(actionBusy && pendingCount > 0)}
          >
            Sync Now
          </Btn>
        </div>
      </div>

      {offline && pendingCount > 0 && (
        <div
          style={{
            marginBottom: 14,
            borderRadius: 10,
            border: `1px solid ${T.crimson}44`,
            background: T.crimsonBg,
            color: T.crimson,
            padding: "8px 10px",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Device is offline. Pending jobs will retry automatically when internet is back.
        </div>
      )}

      {status?.lastError && pendingCount > 0 && (
        <div
          style={{
            marginBottom: 14,
            borderRadius: 10,
            border: `1px solid ${T.amber}55`,
            background: T.amberGlow,
            color: T.amber,
            padding: "8px 10px",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Last error: {status.lastError}
        </div>
      )}

      {pendingCount === 0 ? (
        <div
          style={{
            border: `1px solid ${T.emerald}33`,
            background: T.emeraldBg,
            borderRadius: 12,
            padding: "22px 16px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 26, marginBottom: 8, animation: "pulse 1.6s ease-in-out infinite" }}>✓</div>
          <div style={{ color: T.t1, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Nothing pending</div>
          <div style={{ color: T.t3, fontSize: 12 }}>All local changes are synced to backend.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "58vh", overflowY: "auto", paddingRight: 4 }}>
          {items.map((item, idx) => {
            const busy = Boolean(itemBusy[item.id]);
            const hasError = Boolean(item.lastError);
            return (
              <div
                key={item.id}
                style={{
                  borderRadius: 12,
                  border: `1px solid ${hasError ? `${T.crimson}55` : `${T.border}`}`,
                  background: hasError ? `${T.crimson}10` : T.surface,
                  padding: "12px 12px 10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 16 }}>{item.icon}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: T.t1 }}>{item.kindLabel}</span>
                      {item.isBlocking && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            letterSpacing: "0.04em",
                            color: T.amber,
                            border: `1px solid ${T.amber}55`,
                            borderRadius: 999,
                            padding: "2px 8px",
                            textTransform: "uppercase",
                          }}
                        >
                          Blocking Queue
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: T.t2, marginTop: 2 }}>{item.summary}</div>
                  </div>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10, fontSize: 11, color: T.t3 }}>
                  <span>Queued: {formatElapsed(item.createdAt)}</span>
                  <span>Retries: {item.retryCount}</span>
                  <span>Next retry: {formatRetryTime(item.nextRetryAt)}</span>
                  <span style={{ fontFamily: FONT.mono }}>#{String(item.id).slice(-8)}</span>
                </div>

                {hasError && (
                  <div
                    style={{
                      marginTop: 8,
                      borderRadius: 8,
                      border: `1px solid ${T.crimson}44`,
                      background: `${T.crimson}1A`,
                      color: T.crimson,
                      padding: "8px 10px",
                      fontSize: 11,
                      lineHeight: 1.35,
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>Last failure</div>
                    <div>{item.lastError}</div>
                    {(item.lastErrorStatus || item.lastErrorCode) && (
                      <div style={{ marginTop: 3, color: `${T.crimson}` }}>
                        {item.lastErrorStatus ? `HTTP ${item.lastErrorStatus}` : ""}
                        {item.lastErrorStatus && item.lastErrorCode ? " · " : ""}
                        {item.lastErrorCode || ""}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 10 }}>
                  <Btn
                    size="xs"
                    variant="subtle"
                    onClick={() => onRetryItem?.(item.id)}
                    disabled={busy || actionBusy}
                    loading={busy}
                  >
                    Retry
                  </Btn>
                  <Btn
                    size="xs"
                    variant="danger"
                    onClick={() => onDiscardItem?.(item.id)}
                    disabled={busy || actionBusy}
                  >
                    Discard
                  </Btn>
                </div>

                {idx < items.length - 1 && (
                  <div style={{ marginTop: 10, height: 1, background: `${T.border}` }} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
