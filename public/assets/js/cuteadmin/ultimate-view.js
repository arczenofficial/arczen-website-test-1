// Touch of the Founder (formerly Ultimate View)
// Provides unrestricted access to all Firestore collections
import {
    collection,
    getDocs,
    doc,
    setDoc,
    deleteDoc,
    addDoc,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from './db.js';
import { showToast } from './utils.js';
import { logSystemAction } from './db.js';

// List of all known collections in the system
const COLLECTIONS = [
    { id: 'tasks', name: 'Tasks (Work Items)', type: 'core' },
    { id: 'users', name: 'Users (Team)', type: 'core' },
    { id: 'projects', name: 'Projects', type: 'ims' },
    { id: 'customers', name: 'Customers', type: 'ims' },
    { id: 'invoices', name: 'Invoices', type: 'ims' },
    { id: 'products', name: 'Assets (Catalog)', type: 'ims' },
    { id: 'orders', name: 'Transactions', type: 'ims' },
    { id: 'system_audit', name: 'System Logs', type: 'audit' },
    { id: 'equity', name: 'Equity Config', type: 'finance' }
];

// Default Templates for Creation
const TEMPLATES = {
    'tasks': {
        title: "New Task Title",
        description: "Task description...",
        status: "pending", // pending, in_progress, done
        priority: "medium", // low, medium, high
        assignedTo: "",
        assignedToName: "",
        deadline: new Date().toISOString()
    },
    'users': {
        name: "New User",
        email: "user@example.com",
        role: "employee", // admin, moderator, employee
        status: "active"
    },
    'projects': {
        name: "New Project",
        status: "planning",
        budget: 0,
        location: "Dhaka",
        customerId: ""
    },
    'customers': {
        name: "Customer Name",
        company: "Company Ltd",
        email: "client@example.com",
        phone: "+880",
        status: "current"
    },
    'invoices': {
        invoiceNumber: "INV-2024-0000",
        status: "draft",
        total: 0,
        items: []
    }
};

let table = null;
let currentCollection = 'tasks';

export function renderUltimateView() {
    const content = document.getElementById('mainContentArea');
    if (!content) return;

    // Security Check
    if (window.CuteState.role !== 'admin') {
        content.innerHTML = `
            <div class="card" style="text-align: center; padding: 3rem; color: #ef4444;">
                <i class="material-icons-round" style="font-size: 4rem;">gpp_bad</i>
                <h2>Access Denied</h2>
                <p>Only the Founder (Admin) can access this area.</p>
            </div>
        `;
        return;
    }

    content.innerHTML = `
        <div class="ultimate-header" style="margin-bottom: 2rem;">
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <div>
                    <h1 style="font-family: 'Outfit', sans-serif; font-weight: 700; background: linear-gradient(135deg, #6366f1, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 2.5rem; margin-bottom: 0.5rem;">
                        Touch of the Founder
                    </h1>
                    <p style="color: #64748b; font-size: 1.1rem;">Absolute control over every atom of data.</p>
                </div>
            </div>
            
            <div class="control-panel" style="background: white; padding: 1.5rem; border-radius: 16px; margin-top: 2rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                <label style="display: block; font-size: 0.85rem; font-weight: 600; color: #475569; margin-bottom: 1rem;">TARGET MATRIX (COLLECTION)</label>
                
                <!-- Horizontal Scrollable Container -->
                <div id="collectionButtons" style="
                    display: flex; 
                    gap: 0.75rem; 
                    overflow-x: auto; 
                    padding-bottom: 0.5rem;
                    scrollbar-width: thin;
                    white-space: nowrap;
                    margin-bottom: 1.5rem;
                ">
                    ${COLLECTIONS.map(c => `
                        <button class="btn-collection ${c.id === currentCollection ? 'active' : ''}" 
                                data-id="${c.id}"
                                style="
                                    flex: 0 0 auto;
                                    padding: 0.6rem 1.2rem; 
                                    border-radius: 50px; 
                                    border: 1px solid #e2e8f0; 
                                    background: ${c.id === currentCollection ? '#6366f1' : 'white'}; 
                                    color: ${c.id === currentCollection ? 'white' : '#64748b'};
                                    font-weight: 500;
                                    cursor: pointer;
                                    transition: all 0.2s;
                                    display: flex; align-items: center; gap: 6px;
                                ">
                            ${getCollectionIcon(c.id)} ${c.name}
                        </button>
                    `).join('')}
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f1f5f9; padding-top: 1.5rem;">
                    <div style="display: flex; gap: 1rem; align-items: center;">
                         <span id="recordCount" style="font-size: 0.9rem; color: #64748b; font-weight: 500;">0 Records Found</span>
                         <span style="width: 1px; height: 16px; background: #cbd5e1;"></span>
                         <button id="deleteSelectedBtn" class="btn-text" style="color: #ef4444; font-size: 0.9rem; display: none;">
                            <i class="material-icons-round" style="font-size: 18px;">delete_sweep</i> Delete Selected (<span id="selectedCount">0</span>)
                         </button>
                    </div>

                    <div style="display: flex; gap: 0.75rem;">
                        <button class="btn-secondary" id="refreshBtn" style="padding: 0.6rem 1rem;">
                            <i class="material-icons-round">refresh</i> Refresh
                        </button>
                        <button class="btn-primary" id="addRecordBtn" style="padding: 0.6rem 1.2rem; background: linear-gradient(135deg, #6366f1, #8b5cf6);">
                            <i class="material-icons-round">add</i> Create Entity
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div id="loadingState" style="text-align: center; padding: 4rem; display: none;">
            <div class="spinner" style="width: 40px; height: 40px; border-width: 4px; border-color: #6366f1 #e0e7ff #e0e7ff #e0e7ff;"></div>
            <p style="margin-top: 1rem; color: #64748b; font-weight: 500;">Accessing the Matrix...</p>
        </div>

        <div id="tableContainer" style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); height: 650px;"></div>
    `;

    // Initialize Event Listeners
    const refreshBtn = document.getElementById('refreshBtn');
    const addBtn = document.getElementById('addRecordBtn');
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');

    document.querySelectorAll('.btn-collection').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.btn-collection').forEach(b => {
                b.style.background = 'white';
                b.style.color = '#64748b';
                b.classList.remove('active');
            });
            btn.style.background = '#6366f1';
            btn.style.color = 'white';
            btn.classList.add('active');

            currentCollection = btn.dataset.id;
            loadCollection(currentCollection);
        });
    });

    refreshBtn.addEventListener('click', () => loadCollection(currentCollection));
    addBtn.addEventListener('click', () => showEditorModal(currentCollection));

    document.getElementById('batchEditBtn').addEventListener('click', () => {
        const selected = table.getSelectedData();
        if (selected.length > 0) openBatchEditModal(currentCollection, selected);
    });

    document.getElementById('transformBtn').addEventListener('click', () => {
        const selected = table.getSelectedData();
        if (selected.length > 0) openScriptTransformModal(currentCollection, selected);
    });

    document.getElementById('exportViewBtn').addEventListener('click', () => {
        if (table) table.download("csv", `${currentCollection}_export_${new Date().toISOString().slice(0,10)}.csv`);
    });

    document.getElementById('importJsonBtn').addEventListener('click', () => openJsonImportModal(currentCollection));

    deleteSelectedBtn.addEventListener('click', () => {
        const selectedData = table.getSelectedData();
        if (selectedData.length > 0) {
            confirmDeleteMultiple(currentCollection, selectedData);
        }
    });

    loadCollection(currentCollection);
}

