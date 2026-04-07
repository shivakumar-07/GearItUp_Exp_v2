import { useState, useMemo, useEffect } from "react";
import { T, FONT } from "../theme";
import { fmt, fmtDate, daysAgo, uid, JOB_STATUS } from "../utils";
import { Btn, Input, Select, Modal, Field, Divider } from "../components/ui";

const STATUS_COLS = ["Draft", "Diagnosed", "In Progress", "Waiting Parts", "Ready", "Invoiced"];

// Map display STATUS_COLS names → internal JOB_STATUS keys for card filtering
const STATUS_COL_KEY_MAP = {
    "Draft": "draft",
    "Diagnosed": "estimated",
    "In Progress": "in_progress",
    "Waiting Parts": "approved",
    "Ready": "completed",
    "Invoiced": "invoiced",
};

function JobKanbanCard({ job, onSelect, onAdvance }) {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        if (!job.startedAt) return;
        const t = setInterval(() => setNow(Date.now()), 30000);
        return () => clearInterval(t);
    }, [job.startedAt]);
    const elapsed = job.startedAt ? Math.floor((now - job.startedAt) / 60000) : null;
    const checklistDone = (job.checklist || []).filter(c => c.status === "done").length;
    const checklistTotal = (job.checklist || []).length;
    return (
        <div onClick={() => onSelect(job)} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px", cursor: "pointer", transition: "all 0.15s" }} className="card-hover">
            <div style={{ fontSize: 13, fontWeight: 700, color: T.t1, marginBottom: 4 }}>{job.customerName || job.jobNumber || "Walk-in"}</div>
            <div style={{ fontSize: 11, color: T.amber, fontFamily: FONT.mono, marginBottom: 6 }}>{job.vehicleReg || job.jobNumber || "—"}</div>
            {(job.estimatedAmount || 0) > 0 && (
                <div style={{ fontSize: 12, color: T.emerald, fontFamily: FONT.mono, marginBottom: 6 }}>{fmt(job.estimatedAmount)}</div>
            )}
            {elapsed !== null && (
                <div style={{ fontSize: 11, color: T.sky }}>⏱ {elapsed}m elapsed</div>
            )}
            {checklistTotal > 0 && (
                <div style={{ marginTop: 8 }}>
                    <div style={{ height: 3, background: T.border, borderRadius: 2 }}>
                        <div style={{ height: "100%", background: T.emerald, borderRadius: 2, width: `${(checklistDone / checklistTotal) * 100}%` }} />
                    </div>
                    <div style={{ fontSize: 10, color: T.t3, marginTop: 3 }}>{checklistDone}/{checklistTotal} tasks</div>
                </div>
            )}
            <div style={{ marginTop: 8 }} onClick={e => e.stopPropagation()}>
                <Btn size="sm" variant="ghost" onClick={(e) => onAdvance(job, e)} style={{ fontSize: 10, padding: "3px 8px" }}>Advance →</Btn>
            </div>
        </div>
    );
}

