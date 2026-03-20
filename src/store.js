import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { SEED_PRODUCTS, SEED_SHOPS, genSeededMovements, SEED_ORDERS, SEED_PURCHASES, SEED_PARTIES, SEED_VEHICLES, SEED_JOB_CARDS, uid } from "./utils";
import { fetchInventory, fetchParties, syncProductSave } from "./api/sync.js";

export const StoreContext = createContext(null);

export function useStoreProvider() {
    const [shops, setShops] = useState(null);
    const [products, setP] = useState(null);
    const [movements, setM] = useState(null);
    const [orders, setOrders] = useState(null);
    const [purchases, setPurchases] = useState(null);
    const [auditLog, setAuditLog] = useState([]);
    const [receipts, setReceipts] = useState([]);
    const [parties, setParties] = useState(null);
    const [vehicles, setVehicles] = useState(null);
    const [jobCards, setJobCards] = useState(null);

    // Global User States
    const [cart, setCart] = useState([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [selectedVehicle, setSelectedVehicle] = useState(null);
    const [appMode, setAppMode] = useState("marketplace");

    // ── activeShopId: initialized from localStorage so the real DB UUID persists
    //    across page refreshes. Falls back to "s1" for demo/seed data.
    const [activeShopId, setActiveShopId] = useState(
        () => { try { return localStorage.getItem("vl_shopId") || "s1"; } catch { return "s1"; } }
    );

    const [marketplacePage, setMarketplacePage] = useState("home");
    const [loaded, setL] = useState(false);
    const [apiSynced, setApiSynced] = useState(false);

    // Persists the real shop UUID so InventoryPage filter works after page reload
    const persistShopId = useCallback((shopId) => {
        if (!shopId || shopId === activeShopId) return;
        setActiveShopId(shopId);
        try { localStorage.setItem("vl_shopId", shopId); } catch {}
    }, [activeShopId]);

    const syncFromAPI = async () => {
        try {
            const { getAccessToken } = await import('./api/client.js');
            if (!getAccessToken()) return; // Not logged in, skip

            const [apiProducts, apiParties] = await Promise.all([
                fetchInventory(),
                fetchParties(),
            ]);

            if (apiProducts && apiProducts.length > 0) {
                // Extract the real shopId from API products and persist it.
                // This fixes the fundamental disconnect where activeShopId was "s1"
                // but DB products had real UUIDs — causing the Inventory filter to
                // exclude every product returned by the API.
                const realShopId = apiProducts[0]?.shopId;
                if (realShopId && realShopId !== "s1") {
                    setActiveShopId(realShopId);
                    try { localStorage.setItem("vl_shopId", realShopId); } catch {}
                }
                setP(apiProducts);
                try { localStorage.setItem("vl_products", JSON.stringify(apiProducts)); } catch {}
                console.log(`[Store] Synced ${apiProducts.length} products from API (shopId: ${realShopId})`);
            }

            if (apiParties && apiParties.length > 0) {
                setParties(apiParties);
                try { localStorage.setItem("vl_parties", JSON.stringify(apiParties)); } catch {}
                console.log(`[Store] Synced ${apiParties.length} parties from API`);
            }

            setApiSynced(true);
        } catch (err) {
            console.warn('[Store] API sync error:', err.message);
        }
    };

    useEffect(() => {
        (async () => {
            try {
                const storedShops      = localStorage.getItem("vl_shops");
                const storedProducts   = localStorage.getItem("vl_products");
                const storedMovements  = localStorage.getItem("vl_movements");
                const storedOrders     = localStorage.getItem("vl_orders");
                const storedPurchases  = localStorage.getItem("vl_purchases");
                const storedVehicle    = localStorage.getItem("vl_vehicle");
                const storedCart       = localStorage.getItem("vl_cart");
                const storedAppMode    = localStorage.getItem("vl_appMode");
                const storedAuditLog   = localStorage.getItem("vl_auditLog");
                const storedReceipts   = localStorage.getItem("vl_receipts");
                const storedParties    = localStorage.getItem("vl_parties");
                const storedVehicles   = localStorage.getItem("vl_vehicles");
                const storedJobCards   = localStorage.getItem("vl_jobCards");

                setShops(storedShops       ? JSON.parse(storedShops)      : SEED_SHOPS);
                setP(storedProducts        ? JSON.parse(storedProducts)    : SEED_PRODUCTS);
                setM(storedMovements       ? JSON.parse(storedMovements)   : genSeededMovements());
                setOrders(storedOrders     ? JSON.parse(storedOrders)      : SEED_ORDERS);
                setPurchases(storedPurchases ? JSON.parse(storedPurchases) : SEED_PURCHASES);
                setAuditLog(storedAuditLog ? JSON.parse(storedAuditLog)    : []);
                setReceipts(storedReceipts ? JSON.parse(storedReceipts)    : []);
                setParties(storedParties   ? JSON.parse(storedParties)     : SEED_PARTIES);
                setVehicles(storedVehicles ? JSON.parse(storedVehicles)    : SEED_VEHICLES);
                setJobCards(storedJobCards ? JSON.parse(storedJobCards)    : SEED_JOB_CARDS);

                if (storedVehicle) setSelectedVehicle(JSON.parse(storedVehicle));
                if (storedCart) setCart(JSON.parse(storedCart));
                if (storedAppMode) setAppMode(storedAppMode);
            } catch {
                setShops(SEED_SHOPS);
                setP(SEED_PRODUCTS);
                setM(genSeededMovements());
                setOrders(SEED_ORDERS);
                setPurchases(SEED_PURCHASES);
                setAuditLog([]);
                setReceipts([]);
                setParties(SEED_PARTIES);
                setVehicles(SEED_VEHICLES);
                setJobCards(SEED_JOB_CARDS);
            }
            setL(true);

            // Background API sync (non-blocking — updates shop data from DB)
            syncFromAPI().catch(err => console.warn('[Store] API sync failed:', err));
        })();
    }, []);

    // Persistence helpers
    const saveShops = useCallback(d => { setShops(d); try { localStorage.setItem("vl_shops", JSON.stringify(d)); } catch { } }, []);
    const saveProducts = useCallback(d => {
        // Functional setState so we don't create a closure dependency on `products`
        setP(prev => {
            if (d.length === prev?.length) {
                const changed = d.find((p, i) => p !== prev?.[i]);
                if (changed) syncProductSave(changed).catch(() => {});
            }
            return d;
        });
        try { localStorage.setItem("vl_products", JSON.stringify(d)); } catch { }
    }, []); // stable — no dependency on products
    const saveMovements  = useCallback(d => { setM(d);         try { localStorage.setItem("vl_movements",  JSON.stringify(d)); } catch { } }, []);
    const saveOrders     = useCallback(d => { setOrders(d);    try { localStorage.setItem("vl_orders",     JSON.stringify(d)); } catch { } }, []);
    const savePurchases  = useCallback(d => { setPurchases(d); try { localStorage.setItem("vl_purchases",  JSON.stringify(d)); } catch { } }, []);
    const saveAuditLog   = useCallback(d => { setAuditLog(d);  try { localStorage.setItem("vl_auditLog",   JSON.stringify(d)); } catch { } }, []);
    const saveReceipts   = useCallback(d => { setReceipts(d);  try { localStorage.setItem("vl_receipts",   JSON.stringify(d)); } catch { } }, []);
    const saveParties    = useCallback(d => { setParties(d);   try { localStorage.setItem("vl_parties",    JSON.stringify(d)); } catch { } }, []);
    const saveVehicles   = useCallback(d => { setVehicles(d);  try { localStorage.setItem("vl_vehicles",   JSON.stringify(d)); } catch { } }, []);
    const saveJobCards   = useCallback(d => { setJobCards(d);  try { localStorage.setItem("vl_jobCards",   JSON.stringify(d)); } catch { } }, []);
    const saveCart       = useCallback(d => { setCart(d);      try { localStorage.setItem("vl_cart",       JSON.stringify(d)); } catch { } }, []);
    const saveVehicle    = useCallback(d => { setSelectedVehicle(d); try { localStorage.setItem("vl_vehicle", JSON.stringify(d)); } catch { } }, []);
    const saveAppMode    = useCallback(d => { setAppMode(d);   try { localStorage.setItem("vl_appMode",    d);               } catch { } }, []);

    const toggleCart = useCallback(() => { setIsCartOpen(prev => !prev); }, []);

    // Audit Log helper
    const logAudit = useCallback((action, entityType, entityId, details) => {
        const entry = {
            id: "aud_" + uid(),
            timestamp: Date.now(),
            action,
            entityType,
            entityId,
            details: typeof details === "string" ? details : JSON.stringify(details),
        };
        setAuditLog(prev => {
            const next = [entry, ...prev].slice(0, 500);
            try { localStorage.setItem("vl_auditLog", JSON.stringify(next)); } catch { }
            return next;
        });
    }, []);

    const resetAll = useCallback(async () => {
        setShops(SEED_SHOPS); setP(SEED_PRODUCTS); setM(genSeededMovements()); setOrders(SEED_ORDERS); setPurchases(SEED_PURCHASES);
        setCart([]); setSelectedVehicle(null); setAuditLog([]); setReceipts([]);
        setParties(SEED_PARTIES); setVehicles(SEED_VEHICLES); setJobCards(SEED_JOB_CARDS);
        // Reset shopId back to demo default
        setActiveShopId("s1");
        try {
            localStorage.setItem("vl_shops",     JSON.stringify(SEED_SHOPS));
            localStorage.setItem("vl_products",   JSON.stringify(SEED_PRODUCTS));
            localStorage.setItem("vl_movements",  JSON.stringify(genSeededMovements()));
            localStorage.setItem("vl_orders",     JSON.stringify(SEED_ORDERS));
            localStorage.setItem("vl_purchases",  JSON.stringify(SEED_PURCHASES));
            localStorage.removeItem("vl_cart");
            localStorage.removeItem("vl_vehicle");
            localStorage.removeItem("vl_auditLog");
            localStorage.removeItem("vl_receipts");
            localStorage.removeItem("vl_shopId");  // clear real shopId so seed data shows correctly
            localStorage.setItem("vl_parties",    JSON.stringify(SEED_PARTIES));
            localStorage.setItem("vl_vehicles",   JSON.stringify(SEED_VEHICLES));
            localStorage.setItem("vl_jobCards",   JSON.stringify(SEED_JOB_CARDS));
        } catch { }
    }, []);

    return {
        shops, products, movements, orders, purchases, auditLog, receipts, parties, vehicles, jobCards,
        saveShops, saveProducts, saveMovements, saveOrders, savePurchases, saveAuditLog, saveReceipts, saveParties, saveVehicles, saveJobCards,
        cart, saveCart, isCartOpen, setIsCartOpen, toggleCart,
        selectedVehicle, saveVehicle,
        appMode, saveAppMode,
        activeShopId, setActiveShopId, persistShopId,
        marketplacePage, setMarketplacePage,
        logAudit, resetAll, loaded, apiSynced
    };
}

export function useStore() {
    const ctx = useContext(StoreContext);
    if (!ctx) throw new Error("useStore must be used within a StoreProvider");
    return ctx;
}
