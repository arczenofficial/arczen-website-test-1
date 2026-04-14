/**
 * ArcZen Equity Terminal (Founder Exclusive)
 * High-stakes capital management and strategic diversification.
 */
import { 
    collection, doc, getDoc, getDocs, updateDoc, onSnapshot, 
    query, where, collectionGroup, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from './db.js';
import { finance } from './finance-engine.js';
import { showToast } from './utils.js';

export async function renderEquityPage() {
    const content = document.getElementById('mainContentArea');
    if (!content) return;

    content.innerHTML = `
        <div class="module-container animate-fade-in" style="padding: 24px;">
            <div class="module-header" style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px;">
                <div>
                    <h2 style="font-size: 1.5rem; font-weight: 800; margin:0;"><i class="ph ph-crown" style="color:var(--accent);"></i> Equity Hub</h2>
                    <p style="color:var(--text-muted); font-size:0.85rem;">Strategic Capital Allocation & Balance Sheet Control</p>
                </div>
                <div style="display:flex; gap:12px; align-items:center;">
                    <div id="maintStatus" class="mode-indicator standby"><i class="ph ph-shield-check"></i> SYSTEM LIVE</div>
                    <button class="premium-btn primary" id="broadcastBtn"><i class="ph ph-megaphone-simple"></i> BROADCAST</button>
                </div>
            </div>

            <!-- Balance Sheet Strip -->
            <div class="metrics-strip glow" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 32px;">
                <div class="mini-card highlight">
                    <span class="label">LIQUID CAPITAL (POOL)</span>
                    <div class="val" id="liquidCapital">৳0</div>
                    <div class="sub-val" id="capitalBreakdown">Loading breakdown...</div>
                </div>
                <div class="mini-card highlight-accent">
                    <span class="label">INVENTORY ASSETS</span>
                    <div class="val accent" id="inventoryAssets">৳0</div>
                    <div class="sub-val" id="inventoryCount">-- SKUs Indexed</div>
                </div>
                <div class="mini-card">
                    <span class="label">SETTLEMENT RATE</span>
                    <div class="val" id="settlementRate">0.0%</div>
                    <div class="sub-val" id="profitMargin">Margin: --%</div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 24px;">
                <!-- Reinvestment Engine -->
                <div class="data-terminal">
                   <div class="container-header" style="padding: 16px; border-bottom: 1px solid var(--border);">
                        <h3 style="margin:0; font-size:0.9rem; font-weight:800;"><i class="ph ph-hand-coins" style="color:var(--accent);"></i> STRATEGIC ALLOCATION ENGINE</h3>
                    </div>
                    <div style="padding:24px;">
                        <p class="dim-label" style="font-size:0.8rem; margin-bottom:24px;">Autonomous profit routing configurations for active fulfillment windows.</p>
                        <div class="reinvest-grid" style="display:grid; grid-template-columns: 1fr 1fr; gap:32px;">
                            <div class="form-section">
                                <label style="font-size:0.65rem; color:var(--text-dim); letter-spacing:1px; display:block; margin-bottom:12px;">STOCK REPLENISHMENT</label>
                                <input type="range" min="0" max="100" value="60" class="terminal-range" id="stockRange" style="width:100%;">
                                <div style="display:flex; justify-content:space-between; margin-top:12px;">
                                    <span id="stockVal" style="font-family:'JetBrains Mono'; font-weight:800; color:var(--accent);">60%</span>
                                    <span style="font-size:0.7rem; color:var(--text-muted);">AUTO-RESTOCK</span>
                                </div>
                            </div>
                            <div class="form-section">
                                <label style="font-size:0.65rem; color:var(--text-dim); letter-spacing:1px; display:block; margin-bottom:12px;">DIVIDEND PAYOUT</label>
                                <input type="range" min="0" max="100" value="20" class="terminal-range" id="divRange" style="width:100%;">
                                <div style="display:flex; justify-content:space-between; margin-top:12px;">
                                    <span id="divVal" style="font-family:'JetBrains Mono'; font-weight:800; color:var(--accent);">20%</span>
                                    <span style="font-size:0.7rem; color:var(--text-muted);">FOUNDER FLOW</span>
                                </div>
                            </div>
                        </div>
                        <button id="saveAllocationBtn" class="premium-btn primary" style="width:100%; margin-top:32px; height:44px; justify-content:center;">COMMIT STRATEGIC PARAMETERS</button>
                    </div>
                </div>

                <!-- Strategic Adjustments & Vault -->
                <div class="sidebar-v2-container" style="display:grid; gap:20px;">
                    <div class="data-terminal">
                        <div class="container-header" style="padding: 16px; border-bottom: 1px solid var(--border);">
                             <h3 style="margin:0; font-size:0.9rem; font-weight:800;"><i class="ph ph-chart-line-up" style="color:var(--accent);"></i> MANUAL CAPITAL INJECTION</h3>
                        </div>
                        <div style="padding:20px;">
                            <label style="font-size:0.65rem; color:var(--text-dim); display:block; margin-bottom:8px;">EXTERNAL FUNDING (৳)</label>
                            <input type="number" id="manualCapitalInput" placeholder="0.00" style="width:100%; background:var(--bg-deep); border:1px solid var(--border); color:var(--text-main); padding:10px; border-radius:8px; margin-bottom:16px; font-family:'JetBrains Mono';">
                            <button id="saveManualCapBtn" class="pill" style="width:100%; font-size:0.7rem; letter-spacing:1px;">UPDATE EXTERNAL BALANCE</button>
                        </div>
                    </div>

                    <div class="premium-card danger-zone" style="border: 1px solid var(--danger); background: rgba(239, 68, 68, 0.05);">
                        <div class="widget-head" style="display:flex; justify-content:space-between; align-items:center;">
                            <span class="label" style="color:var(--danger); font-weight:800;">VAULT DISCONNECT</span>
                            <i class="ph ph-warning-octagon" style="color:var(--danger);"></i>
                        </div>
                        <p style="font-size:0.75rem; color:var(--text-muted); margin:12px 0; line-height:1.4;">Seal all transaction gateways instantly. Maintenance mode will bypass catalog functionality.</p>
                        <button id="toggleMaintBtn" class="pill" style="width:100%; background:var(--danger); color:white; border:none; height:38px;">ENGAGE LOCK DOWN</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    setupEquityUI();
    loadEquityLiveFeed();
}

async function loadEquityLiveFeed() {
    // 1. Listen for System Config
    onSnapshot(doc(db, 'system_config', 'equity'), (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        document.getElementById('stockRange').value = data.allocation_stock || 60;
        document.getElementById('divRange').value = data.allocation_dividend || 20;
        document.getElementById('stockVal').textContent = (data.allocation_stock || 60) + '%';
        document.getElementById('divVal').textContent = (data.allocation_dividend || 20) + '%';
        document.getElementById('manualCapitalInput').value = data.manual_injection || 0;
        window._manualInjection = data.manual_injection || 0;
        refreshLiquidCapital();
    });

    // 2. Listen for Maintenance Mode
    onSnapshot(doc(db, 'system_config', 'status'), (snap) => {
        const active = snap.exists() && snap.data().maintenanceMode;
        const indicator = document.getElementById('maintStatus');
        const btn = document.getElementById('toggleMaintBtn');
        if (active) {
            indicator.className = 'mode-indicator armed';
            indicator.innerHTML = '<i class="ph ph-warning"></i> VAULT LOCKED';
            btn.textContent = 'DISENGAGE LOCK';
            btn.style.background = 'var(--success)';
        } else {
            indicator.className = 'mode-indicator standby';
            indicator.innerHTML = '<i class="ph ph-shield-check"></i> SYSTEM LIVE';
            btn.textContent = 'ENGAGE LOCK DOWN';
            btn.style.background = 'var(--danger)';
        }
    });

    // 3. Compute Real-time Financials
    try {
        const itemsSnap = await getDocs(collectionGroup(db, 'items'));
        let totalRev = 0;
        let totalCost = 0;
        let deliveredCount = 0;

        itemsSnap.forEach(d => {
            const o = d.data();
            // Note: In a production app, we would query the parent order for status
            // For now, we assume all orders in Firestore are active signals
            totalRev += (o.amount || o.totalAmount || 0);
            totalCost += (o.cost || 0);
        });

        const inventorySnap = await getDocs(collection(db, 'inventory'));
        const productsSnap = await getDocs(collection(db, 'products'));
        const prodMap = {};
        productsSnap.forEach(d => prodMap[d.id] = d.data());

        let invValue = 0;
        inventorySnap.forEach(d => {
            const inv = d.data();
            const p = prodMap[d.id];
            if (p) {
                invValue += (inv.stock * (p.sourcing_cost_usd || 0));
            }
        });

        window._liveRevenue = totalRev;
        document.getElementById('inventoryAssets').textContent = `৳${invValue.toLocaleString()}`;
        document.getElementById('inventoryCount').textContent = `${productsSnap.size} Assets Indexed`;
        document.getElementById('settlementRate').textContent = totalRev > 0 ? (( (totalRev - totalCost) / totalRev) * 100).toFixed(1) + '%' : '0.0%';
        document.getElementById('profitMargin').textContent = `Net: ৳${(totalRev - totalCost).toLocaleString()}`;
        
        refreshLiquidCapital();
    } catch (e) { console.error("Equity Sync Error:", e); }
}

async function refreshLiquidCapital() {
    try {
        const accSnap = await getDocs(collection(db, 'treasury'));
        const total = accSnap.docs.reduce((s, a) => s + (a.data().balance || 0), 0);
        
        document.getElementById('liquidCapital').textContent = `৳${total.toLocaleString()}`;
        document.getElementById('capitalBreakdown').innerHTML = `
            <span style="color:var(--accent);">${accSnap.size} Managed Liquid Channels</span>
        `;
    } catch (e) {
        document.getElementById('liquidCapital').textContent = '৳0 (Offline)';
    }
}

function setupEquityUI() {
    const stockRange = document.getElementById('stockRange');
    const divRange = document.getElementById('divRange');
    
    stockRange?.addEventListener('input', (e) => {
        document.getElementById('stockVal').textContent = e.target.value + '%';
    });
    
    divRange?.addEventListener('input', (e) => {
        document.getElementById('divVal').textContent = e.target.value + '%';
    });

    document.getElementById('saveAllocationBtn').onclick = async () => {
        const btn = document.getElementById('saveAllocationBtn');
        btn.disabled = true;
        try {
            await updateDoc(doc(db, 'system_config', 'equity'), {
                allocation_stock: parseInt(stockRange.value),
                allocation_dividend: parseInt(divRange.value),
                updatedAt: serverTimestamp()
            });
            showToast('Allocation Commited', 'success');
        } catch (e) { showToast('Injection Error', 'error'); }
        finally { btn.disabled = false; }
    };

    document.getElementById('saveManualCapBtn').onclick = async () => {
        const val = parseFloat(document.getElementById('manualCapitalInput').value) || 0;
        try {
            await updateDoc(doc(db, 'system_config', 'equity'), {
                manual_injection: val,
                updatedAt: serverTimestamp()
            });
            showToast('External Balance Pulsed', 'success');
        } catch (e) { showToast('Injection Error', 'error'); }
    };

    document.getElementById('toggleMaintBtn').onclick = async () => {
        const btn = document.getElementById('toggleMaintBtn');
        const currentState = btn.textContent.includes('DISENGAGE');
        if (confirm(`${currentState ? 'RESTORE SYSTEM GATEWAY?' : 'LOCK DOWN ALL CHANNELS?'}`)) {
            try {
                await updateDoc(doc(db, 'system_config', 'status'), {
                    maintenanceMode: !currentState,
                    updatedAt: serverTimestamp()
                });
                showToast(`System ${currentState ? 'RESTORED' : 'LOCKED'}`, 'neutral');
            } catch (e) { showToast('Vault Error', 'error'); }
        }
    };
}