export function WorkshopPage({ jobCards, vehicles, parties, products, activeShopId, onSaveJobCard, toast }) {
    const [filter, setFilter] = useState("all");
    const [expandedId, setExpandedId] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [viewMode, setViewMode] = useState("list"); // list | kanban
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 30000); // tick every 30s for live elapsed
        return () => clearInterval(t);
    }, []);

    // Kanban: clicking a card switches to list view and expands that card
    const setSelectedJob = (job) => {
        setViewMode("list");
        setExpandedId(job.id);
    };

    const handleAdvanceStatus = (job, e) => {
        e?.stopPropagation();
        // Find current column by internal status key
        const internalStatus = job.status || "draft";
        // Map internal key to display col
        const displayEntry = Object.entries(STATUS_COL_KEY_MAP).find(([, v]) => v === internalStatus);
        const currentCol = displayEntry ? displayEntry[0] : "Draft";
        const idx = STATUS_COLS.indexOf(currentCol);
        if (idx >= STATUS_COLS.length - 1) {
            toast?.("Job is already completed/invoiced", "info");
            return;
        }
        const nextDisplayStatus = STATUS_COLS[idx + 1];
        if (!window.confirm(`Move "${job.customerName || job.jobNumber || "this job"}" from "${currentCol}" → "${nextDisplayStatus}"?`)) return;
        const nextInternalStatus = STATUS_COL_KEY_MAP[nextDisplayStatus];
        onSaveJobCard?.({
            ...job,
            status: nextInternalStatus,
            ...(nextInternalStatus === "in_progress" && !job.startedAt ? { startedAt: Date.now() } : {}),
        });
        toast?.(`Job moved to "${nextDisplayStatus}"`, "success");
    };

    // Time tracking helper — uses live `now` so the display updates every 30s
    const getElapsedHours = (job) => {
        if (!job.startedAt) return null;
        const end = job.completedAt || now;
        const hrs = (end - job.startedAt) / 3600000;
        if (hrs < 1) return `${Math.floor(hrs * 60)}m`;
        return `${hrs.toFixed(1)}h`;
    };

    const shopJobs = useMemo(() => (jobCards || []).filter(j => j.shopId === activeShopId), [jobCards, activeShopId]);
    const shopVehicles = useMemo(() => (vehicles || []).filter(v => v.shopId === activeShopId), [vehicles, activeShopId]);
    const shopParties = useMemo(() => (parties || []).filter(p => p.shopId === activeShopId), [parties, activeShopId]);

    const filtered = useMemo(() =>
        shopJobs
            .filter(j => filter === "all" || j.status === filter)
            .sort((a, b) => b.createdAt - a.createdAt),
        [shopJobs, filter]);

    const statusCounts = useMemo(() => {
        const c = {};
        Object.keys(JOB_STATUS).forEach(k => c[k] = 0);
        shopJobs.forEach(j => { if (c[j.status] !== undefined) c[j.status]++; });
        return c;
    }, [shopJobs]);

    const getVehicle = (id) => shopVehicles.find(v => v.id === id);
    const getParty = (id) => shopParties.find(p => p.id === id);

    const handleStatusChange = (job, newStatus) => {
        const updated = { ...job, status: newStatus };
        if (newStatus === "in_progress" && !job.startedAt) updated.startedAt = Date.now();
        if (newStatus === "completed") updated.completedAt = Date.now();
        onSaveJobCard?.(updated);
        toast?.(`Job ${job.jobNumber} → ${JOB_STATUS[newStatus]?.label}`, "success");
    };

    const handleChecklistToggle = (job, idx) => {
        const checklist = [...job.checklist];
        checklist[idx] = { ...checklist[idx], status: checklist[idx].status === "done" ? "pending" : "done" };
        onSaveJobCard?.({ ...job, checklist });
    };

    const getNextActions = (status) => {
        const flow = {
            draft: ["estimated"],
            estimated: ["approved", "cancelled"],
            approved: ["in_progress", "cancelled"],
            in_progress: ["completed"],
            completed: ["invoiced"],
        };
        return flow[status] || [];
    };

    const totalEstimated = filtered.reduce((s, j) => s + (j.estimatedAmount || 0), 0);
    const activeJobs = shopJobs.filter(j => ["in_progress", "approved", "estimated"].includes(j.status)).length;

    return (
        <div className="page-in" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Header Stats */}
            <div style={{ display: "flex", gap: 12 }}>
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 20px", flex: 1 }}>
                    <div style={{ fontSize: 10, color: T.t3, fontWeight: 600, textTransform: "uppercase" }}>Active Jobs</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: "#818CF8", fontFamily: FONT.mono }}>{activeJobs}</div>
                </div>
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 20px", flex: 1 }}>
                    <div style={{ fontSize: 10, color: T.t3, fontWeight: 600, textTransform: "uppercase" }}>In Progress</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: T.amber, fontFamily: FONT.mono }}>{statusCounts.in_progress}</div>
                </div>
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 20px", flex: 1 }}>
                    <div style={{ fontSize: 10, color: T.t3, fontWeight: 600, textTransform: "uppercase" }}>Completed</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: T.emerald, fontFamily: FONT.mono }}>{statusCounts.completed}</div>
                </div>
                <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 20px", flex: 1.5 }}>
                    <div style={{ fontSize: 10, color: T.t3, fontWeight: 600, textTransform: "uppercase" }}>Total Estimated Value</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: T.amber, fontFamily: FONT.mono }}>{fmt(totalEstimated)}</div>
                </div>
            </div>

            {/* Filters + New Button */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button onClick={() => setFilter("all")} className="btn-hover-subtle" style={{ background: filter === "all" ? `${T.amber}22` : "transparent", color: filter === "all" ? T.amber : T.t3, border: "none", padding: "8px 14px", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT.ui }}>All ({shopJobs.length})</button>
                {Object.entries(JOB_STATUS).map(([key, cfg]) => (
                    statusCounts[key] > 0 && (
                        <button key={key} onClick={() => setFilter(key)} className="btn-hover-subtle"
                            style={{ background: filter === key ? `${cfg.color}22` : "transparent", color: filter === key ? cfg.color : T.t3, border: "none", padding: "8px 14px", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT.ui }}>
                            {cfg.icon} {cfg.label} ({statusCounts[key]})
                        </button>
                    )
                ))}
                <div style={{ flex: 1 }} />
                <div style={{ display: "flex", background: T.surface, borderRadius: 8, padding: 2, border: `1px solid ${T.border}` }}>
                    {["list", "kanban"].map(m => (
                        <button key={m} onClick={() => setViewMode(m)} style={{
                            padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer",
                            background: viewMode === m ? T.amber : "transparent",
                            color: viewMode === m ? "#000" : T.t3,
                            fontWeight: viewMode === m ? 700 : 500,
                            fontSize: 11, fontFamily: FONT.ui, transition: "all 0.15s",
                        }}>{m === "list" ? "☰ List" : "⊞ Board"}</button>
                    ))}
                </div>
                <Btn size="sm" onClick={() => setShowCreateModal(true)}>🔧 New Job Card</Btn>
            </div>

            {/* Kanban Board View */}
            {viewMode === "kanban" && (
                <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 12 }}>
                    {STATUS_COLS.map(status => {
                        const internalKey = STATUS_COL_KEY_MAP[status];
                        const colCards = shopJobs.filter(j => (j.status || "draft") === internalKey);
                        return (
                            <div key={status} style={{ minWidth: 260, flexShrink: 0, background: T.surface, borderRadius: 12, border: `1px solid ${T.border}`, overflow: "hidden" }}>
                                <div style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: T.t2, textTransform: "uppercase", letterSpacing: "0.08em" }}>{status}</span>
                                    <span style={{ background: T.card, borderRadius: 99, padding: "2px 8px", fontSize: 11, color: T.t3, fontWeight: 700 }}>{colCards.length}</span>
                                </div>
                                <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8, minHeight: 120, maxHeight: "calc(100vh - 280px)", overflowY: "auto" }}>
                                    {colCards.map(job => (
                                        <JobKanbanCard key={job.id} job={job} onSelect={setSelectedJob} onAdvance={handleAdvanceStatus} />
                                    ))}
                                    {colCards.length === 0 && (
                                        <div style={{ textAlign: "center", padding: "20px 10px", color: T.t4, fontSize: 12 }}>Empty</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Job Cards List View */}
            {viewMode === "list" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {filtered.length === 0 && (
                    <div style={{ textAlign: "center", padding: 48 }}>
                        <div style={{ fontSize: 48, opacity: 0.3, marginBottom: 12 }}>🔧</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: T.t2, marginBottom: 4 }}>No job cards match this filter</div>
                        <div style={{ fontSize: 12, color: T.t3 }}>Create a new job card to get started</div>
                    </div>
                )}
                {filtered.map(job => {
                    const vehicle = getVehicle(job.vehicleId);
                    const customer = getParty(job.customerId);
                    const statusCfg = JOB_STATUS[job.status] || JOB_STATUS.draft;
                    const isExpanded = expandedId === job.id;
                    const partsTotal = (job.parts || []).reduce((s, p) => s + p.qty * p.price, 0);
                    const labourTotal = (job.labour || []).reduce((s, l) => s + l.amount, 0);
                    const checklistDone = (job.checklist || []).filter(c => c.status === "done").length;
                    const checklistTotal = (job.checklist || []).length;

                    return (
                        <div key={job.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden", transition: "0.2s" }}>
                            {/* Job Card Header */}
                            <div onClick={() => setExpandedId(isExpanded ? null : job.id)} style={{ padding: "16px 20px", cursor: "pointer", display: "flex", gap: 16, alignItems: "center" }} className="row-hover">
                                <div style={{ width: 44, height: 44, borderRadius: 10, background: statusCfg.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                                    {statusCfg.icon}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                        <span style={{ fontWeight: 900, color: T.t1, fontSize: 15 }}>{job.jobNumber}</span>
                                        <span style={{ background: statusCfg.bg, color: statusCfg.color, padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 800 }}>{statusCfg.label}</span>
                                    </div>
                                    <div style={{ fontSize: 12, color: T.t3, marginTop: 3 }}>
                                        {vehicle ? `${vehicle.make} ${vehicle.model} · ${vehicle.registrationNumber}` : "No vehicle"} · {customer?.name || "Unknown"}
                                    </div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                    <div style={{ fontSize: 11, color: T.t3 }}>Estimated</div>
                                    <div style={{ fontSize: 18, fontWeight: 900, color: T.amber, fontFamily: FONT.mono }}>{fmt(job.estimatedAmount || 0)}</div>
                                </div>
                                {/* Time tracking */}
                                {getElapsedHours(job) && (
                                    <div style={{ textAlign: "right" }}>
                                        <div style={{ fontSize: 11, color: T.t3 }}>Elapsed</div>
                                        <div style={{ fontSize: 14, fontWeight: 700, color: T.sky, fontFamily: FONT.mono }}>⏱ {getElapsedHours(job)}</div>
                                    </div>
                                )}
                                <div style={{ textAlign: "right" }}>
                                    <div style={{ fontSize: 11, color: T.t3 }}>Checklist</div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: checklistDone === checklistTotal ? T.emerald : T.t2, fontFamily: FONT.mono }}>{checklistDone}/{checklistTotal}</div>
                                </div>
                                <div style={{ fontSize: 11, color: T.t3, textAlign: "right", minWidth: 70 }}>
                                    {daysAgo(job.createdAt)}
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && (
                                <div style={{ padding: "0 20px 20px", borderTop: `1px solid ${T.border}` }}>
                                    {/* Complaint & Diagnosis */}
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
                                        <div>
                                            <div style={{ fontSize: 10, color: T.t3, fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>Customer Complaint</div>
                                            <div style={{ padding: "10px 14px", background: T.surface, borderRadius: 8, fontSize: 13, color: T.t1 }}>{job.complaints || "—"}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 10, color: T.t3, fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>Diagnosis</div>
                                            <div style={{ padding: "10px 14px", background: T.surface, borderRadius: 8, fontSize: 13, color: T.t1 }}>{job.diagnosis || "—"}</div>
                                        </div>
                                    </div>

                                    {/* Checklist */}
                                    <div style={{ marginTop: 16 }}>
                                        <div style={{ fontSize: 10, color: T.t3, fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>Service Checklist</div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                            {(job.checklist || []).map((item, idx) => (
                                                <div key={idx} onClick={() => handleChecklistToggle(job, idx)}
                                                    style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 12px", background: item.status === "done" ? T.emeraldBg : T.surface, borderRadius: 8, cursor: "pointer", transition: "0.15s" }} className="row-hover">
                                                    <span style={{ fontSize: 16, color: item.status === "done" ? T.emerald : T.t4 }}>{item.status === "done" ? "☑" : "☐"}</span>
                                                    <span style={{ fontSize: 13, color: item.status === "done" ? T.emerald : T.t1, textDecoration: item.status === "done" ? "line-through" : "none" }}>{item.task}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Parts & Labour */}
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
                                        <div>
                                            <div style={{ fontSize: 10, color: T.t3, fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>Parts Required</div>
                                            {(job.parts || []).map((p, i) => (
                                                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: T.surface, borderRadius: 6, marginBottom: 4, fontSize: 12 }}>
                                                    <span style={{ color: T.t1 }}>{p.name} × {p.qty}</span>
                                                    <span style={{ fontFamily: FONT.mono, color: T.amber, fontWeight: 700 }}>{fmt(p.qty * p.price)}</span>
                                                </div>
                                            ))}
                                            <div style={{ textAlign: "right", fontSize: 12, fontWeight: 800, color: T.t1, marginTop: 4 }}>Parts Total: <span style={{ fontFamily: FONT.mono, color: T.amber }}>{fmt(partsTotal)}</span></div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: 10, color: T.t3, fontWeight: 600, textTransform: "uppercase", marginBottom: 8 }}>Labour & Services</div>
                                            {(job.labour || []).map((l, i) => (
                                                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: T.surface, borderRadius: 6, marginBottom: 4, fontSize: 12 }}>
                                                    <span style={{ color: T.t1 }}>{l.description}</span>
                                                    <span style={{ fontFamily: FONT.mono, color: T.sky, fontWeight: 700 }}>{fmt(l.amount)}</span>
                                                </div>
                                            ))}
                                            <div style={{ textAlign: "right", fontSize: 12, fontWeight: 800, color: T.t1, marginTop: 4 }}>Labour Total: <span style={{ fontFamily: FONT.mono, color: T.sky }}>{fmt(labourTotal)}</span></div>
                                        </div>
                                    </div>

                                    {/* Grand Total + Timestamps */}
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, padding: "12px 16px", background: `${T.amber}0A`, borderRadius: 10 }}>
                                        <div style={{ fontSize: 12, color: T.t3 }}>
                                            {job.startedAt && <span>Started: {fmtDate(job.startedAt)} · </span>}
                                            {job.completedAt && <span>Completed: {fmtDate(job.completedAt)}</span>}
                                        </div>
                                        <div>
                                            <span style={{ fontSize: 12, color: T.t3, marginRight: 8 }}>Grand Total:</span>
                                            <span style={{ fontSize: 22, fontWeight: 900, fontFamily: FONT.mono, color: T.amber }}>{fmt(partsTotal + labourTotal)}</span>
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                                        {getNextActions(job.status).map(next => {
                                            const cfg = JOB_STATUS[next];
                                            return (
                                                <Btn key={next} size="sm" variant={next === "cancelled" ? "danger" : next === "completed" ? "emerald" : "amber"}
                                                    onClick={() => handleStatusChange(job, next)}>
                                                    {cfg.icon} {cfg.label}
                                                </Btn>
                                            );
                                        })}
                                        {job.status === "completed" && (
                                            <Btn size="sm" variant="sky" onClick={() => {
                                                const msg = encodeURIComponent(`🔧 Job ${job.jobNumber} completed!\n\n${vehicle ? `Vehicle: ${vehicle.make} ${vehicle.model} (${vehicle.registrationNumber})\n` : ""}Parts: ${fmt(partsTotal)}\nLabour: ${fmt(labourTotal)}\nTotal: ${fmt(partsTotal + labourTotal)}\n\nThank you for choosing us! 🙏`);
                                                const phone = customer?.phone?.replace(/\D/g, "") || "";
                                                window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
                                            }}>💬 WhatsApp Invoice</Btn>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            )}

            {/* Create Job Card Modal */}
            <JobCardCreateModal
                open={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                vehicles={shopVehicles}
                parties={shopParties}
                products={(products || []).filter(p => p.shopId === activeShopId)}
                activeShopId={activeShopId}
                existingCount={shopJobs.length}
                onSave={(jc) => { onSaveJobCard?.(jc); setShowCreateModal(false); toast?.(`Job Card ${jc.jobNumber} created!`, "success", "🔧 Workshop"); }}
            />
        </div>
    );
}

// ===== Create Job Card Modal =====
function JobCardCreateModal({ open, onClose, vehicles, parties, products, activeShopId, existingCount, onSave }) {
    const [vehicleId, setVehicleId] = useState("");
    const [customerId, setCustomerId] = useState("");
    const [complaints, setComplaints] = useState("");
    const [diagnosis, setDiagnosis] = useState("");
    const [selectedParts, setSelectedParts] = useState([]);
    const [labourDesc, setLabourDesc] = useState("");
    const [labourAmt, setLabourAmt] = useState("");

    const handleAddPart = (pId) => {
        const prod = products.find(p => p.id === pId);
        if (prod && !selectedParts.find(sp => sp.itemId === pId)) {
            setSelectedParts(prev => [...prev, { itemId: pId, name: prod.name, qty: 1, price: prod.sellPrice }]);
        }
    };

    const handleSave = () => {
        if (!vehicleId || !complaints.trim()) return;
        const parts = selectedParts;
        const labour = labourDesc && labourAmt ? [{ description: labourDesc, amount: +labourAmt }] : [];
        const estimated = parts.reduce((s, p) => s + p.qty * p.price, 0) + labour.reduce((s, l) => s + l.amount, 0);

        onSave({
            id: "jc_" + uid(),
            shopId: activeShopId,
            jobNumber: `JC-2026-${String(existingCount + 1).padStart(3, "0")}`,
            vehicleId,
            customerId: customerId || vehicles.find(v => v.id === vehicleId)?.ownerId || "",
            status: "draft",
            assignedTo: null,
            estimatedAmount: estimated,
            actualAmount: null,
            complaints,
            diagnosis,
            checklist: [{ task: "Initial inspection", status: "pending" }, { task: "Parts procurement", status: "pending" }, { task: "Repair/Service", status: "pending" }, { task: "Quality check", status: "pending" }, { task: "Test drive", status: "pending" }],
            parts,
            labour,
            startedAt: null,
            completedAt: null,
            nextServiceDate: null,
            nextServiceKm: null,
            voucherId: null,
            createdAt: Date.now(),
        });

        // Reset
        setVehicleId(""); setCustomerId(""); setComplaints(""); setDiagnosis(""); setSelectedParts([]); setLabourDesc(""); setLabourAmt("");
    };

    const customers = parties.filter(p => p.type === "customer" || p.type === "both");

    return (
        <Modal open={open} onClose={onClose} title="🔧 New Job Card" subtitle="Create a workshop job card" width={640}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label="Vehicle" required>
                    <Select value={vehicleId} onChange={(v) => { setVehicleId(v); const veh = vehicles.find(x => x.id === v); if (veh) setCustomerId(veh.ownerId); }}
                        options={[{ value: "", label: "Select vehicle…" }, ...vehicles.map(v => ({ value: v.id, label: `${v.registrationNumber} — ${v.make} ${v.model}` }))]} />
                </Field>
                <Field label="Customer">
                    <Select value={customerId} onChange={setCustomerId}
                        options={[{ value: "", label: "Auto from vehicle" }, ...customers.map(c => ({ value: c.id, label: c.name }))]} />
                </Field>
                <div style={{ gridColumn: "span 2" }}><Field label="Customer Complaint" required><Input value={complaints} onChange={setComplaints} placeholder="Describe the issue…" /></Field></div>
                <div style={{ gridColumn: "span 2" }}><Field label="Diagnosis"><Input value={diagnosis} onChange={setDiagnosis} placeholder="Your assessment…" /></Field></div>

                <Divider label="Parts" />
                <div style={{ gridColumn: "span 2" }}>
                    <Select value="" onChange={handleAddPart}
                        options={[{ value: "", label: "Add part…" }, ...products.filter(p => p.stock > 0).map(p => ({ value: p.id, label: `${p.name} (${p.stock} in stock) — ${fmt(p.sellPrice)}` }))]} />
                    {selectedParts.length > 0 && (
                        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                            {selectedParts.map((sp, i) => (
                                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 10px", background: T.surface, borderRadius: 6, fontSize: 12 }}>
                                    <span style={{ flex: 1, color: T.t1 }}>{sp.name}</span>
                                    <Input type="number" value={String(sp.qty)} onChange={v => { const arr = [...selectedParts]; arr[i] = { ...arr[i], qty: +v || 1 }; setSelectedParts(arr); }} style={{ width: 60 }} />
                                    <span style={{ fontFamily: FONT.mono, color: T.amber }}>{fmt(sp.qty * sp.price)}</span>
                                    <button onClick={() => setSelectedParts(prev => prev.filter((_, idx) => idx !== i))} style={{ background: "none", border: "none", color: T.crimson, cursor: "pointer", fontSize: 16 }}>✕</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <Divider label="Labour" />
                <Field label="Labour Description"><Input value={labourDesc} onChange={setLabourDesc} placeholder="e.g. Full service labour" /></Field>
                <Field label="Labour Amount (₹)"><Input type="number" value={labourAmt} onChange={setLabourAmt} prefix="₹" /></Field>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22, paddingTop: 18, borderTop: `1px solid ${T.border}` }}>
                <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
                <Btn variant="amber" onClick={handleSave}>🔧 Create Job Card</Btn>
            </div>
        </Modal>
    );
}