function openBatchEditModal(collectionName, selectedDocs) {
    const field = prompt(`BATCH_EDIT: Enter field name to modify for ${selectedDocs.length} records:`);
    if (!field) return;
    const value = prompt(`Enter new value for [${field}]:`);
    if (value === null) return;

    if (confirm(`Confirm: Overwrite [${field}] with "${value}" for ${selectedDocs.length} entities?`)) {
        performBatchUpdate(collectionName, selectedDocs, (doc) => {
            doc[field] = value;
            return doc;
        });
    }
}

function openScriptTransformModal(collectionName, selectedDocs) {
    const script = prompt(`GOD_MODE: Enter JS function body to transform records.\n\nExample: doc.price = doc.price * 1.1; return doc;\n\nVariables: doc (current record object)`, "doc.updatedAt = new Date(); return doc;");
    if (!script) return;

    try {
        const transformFn = new Function('doc', script);
        
        // --- PREVIEW STEP ---
        const previewDocs = selectedDocs.slice(0, 3).map(d => {
            const transformed = transformFn({ ...d });
            return { original: d, modified: transformed };
        });

        const previewMsg = previewDocs.map((p, i) => 
            `MATCH ${i+1} [ID: ${p.original.id}]:\n` + 
            `  BEFORE: ${JSON.stringify(p.original).slice(0, 80)}...\n` +
            `  AFTER:  ${JSON.stringify(p.modified).slice(0, 80)}...`
        ).join('\n\n');

        if (confirm(`⚠️ SCRIPT PREVIEW (First 3 Records) ⚠️\n\n${previewMsg}\n\nProceed with full synchronization of ${selectedDocs.length} entities?`)) {
            performBatchUpdate(collectionName, selectedDocs, transformFn);
        }
    } catch (e) {
        alert("Script Syntax Error: " + e.message);
    }
}

