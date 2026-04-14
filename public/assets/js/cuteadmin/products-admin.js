import {
    collection, doc, addDoc, updateDoc, deleteDoc,
    getDoc, getDocs, query, orderBy, serverTimestamp, writeBatch
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db, app } from './db.js';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject }
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { showToast } from './utils.js';
import { finance } from './finance-engine.js';

const storage = getStorage(app);

export async function renderProductsPage() {
    const container = document.getElementById('mainContentArea');
    if (!container) return;

    container.innerHTML = `
        <div class="module-container animate-fade-in" style="padding: 24px;">
            <div class="module-header" style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px;">
                <div>
                    <h2 style="font-size: 1.5rem; font-weight: 800; margin:0;">Catalog Terminal</h2>
                    <p style="color:var(--text-muted); font-size:0.85rem;">Inventory Index & Strategic SKU Management</p>
                </div>
                <div style="display: flex; gap: 12px;">
                    <button id="exportProductsBtn" class="premium-btn">
                        <i class="ph ph-export"></i> EXPORT_ASSETS
                    </button>
                    <button id="addProductBtn" class="premium-btn primary">
                        <i class="ph ph-plus-bold"></i> ADD ASSET
                    </button>
                </div>
            </div>

            <!-- Strategic Metrics -->
            <div class="metrics-strip" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px;">
                <div class="mini-card">
                    <span class="label">TOTAL SKUs</span>
                    <div class="val" id="totalSkuCount">--</div>
                </div>
                <div class="mini-card">
                    <span class="label">STOCK VALUE</span>
                    <div class="val" id="totalStockValue">--</div>
                </div>
                <div class="mini-card">
                    <span class="label">AVG MARGIN</span>
                    <div class="val accent" id="avgCatalogMargin">--</div>
                </div>
                <div class="mini-card">
                    <span class="label">LOW STOCK</span>
                    <div class="val crit" id="lowStockAlerts">--</div>
                </div>
            </div>

            <!-- Filters -->
            <div class="terminal-controls" style="display: flex; gap: 8px; margin-bottom: 16px; align-items: center;">
                <div class="search-box-v2">
                    <i class="ph ph-magnifying-glass"></i>
                    <input type="text" id="productSearch" placeholder="Filter by Name, SKU, Slug...">
                </div>
                <div class="filter-pills">
                    <button class="pill active" data-filter="all">ALL</button>
                    <button class="pill" data-filter="perfume">PERFUMES</button>
                    <button class="pill" data-filter="digital">DIGITAL</button>
                    <button class="pill" data-filter="low_stock">OOS / LOW</button>
                </div>
            </div>

            <!-- Tabulator Container -->
            <div id="productsTerminalTable" style="background: var(--bg-surface); border-radius: 12px; height: 600px; overflow: hidden; border: 1px solid var(--border);"></div>
            
            <div id="tableLoader" class="terminal-loader" style="display:none;">
                <div class="scanner"></div>
                <span>Syncing catalog...</span>
            </div>
        </div>

        <!-- Asset Forensic & Edit Modal -->
        <div id="assetForensicModal" class="terminal-modal" style="display:none;">
            <div class="modal-surface" style="max-width: 850px;">
                <div class="modal-header-v2">
                    <h3 id="assetModalTitle">Asset Diagnostic: NULL</h3>
                    <button onclick="document.getElementById('assetForensicModal').style.display='none'" class="icon-btn"><i class="ph ph-x"></i></button>
                </div>
                <form id="assetForensicForm" class="terminal-form" style="padding:24px;">
                    <input type="hidden" id="assetId">
                    <div style="display:grid; grid-template-columns: 1fr 2fr; gap:32px;">
                        <!-- Media & Telemetry -->
                        <div style="display:flex; flex-direction:column; gap:16px;">
                            <div id="assetImagePreview" style="aspect-ratio:1; background:var(--bg-deep); border:1px solid var(--border); border-radius:12px; overflow:hidden; display:flex; align-items:center; justify-content:center; box-shadow: inset 0 4px 12px rgba(0,0,0,0.5);">
                                <i class="ph ph-image" style="font-size:3rem; color:var(--text-dim);"></i>
                            </div>
                            <div class="input-group">
                                <label style="font-size:0.6rem;">IMAGE_PATH</label>
                                <input type="text" id="assetImageUrl" placeholder="https://..." class="tabular" style="font-size:0.7rem;">
                            </div>
                            
                            <div class="mini-stats-stack" style="background:rgba(0,0,0,0.2); border-radius:10px; padding:16px; border:1px solid var(--border);">
                                <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
                                    <span class="dim-label">LIVE_STOCK</span>
                                    <span class="val semi-bold accent" id="assetStockVal">0</span>
                                </div>
                                <div style="display:flex; justify-content:space-between;">
                                    <span class="dim-label">ASSET_CLASS</span>
                                    <span class="badge-v2" id="assetClassBadge">ALPHA_VAL</span>
                                </div>
                            </div>
                        </div>

                        <!-- Data Calibration -->
                        <div class="form-grid">
                            <div class="form-section span-3">
                                <label>ASSET_NAME</label>
                                <input type="text" id="assetName" required>
                            </div>
                            <div class="form-section span-1">
                                <label>PROTOCOL (SLUG)</label>
                                <input type="text" id="assetSlug" class="tabular" required>
                            </div>
                            <div class="form-section span-1">
                                <label>MARKET_PRICE (৳)</label>
                                <input type="number" id="assetPrice" class="tabular" required>
                            </div>
                            <div class="form-section span-1">
                                <label>SOURCING (USD)</label>
                                <input type="number" id="assetCost" step="0.01" class="tabular" required>
                            </div>
                            <div class="form-section span-3">
                                <label>TECHNICAL_SPECIFICATIONS (DESC)</label>
                                <textarea id="assetDesc" rows="4"></textarea>
                            </div>
                            <div class="form-section span-1">
                                <label>CATEGORY</label>
                                <select id="assetCategory">
                                    <option value="perfume">PERFUME</option>
                                    <option value="digital">DIGITAL</option>
                                    <option value="gift">GIFT_SET</option>
                                </select>
                            </div>
                            <div class="form-section span-1">
                                <label>DISPLAY_PRIORITY</label>
                                <input type="number" id="assetOrder" value="0">
                            </div>
                            <div class="form-section span-1">
                                <label>VIRTUAL_STOCK</label>
                                <input type="number" id="assetStockInput" value="0">
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer-v2" style="margin-top:24px; display:flex; gap:12px;">
                        <button type="submit" class="premium-btn primary" style="flex:1; justify-content:center;">SYNC_TO_CLOUD</button>
                        <button type="button" id="purgeAssetBtn" class="premium-btn" style="color:var(--danger); border-color:var(--danger-soft);">PURGE_ASSET</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    setupProductsUI();
    await loadProductsTerminal();
}

let productTable = null;

async function loadProductsTerminal(filter = 'all', searchQuery = '') {
    const loader = document.getElementById('tableLoader');
    if (loader) loader.style.display = 'flex';

    try {
        const snap = await getDocs(query(collection(db, 'products'), orderBy('display_order', 'asc')));
        let products = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        const inventorySnap = await getDocs(collection(db, 'inventory'));
        const invMap = {};
        inventorySnap.forEach(d => invMap[d.id] = d.data());

        // Merge and process
        products = products.map(p => {
            const stock = invMap[p.id]?.stock ?? 0;
            const cost = p.sourcing_cost_usd || 0;
            const price = p.price_6ml || p.price || 0;
            const margin = price > 0 ? ((price - cost) / price) * 100 : 0;
            return { ...p, stock, margin };
        });

        // Update Stats
        document.getElementById('totalSkuCount').textContent = products.length;
        document.getElementById('lowStockAlerts').textContent = products.filter(p => p.stock < 5).length;
        let totalVal = 0;
        products.forEach(p => totalVal += (p.stock * (p.sourcing_cost_usd || 0)));
        document.getElementById('totalStockValue').innerHTML = `৳${finance.toBDT(totalVal).toLocaleString()}`;

        // Initialize/Update Tabulator
        if (productTable) productTable.destroy();

        productTable = new Tabulator("#productsTerminalTable", {
            data: products,
            layout: "fitColumns",
            height: "100%",
            selectable: true,
            columns: [
                {formatter:"rowSelection", titleFormatter:"rowSelection", hozAlign:"center", headerSort:false, width: 40},
                {title: "ASSET", field: "name", widthGrow: 2, formatter: (cell) => {
                    const d = cell.getData();
                    return `
                        <div style="display:flex; align-items:center; gap:10px; cursor:pointer;" onclick="window.openAssetForensic('${d.id}')">
                            <img src="${d.image || 'https://ui-avatars.com/api/?name=P'}" style="width:24px; height:24px; border-radius:4px; object-fit:cover;">
                            <div style="font-weight:700; color:var(--accent);">${d.name || d.title} <span class="dim-label" style="font-size:0.7rem;">/${d.slug}</span></div>
                        </div>`;
                }},
                {title: "CATEGORY", field: "category", hozAlign: "center", width: 100},
                {title: "PRICE", field: "price_6ml", hozAlign: "right", width: 120, formatter: (cell) => `৳${finance.toBDT(cell.getValue() || 0).toLocaleString()}`},
                {title: "MARGIN", field: "margin", hozAlign: "center", width: 100, formatter: (cell) => {
                    const m = cell.getValue();
                    return `<span class="margin-label ${m > 40 ? 'high' : 'low'}">${m.toFixed(0)}%</span>`;
                }},
                {title: "STOCK", field: "stock", hozAlign: "center", width: 80, formatter: (cell) => {
                    const s = cell.getValue();
                    return `<span class="${s < 5 ? 'text-danger semi-bold' : ''}">${s}</span>`;
                }},
                {title: "DIAG", width: 80, hozAlign: "right", headerSort: false, formatter: (cell) => `
                    <button class="action-btn edit-trigger" onclick="window.openAssetForensic('${cell.getData().id}')"><i class="ph ph-activity"></i></button>
                `}
            ]
        });

        // Global filter handling
        if (filter !== 'all') productTable.setFilter("category", "=", filter);
        if (searchQuery) productTable.setFilter("name", "like", searchQuery);

    } catch (e) {
        console.error(e);
    } finally {
        if (loader) loader.style.display = 'none';
    }
}

async function openEditModal(id) {
    const pSnap = await getDoc(doc(db, 'products', id));
    const invSnap = await getDoc(doc(db, 'inventory', id));
    if (!pSnap.exists()) return;

    const p = pSnap.data();
    const inv = invSnap.data() || { stock: 0 };

    document.getElementById('productId').value = id;
    document.getElementById('productTitle').value = p.name || '';
    document.getElementById('productSlug').value = p.slug || '';
    document.getElementById('productCategory').value = p.category || 'perfume';
    document.getElementById('productShortDesc').value = p.short_description || '';
    document.getElementById('productPrice6').value = p.price_6ml || p.price || '';
    document.getElementById('productPrice15').value = p.price_15ml || '';
    document.getElementById('productSourcingCost').value = p.sourcing_cost_usd || '';
    document.getElementById('productDisplayOrder').value = p.display_order || 0;
    document.getElementById('productStock').value = inv.stock || 0;
    document.getElementById('productImage').value = p.image || '';

    document.getElementById('modalTitle').textContent = `Evolution: ${p.name}`;
    document.getElementById('productModal').style.display = 'flex';
}

function setupProductsUI() {
    window.openAssetForensic = async (id) => {
        const modal = document.getElementById('assetForensicModal');
        const form = document.getElementById('assetForensicForm');
        form.reset();
        
        const prod = productTable.getData().find(p => p.id === id);
        if (!prod) return;

        document.getElementById('assetId').value = id;
        document.getElementById('assetModalTitle').textContent = `Asset Diagnostic: ${prod.slug?.toUpperCase() || 'NEW'}`;
        document.getElementById('assetName').value = prod.name || '';
        document.getElementById('assetSlug').value = prod.slug || '';
        document.getElementById('assetPrice').value = prod.price_6ml || prod.price || '';
        document.getElementById('assetCost').value = prod.sourcing_cost_usd || 0;
        document.getElementById('assetDesc').value = prod.description || prod.short_description || '';
        document.getElementById('assetCategory').value = prod.category || 'perfume';
        document.getElementById('assetImageUrl').value = prod.image || '';
        document.getElementById('assetStockVal').textContent = prod.stock || 0;
        document.getElementById('assetStockInput').value = prod.stock || 0;
        document.getElementById('assetOrder').value = prod.display_order || 0;

        const previewContainer = document.getElementById('assetImagePreview');
        if (prod.image) {
            previewContainer.innerHTML = `<img src="${prod.image}" style="width:100%; height:100%; object-fit:cover;">`;
        } else {
            previewContainer.innerHTML = `<i class="ph ph-image" style="font-size:3rem; color:var(--text-dim);"></i>`;
        }

        modal.style.display = 'flex';
    };

    document.getElementById('addProductBtn').onclick = () => {
        document.getElementById('assetId').value = '';
        document.getElementById('assetModalTitle').textContent = 'Initialize New Asset';
        document.getElementById('assetForensicForm').reset();
        document.getElementById('assetImagePreview').innerHTML = `<i class="ph ph-image" style="font-size:3rem; color:var(--text-dim);"></i>`;
        document.getElementById('assetForensicModal').style.display = 'flex';
    };
    
    document.getElementById('exportProductsBtn').onclick = () => {
        if (productTable) productTable.download("csv", `arczen_catalog_${new Date().toISOString().slice(0,10)}.csv`);
    };
    
    document.getElementById('productSearch').oninput = (e) => loadProductsTerminal(window._lastFilter || 'all', e.target.value);
    
    document.querySelectorAll('.pill[data-filter]').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            window._lastFilter = btn.dataset.filter;
            loadProductsTerminal(btn.dataset.filter, document.getElementById('productSearch').value);
        }
    });

    document.getElementById('assetForensicForm').onsubmit = saveProduct;

    document.getElementById('purgeAssetBtn').onclick = async () => {
        const id = document.getElementById('assetId').value;
        if (!id) return;
        if (!confirm('VAULT_PURGE: Are you sure you want to delete this asset record permanently?')) return;

        try {
            await deleteDoc(doc(db, 'products', id));
            showToast('Asset Purged from Ledger', 'success');
            document.getElementById('assetForensicModal').style.display = 'none';
            loadProductsTerminal();
        } catch (e) { showToast('Purge Failed', 'error'); }
    };
}

async function saveProduct(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    
    try {
        const id = document.getElementById('assetId').value;
        const data = {
            name: document.getElementById('assetName').value,
            slug: document.getElementById('assetSlug').value,
            category: document.getElementById('assetCategory').value,
            description: document.getElementById('assetDesc').value,
            price_6ml: parseFloat(document.getElementById('assetPrice').value) || 0,
            sourcing_cost_usd: parseFloat(document.getElementById('assetCost').value) || 0,
            display_order: parseInt(document.getElementById('assetOrder').value) || 0,
            image: document.getElementById('assetImageUrl').value,
            updatedAt: serverTimestamp()
        };

        const stock = parseInt(document.getElementById('assetStockInput').value) || 0;
        const batch = writeBatch(db);
        const targetId = id || doc(collection(db, 'products')).id;

        batch.set(doc(db, 'products', targetId), data, { merge: true });
        batch.set(doc(db, 'inventory', targetId), { stock, updatedAt: serverTimestamp() }, { merge: true });

        await batch.commit();
        showToast('Asset Commited', 'success');
        document.getElementById('assetForensicModal').style.display = 'none';
        loadProductsTerminal();
    } catch (err) { console.error(err); showToast('Terminal Error', 'error'); }
    finally { btn.disabled = false; }
}

async function confirmDelete(id, title) {
    if (confirm(`PURGE ASSET: ${title}?`)) {
        await deleteDoc(doc(db, 'products', id));
        showToast('Asset Purged', 'neutral');
        loadProductsTerminal();
    }
}
