import { db } from './db.js';
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { showToast } from './utils.js';

export function renderBulkImportPage() {
    const content = document.getElementById('mainContentArea');
    if (!content) return;

    content.innerHTML = `
        <div class="dashboard-grid animate-fade-in" style="max-width: 800px; margin: 0 auto; padding-top: 40px;">
            <div style="grid-column: span 12; margin-bottom: 24px;">
                <h2 style="font-size: 1.5rem; font-weight: 800; margin:0;"><i class="ph ph-file-csv" style="color:var(--accent);"></i> Bulk CSV Importer</h2>
                <p style="color:var(--text-muted); font-size:0.85rem;">Ingest huge datasets natively into Firestore Collections.</p>
            </div>
            
            <div class="widget-container premium-card" style="grid-column: span 12;">
                <div style="padding: 24px; display: flex; flex-direction: column; gap: 20px;">
                    <div>
                        <label style="display: block; font-size: 0.8rem; font-weight: 800; color: var(--text-dim); margin-bottom: 8px;">Target Collection</label>
                        <select id="importCollection" style="width: 100%; padding: 12px; background: var(--bg-deep); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-weight: 600; outline: none;">
                            <option value="products">Products (Catalog)</option>
                            <option value="posts">Posts (Blog/News)</option>
                        </select>
                    </div>

                    <div>
                        <label style="display: block; font-size: 0.8rem; font-weight: 800; color: var(--text-dim); margin-bottom: 8px;">CSV File</label>
                        <input type="file" id="csvFileInput" accept=".csv" style="width: 100%; padding: 12px; background: var(--bg-deep); border: 1px dashed var(--border); border-radius: 8px; color: var(--text);">
                        <p style="font-size: 0.7rem; color: var(--warning); margin-top: 6px;">Note: First row must contain the header keys (e.g., title, price, category).</p>
                    </div>

                    <button id="importExecuteBtn" class="premium-btn primary" style="width: 100%; justify-content: center; padding: 14px;">
                        <i class="ph ph-upload-simple"></i> INGEST DATA
                    </button>
                    
                    <div id="importStatus" style="font-family: 'JetBrains Mono'; font-size: 0.8rem; color: var(--accent); margin-top: 12px; display: none;"></div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('importExecuteBtn').addEventListener('click', handleCSVImport);
}

async function handleCSVImport() {
    const fileInput = document.getElementById('csvFileInput');
    const collectionName = document.getElementById('importCollection').value;
    const statusDiv = document.getElementById('importStatus');
    const btn = document.getElementById('importExecuteBtn');

    if (!fileInput.files.length) {
        showToast("Please select a CSV file first.", "error");
        return;
    }

    const file = fileInput.files[0];
    
    // Parse using PapaParse
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async function(results) {
            const data = results.data;
            if (!data || !data.length) {
                showToast("CSV is empty or invalid.", "error");
                return;
            }

            btn.disabled = true;
            btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> PROCESSING...';
            statusDiv.style.display = 'block';
            statusDiv.innerText = `Starting ingestion of ${data.length} records into [${collectionName}]...`;

            let successCount = 0;
            let failCount = 0;

            const targetRef = collection(db, collectionName);

            for (let i = 0; i < data.length; i++) {
                try {
                    // Basic cleanup: trim whitespace from keys and values if needed, but PapaParse header:true helps.
                    const rowData = data[i];
                    
                    // Optional: You could cast strings to numbers if they look like numbers,
                    // but doing strict strings by default is safer for generic CSV.
                    // For ArcZen products, maybe check if price exists and cast it:
                    if (rowData.price) rowData.price = parseFloat(rowData.price) || 0;
                    if (rowData.stock) rowData.stock = parseInt(rowData.stock, 10) || 0;
                    
                    // Add creation timestamp to all ingested rows
                    rowData.createdAt = new Date();
                    rowData.isImported = true;

                    await addDoc(targetRef, rowData);
                    successCount++;
                    statusDiv.innerText = `Ingested: ${successCount} / ${data.length} ...`;
                } catch (err) {
                    console.error("Row import error:", err);
                    failCount++;
                }
            }

            statusDiv.innerHTML = `Ingestion complete. <br> Successful: ${successCount} <br> Failed: ${failCount}`;
            showToast(`Bulk Import Complete: ${successCount} added.`, "success");
            
            btn.disabled = false;
            btn.innerHTML = '<i class="ph ph-upload-simple"></i> INGEST DATA';
            fileInput.value = ''; // clear
        },
        error: function(err) {
            console.error("PapaParse Error:", err);
            showToast("Failed to parse CSV file.", "error");
        }
    });
}