async function performBatchUpdate(collectionName, selectedDocs, transformFn) {
    const batch = writeBatch(db);
    let successCount = 0;
    
    try {
        selectedDocs.forEach(data => {
            const transformed = transformFn({ ...data }); // Clone and transform
            if (transformed) {
                const { id, ...updates } = transformed;
                // Add server metadata
                updates.mod_audit = {
                    by: window.CuteState?.user?.email || 'SYSTEM',
                    at: new Date()
                };
                batch.update(doc(db, collectionName, id), updates);
                successCount++;
            }
        });

        await batch.commit();
        showToast(`COMMITED: ${successCount} entities synchronized.`, "success");
        loadCollection(collectionName);
    } catch (e) {
        console.error(e);
        showToast(`TRANSFORM_FAILURE: ${e.message}`, "error");
    }
}

function getCollectionIcon(id) {
    const map = {
        'tasks': '<i class="material-icons-round" style="font-size: 18px;">task_alt</i>',
        'users': '<i class="material-icons-round" style="font-size: 18px;">people</i>',
        'projects': '<i class="material-icons-round" style="font-size: 18px;">work</i>',
        'customers': '<i class="material-icons-round" style="font-size: 18px;">store</i>',
        'invoices': '<i class="material-icons-round" style="font-size: 18px;">receipt</i>',
        'invoiceLogs': '<i class="material-icons-round" style="font-size: 18px;">history</i>',
        'notifications': '<i class="material-icons-round" style="font-size: 18px;">notifications</i>',
        'system_audit': '<i class="material-icons-round" style="font-size: 18px;">security</i>',
        'deleted_invoices': '<i class="material-icons-round" style="font-size: 18px;">delete_forever</i>'
    };
    return map[id] || '';
}

