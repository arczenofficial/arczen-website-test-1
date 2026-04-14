/**
 * ArcZen Warehouse & Inventory Terminal
 * High-performance stock tracking and logistic synchronization.
 */
import { 
    collection, doc, getDocs, updateDoc, query, orderBy, serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from './db.js';
import { showToast, utils } from './utils.js';
import { finance } from './finance-engine.js';

export async function renderInventoryPage() {
    const mainArea = document.getElementById('mainContentArea');
    if (!mainArea) return;

    mainArea.innerHTML = `
        <div class="module-container animate-fade-in" style="padding: 24px;">
            <div class="module-header" style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px;">
                <div>
                    <h2 style="font-size: 1.5rem; font-weight: 800; margin:0;"><i class="ph ph-warehouse" style="color:var(--accent);"></i> Inventory Terminal</h2>
                    <p style="color:var(--text-muted); font-size:0.85rem;">Warehouse Stock Management & Sourcing Control</p>
                </div>
                <button id="addInventoryBtn" class="premium-btn primary"><i class="ph ph-plus-bold"></i> ADJUST_STOCK</button>
            </div>

            <!-- Strategic Stock Metrics -->
            <div class="metrics-strip grow" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 32px;">
                <div class="mini-card highlight">
                    <span class="label">AGGREGATED SKUs</span>
                    <div class="val" id="totalSkuCount">--</div>
                    <div class="sub-val">Total Managed Assets</div>
                </div>
                <div class="mini-card">
                    <span class="label">LOW STOCK ALERTS</span>
                    <div class="val crit" id="lowStockCount">--</div>
                    <div class="sub-val">Requiring Restock</div>
                </div>
                <div class="mini-card highlight-accent">
                    <span class="label">CURRENT ASSET VALUE</span>
                    <div class="val accent" id="inventoryValue">--</div>
                    <div class="sub-val">Based on Sourcing Cost</div>
                </div>
            </div>

            <div class="data-terminal">
                <div class="container-header" style="padding:16px 20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
                    <div class="search-box-v2" style="width:300px;">
                        <i class="ph ph-magnifying-glass"></i>
                        <input type="text" id="inventorySearch" placeholder="SEARCH_SKU_INDEX...">
                    </div>
                    <div class="actions">
                        <button id="exportInventoryBtn" class="pill"><i class="ph ph-export"></i> CSV</button>
                    </div>
                </div>
                <div id="inventoryTerminalTable" style="height: 600px; background:var(--bg-surface);"></div>
            </div>
        </div>

        <!-- Inventory Adjustment Modal -->
        <div id="invModal" class="terminal-modal" style="display:none;">
            <div class="modal-surface" style="max-width: 500px;">
                <div class="modal-header-v2">
                    <h3>Synchronize Asset Stock</h3>
                    <button onclick="document.getElementById('invModal').style.display='none'" class="icon-btn"><i class="ph ph-x"></i></button>
                </div>
                <form id="invAdjustForm" class="terminal-form" style="padding:24px;">
                    <div class="form-grid">
                        <div class="form-section span-3">
                            <label>SELECT ASSET / SKU</label>
                            <select id="invAssetSelect" required>
                                <option value="">Select an asset...</option>
                                <!-- Injected -->
                            </select>
                        </div>
                        <div class="form-section span-3">
                            <label>ADJUSTMENT VOLUME</label>
                            <input type="number" id="invAdjAmt" placeholder="e.g. 50 or -10" required>
                            <span class="dim-label" style="font-size:0.6rem; margin-top:4px;">Use positive numbers to add stock, negative to remove.</span>
                        </div>
                    </div>
                    <div class="modal-footer-v2" style="margin-top:24px;">
                        <button type="submit" class="premium-btn primary" style="width:100%; justify-content:center;">COMMIT ADJUSTMENT</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    setupInventoryUI();
    loadInventoryData();
}

let invTable = null;

async function loadInventoryData() {
    try {
        const prodSnap = await getDocs(collection(db, 'products'));
        const invSnap = await getDocs(collection(db, 'inventory'));
        const invMap = {};
        invSnap.forEach(d => invMap[d.id] = d.data());

        const products = prodSnap.docs.map(d => ({
            id: d.id,
            ...d.data(),
            stock: invMap[d.id]?.stock || 0
        }));

        // Stats
        document.getElementById('totalSkuCount').textContent = products.length;
        document.getElementById('lowStockCount').textContent = products.filter(p => p.stock < 10).length;
        
        let totalVal = products.reduce((s, p) => s + (p.stock * (p.sourcing_cost_usd || 0)), 0);
        document.getElementById('inventoryValue').textContent = `৳${finance.toBDT(totalVal).toLocaleString()}`;

        // Select injection
        document.getElementById('invAssetSelect').innerHTML = `
            <option value="">Select an asset...</option>
            ${products.map(p => `<option value="${p.id}">${p.name} (Current: ${p.stock})</option>`).join('')}
        `;

        // Table
        if (invTable) invTable.destroy();
        invTable = new Tabulator("#inventoryTerminalTable", {
            data: products,
            layout: "fitColumns",
            height: "100%",
            columns: [
                {title: "ASSET", field: "name", widthGrow: 2},
                {title: "SKU_CODE", field: "slug", width: 150, formatter: (cell) => `<span class="tabular dim-label">${cell.getValue()}</span>`},
                {title: "STOCK", field: "stock", hozAlign: "center", width: 100, formatter: (cell) => {
                    const s = cell.getValue();
                    return `<span class="${s < 10 ? 'text-danger semi-bold' : ''}">${s}</span>`;
                }},
                {title: "VALUE", field: "id", width: 120, hozAlign: "right", formatter: (cell) => {
                    const d = cell.getData();
                    const val = d.stock * (d.sourcing_cost_usd || 0);
                    return `<span class="tabular">৳${finance.toBDT(val).toLocaleString()}</span>`;
                }},
                {title: "SYNC_STAMP", field: "id", width: 150, formatter: (cell) => {
                    const d = cell.getData();
                    const sync = invMap[d.id]?.updatedAt;
                    return `<span class="dim-label" style="font-size:0.7rem;">${sync?.toDate().toLocaleString() || 'LEGACY_DATA'}</span>`;
                }}
            ]
        });

        document.getElementById('inventorySearch').oninput = (e) => {
            invTable.setFilter("name", "like", e.target.value);
        };

    } catch (e) { console.error(e); }
}

function setupInventoryUI() {
    document.getElementById('addInventoryBtn').onclick = () => {
        document.getElementById('invModal').style.display = 'flex';
    };

    document.getElementById('invAdjustForm').onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('invAssetSelect').value;
        const adj = parseInt(document.getElementById('invAdjAmt').value);
        
        if (!id) return;

        try {
            const invDoc = doc(db, 'inventory', id);
            const snap = await getDocs(collection(db, 'inventory')); // Simplified for now
            const currentStock = (await (await getDocs(query(collection(db, 'inventory')))).docs.find(d => d.id === id))?.data()?.stock || 0;
            
            await updateDoc(invDoc, {
                stock: currentStock + adj,
                updatedAt: serverTimestamp()
            });

            showToast('Inventory Synchronized', 'success');
            document.getElementById('invModal').style.display = 'none';
            loadInventoryData();
        } catch (e) { showToast('Uplink Failed', 'error'); }
    };

    document.getElementById('exportInventoryBtn').onclick = () => {
        if (invTable) invTable.download("csv", `warehouse_stock_${new Date().toISOString().slice(0,10)}.csv`);
    };
}