async function loadCollection(collectionName) {
    const tableContainer = document.getElementById('tableContainer');
    const loadingState = document.getElementById('loadingState');
    const recordCountEl = document.getElementById('recordCount');

    if (!tableContainer || !loadingState) return;

    tableContainer.style.visibility = 'hidden';
    loadingState.style.display = 'block';

    try {
        const querySnapshot = await getDocs(collection(db, collectionName));
        const data = [];
        const allKeys = new Set(['id']);

        querySnapshot.forEach((doc) => {
            const docData = doc.data();
            data.push({ id: doc.id, ...docData });
            Object.keys(docData).forEach(key => allKeys.add(key));
        });

        if (recordCountEl) recordCountEl.textContent = `${data.length} Records Found`;

        const columns = Array.from(allKeys).map(key => {
            return {
                title: key.charAt(0).toUpperCase() + key.slice(1),
                field: key,
                formatter: (cell) => {
                    const val = cell.getValue();
                    if (val === null || val === undefined) return `<span style="color: #cbd5e1;">-</span>`;
                    if (typeof val === 'object') {
                        if (val.seconds) return new Date(val.seconds * 1000).toLocaleString();
                        return `<span style="color: #6366f1; font-size: 0.8rem;">{ Object }</span>`;
                    }
                    if (typeof val === 'boolean') return val ? '✅' : '❌';
                    if (key.toLowerCase().includes('photo') || key.toLowerCase().includes('img')) {
                        return `<img src="${val}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">`;
                    }
                    return val;
                },
                headerFilter: "input",
                width: 150
            };
        });

        columns.unshift({
            title: "Actions",
            field: "actions",
            formatter: () => `
                <div style="display: flex; gap: 5px;">
                    <button class="btn-icon edit-row" style="color: #3b82f6; background: #eff6ff; padding: 4px; border-radius: 4px; border: none; cursor: pointer;">
                        <i class="material-icons-round" style="font-size: 16px;">edit</i>
                    </button>
                    <button class="btn-icon delete-row" style="color: #ef4444; background: #fef2f2; padding: 4px; border-radius: 4px; border: none; cursor: pointer;">
                        <i class="material-icons-round" style="font-size: 16px;">delete</i>
                    </button>
                </div>
            `,
            width: 100,
            frozen: true,
            headerSort: false
        });

        if (table) table.destroy();

        table = new Tabulator("#tableContainer", {
            data: data,
            layout: "fitDataFill",
            columns: columns,
            selectable: true,
            pagination: true,
            paginationSize: 50,
            paginationCounter: "rows",
            height: "100%",
            placeholder: "No Data Found in Matrix",
            rowHeight: 40,
        });

        table.on("rowSelectionChanged", function (data) {
            const btn = document.getElementById('bulkActionsToolbar');
            const countSpan = document.getElementById('selectedCount');
            if (data.length > 0) {
                btn.style.display = 'flex';
                countSpan.textContent = data.length;
            } else {
                btn.style.display = 'none';
            }
        });

        table.on("rowClick", function (e, row) {
            const target = e.target.closest('button');
            if (!target) return;
            const rowData = row.getData();

            if (target.classList.contains('edit-row')) {
                showEditorModal(collectionName, rowData.id, rowData);
            } else if (target.classList.contains('delete-row')) {
                confirmDelete(collectionName, rowData.id);
            }
        });

    } catch (error) {
        showToast(`Failed to access matrix: ${error.message}`, "error");
    } finally {
        loadingState.style.display = 'none';
        tableContainer.style.visibility = 'visible';
    }
}

async function confirmDelete(collectionName, docId) {
    if (confirm(`⚠️ PERMANENT DELETION WARNING ⚠️\n\nDelete [${docId}]?`)) {
        try {
            await deleteDoc(doc(db, collectionName, docId));
            logSystemAction('founder_delete', `Deleted ${docId} from ${collectionName}`, { collection: collectionName, docId });
            showToast("Document erased.", "success");
            loadCollection(collectionName);
        } catch (error) {
            showToast("Deletion failed: " + error.message, "error");
        }
    }
}

async function confirmDeleteMultiple(collectionName, rowsData) {
    if (confirm(`⚠️ DELETING ${rowsData.length} RECORDS. Proceed?`)) {
        try {
            const batch = writeBatch(db);
            const ids = [];
            rowsData.forEach(row => {
                const ref = doc(db, collectionName, row.id);
                batch.delete(ref);
                ids.push(row.id);
            });
            await batch.commit();
            logSystemAction('founder_batch_delete', `Batch deleted ${ids.length} docs from ${collectionName}`, { collection: collectionName, ids });
            showToast(`${ids.length} records erased.`, "success");
            loadCollection(collectionName);
            document.getElementById('deleteSelectedBtn').style.display = 'none';
        } catch (error) {
            showToast("Batch deletion failed: " + error.message, "error");
        }
    }
}

// --- NEW FIELD EDITOR SYSTEM ---

function showEditorModal(collectionName, docId = null, currentData = null) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.zIndex = '10000';

    // Prepare Data
    let workingData = {};
    if (currentData) {
        const { id, ...rest } = currentData;

        // Convert timestamps for editor
        Object.keys(rest).forEach(key => {
            if (rest[key] && typeof rest[key] === 'object' && rest[key].seconds) {
                try {
                    workingData[key] = new Date(rest[key].seconds * 1000).toISOString();
                } catch (e) { workingData[key] = rest[key]; }
            } else {
                workingData[key] = rest[key];
            }
        });
    } else {
        // Use Template if New
        const template = TEMPLATES[collectionName] || {};
        workingData = {
            ...template,
            createdAt: new Date().toISOString(),
            createdBy: window.CuteState?.user?.uid || "admin"
        };
    }

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 900px; height: 85vh; display: flex; flex-direction: column;">
            <div class="modal-header">
                <h2>${docId ? 'Modify Reality' : 'Fabricate Entity'} <span style="font-size: 0.8em; color: #64748b; font-weight: 400;">@ ${collectionName}</span></h2>
                <div style="margin-left: auto; display: flex; gap: 10px; align-items: center;">
                    <label class="switch-ims">
                        <input type="checkbox" id="modeSwitch">
                        <span class="slider round"></span>
                    </label>
                    <span style="font-size: 0.9rem; font-weight: 600;">JSON Mode</span>
                    <button class="modal-close" style="margin-left: 10px;">&times;</button>
                </div>
            </div>
            
            <!-- Structural Editor -->
            <div id="fieldEditorContainer" style="flex: 1; overflow-y: auto; padding: 1rem; background: #f8fafc; border-radius: 8px;">
                <div id="fieldsList"></div>
                
                <button id="addFieldBtn" class="btn-secondary" style="width: 100%; margin-top: 1rem; border-style: dashed;">
                    <i class="material-icons-round">add</i> Add Field
                </button>
            </div>

            <!-- JSON Editor (Hidden by default) -->
            <div id="jsonEditorContainer" style="flex: 1; display: none; flex-direction: column; overflow: hidden; padding: 1rem 0;">
                <textarea id="jsonEditor" style="flex: 1; font-family: 'Consolas', 'Monaco', monospace; font-size: 14px; padding: 1rem; border: 1px solid #cbd5e1; border-radius: 8px; resize: none; background: #1e293b; color: #f8fafc; line-height: 1.5;"></textarea>
            </div>

            <div class="modal-actions" style="border-top: 1px solid #e2e8f0; padding-top: 1rem;">
                 <div style="margin-right: auto; font-size: 0.9rem; color: #64748b;">
                    ID: ${docId || 'Auto-generated'}
                 </div>
                <button class="btn-secondary modal-close">Cancel</button>
                <button id="saveEntityBtn" class="btn-primary" style="background: linear-gradient(135deg, #10b981, #059669);">
                    <i class="material-icons-round">save</i> ${docId ? 'Overwrite' : 'Create'}
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const fieldsList = document.getElementById('fieldsList');
    const jsonEditor = document.getElementById('jsonEditor');
    const fieldContainer = document.getElementById('fieldEditorContainer');
    const jsonContainer = document.getElementById('jsonEditorContainer');
    const modeSwitch = document.getElementById('modeSwitch');

    // Initialize JSON
    jsonEditor.value = JSON.stringify(workingData, null, 4);

    // Render Fields Function
    function renderFields(data) {
        fieldsList.innerHTML = '';
        Object.entries(data).forEach(([key, value]) => {
            addFieldRow(key, value);
        });
    }

    function addFieldRow(key = "", value = "") {
        const type = typeof value === 'boolean' ? 'boolean' :
            typeof value === 'number' ? 'number' :
                (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) ? 'timestamp' : 'string';

        const row = document.createElement('div');
        row.className = 'field-row';
        row.style = "display: grid; grid-template-columns: 2fr 1.5fr 3fr 40px; gap: 10px; margin-bottom: 8px; align-items: center;";

        row.innerHTML = `
            <input type="text" class="field-key" value="${key}" placeholder="Field Name" style="padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px;">
            <select class="field-type" style="padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px; bg: white;">
                <option value="string" ${type === 'string' ? 'selected' : ''}>String</option>
                <option value="number" ${type === 'number' ? 'selected' : ''}>Number</option>
                <option value="boolean" ${type === 'boolean' ? 'selected' : ''}>Boolean</option>
                <option value="timestamp" ${type === 'timestamp' ? 'selected' : ''}>Timestamp</option>
            </select>
            <div class="value-container" style="display:flex;">
                ${getValueInputHTML(type, value)}
            </div>
            <button class="btn-icon delete-field" style="color: #ef4444; cursor: pointer;"><i class="material-icons-round">close</i></button>
        `;

        // Type Change Listener
        row.querySelector('.field-type').addEventListener('change', (e) => {
            const newType = e.target.value;
            const valContainer = row.querySelector('.value-container');
            const currentVal = getInputValue(row); // Try to preserve value if compatible
            valContainer.innerHTML = getValueInputHTML(newType, currentVal);
        });

        // Delete Listener
        row.querySelector('.delete-field').addEventListener('click', () => row.remove());

        fieldsList.appendChild(row);
    }

    function getValueInputHTML(type, value) {
        if (type === 'boolean') {
            const isTrue = value === true || value === 'true';
            return `
                <select class="field-value" style="flex:1; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px;">
                    <option value="true" ${isTrue ? 'selected' : ''}>true</option>
                    <option value="false" ${!isTrue ? 'selected' : ''}>false</option>
                </select>
            `;
        } else if (type === 'timestamp') {
            // Try to format for datetime-local (requires YYYY-MM-DDTHH:mm)
            let dateVal = value;
            try { dateVal = value.split('.')[0]; } catch (e) { }
            return `<input type="datetime-local" class="field-value" value="${dateVal}" style="flex:1; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px;">`;
        } else if (type === 'number') {
            return `<input type="number" class="field-value" value="${value}" style="flex:1; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px;">`;
        } else {
            // String (and Objects fallback for now)
            const displayVal = typeof value === 'object' ? JSON.stringify(value) : value;
            return `<input type="text" class="field-value" value="${displayVal}" style="flex:1; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px;">`;
        }
    }

    function getInputValue(row) {
        const type = row.querySelector('.field-type').value;
        const valInput = row.querySelector('.field-value');

        if (type === 'boolean') return valInput.value === 'true';
        if (type === 'number') return parseFloat(valInput.value) || 0;
        if (type === 'timestamp') return new Date(valInput.value).toISOString();
        return valInput.value;
    }

    // Initialize UI
    renderFields(workingData);

    // Add Field Button
    document.getElementById('addFieldBtn').onclick = () => addFieldRow("", "");

    // Mode Switcher
    modeSwitch.addEventListener('change', (e) => {
        if (e.target.checked) {
            // Switch to JSON: Gather data from UI
            const data = gatherDataFromUI();
            jsonEditor.value = JSON.stringify(data, null, 4);
            fieldContainer.style.display = 'none';
            jsonContainer.style.display = 'flex';
        } else {
            // Switch to UI: Parse JSON
            try {
                const data = JSON.parse(jsonEditor.value);
                renderFields(data);
                jsonContainer.style.display = 'none';
                fieldContainer.style.display = 'block';
            } catch (err) {
                alert("Invalid JSON. Fix syntax before switching back.");
                e.target.checked = true;
            }
        }
    });

    function gatherDataFromUI() {
        const data = {};
        document.querySelectorAll('.field-row').forEach(row => {
            const key = row.querySelector('.field-key').value.trim();
            if (key) {
                data[key] = getInputValue(row);
            }
        });
        return data;
    }

    // Save Handler
    document.getElementById('saveEntityBtn').onclick = async () => {
        try {
            let info;
            if (modeSwitch.checked) {
                info = JSON.parse(jsonEditor.value); // Get from JSON
            } else {
                info = gatherDataFromUI(); // Get from UI
            }

            // Post-process dates
            Object.keys(info).forEach(key => {
                const val = info[key];
                if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
                    // Heuristic: convert strictly ISO strings to Date objects for Firestore
                    info[key] = new Date(val);
                }
            });

            if (docId) {
                await setDoc(doc(db, collectionName, docId), info);
                showToast("Entity updated.", "success");
            } else {
                const ref = await addDoc(collection(db, collectionName), info);
                showToast(`Created [${ref.id}]`, "success");
            }

            modal.remove();
            loadCollection(collectionName);

        } catch (error) {
            alert("Error:\n" + error.message);
        }
    };

    // Close handlers
    modal.querySelectorAll('.modal-close').forEach(b => b.onclick = () => modal.remove());
}

function openJsonImportModal(collectionName) {
    const data = prompt(`BATCH_FABRICATION: Paste JSON array of objects to import into [${collectionName}]:`);
    if (!data) return;

    try {
        const entities = JSON.parse(data);
        if (!Array.isArray(entities)) throw new Error("Input must be a JSON Array.");
        
        if (confirm(`Confirm: Fabricate ${entities.length} new entities in ${collectionName}?`)) {
            const batch = writeBatch(db);
            entities.forEach(item => {
                const ref = doc(collection(db, collectionName));
                batch.set(ref, { ...item, createdAt: new Date(), fabricated: true });
            });
            batch.commit().then(() => {
                showToast(`SUCCESS: ${entities.length} entities materialized.`, "success");
                loadCollection(collectionName);
            });
        }
    } catch (e) {
        alert("JSON Parse Failure: " + e.message);
    }
}
