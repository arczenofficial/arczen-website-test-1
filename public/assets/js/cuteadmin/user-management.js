/**
 * Team Management UI — Founder & Super-Admin Only
 * Pure ES6 JavaScript — NO TypeScript annotations (file served from public/)
 */

import { getAllUsers } from './users.js';
import { showToast } from './utils.js';
import {
    doc, setDoc, deleteDoc, serverTimestamp, getDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { db } from './db.js';

var ALL_SECTIONS = [
    { key: 'orders',          label: '📦 Orders',     desc: 'View & manage customer orders' },
    { key: 'products',        label: '🗂 Catalog',     desc: 'Manage product catalog' },
    { key: 'inventory',       label: '🏭 Warehouse',   desc: 'View inventory levels' },
    { key: 'customers',       label: '👥 Users',       desc: 'View store customers' },
    { key: 'analytics',       label: '📈 Analytics',   desc: 'View sales analytics' },
    { key: 'finance',         label: '💰 Accounting',  desc: 'View financial data' },
    { key: 'tasks',           label: '✅ Tasks',       desc: 'Manage team tasks' },
    { key: 'attendance',      label: '📅 Attendance',  desc: 'View attendance records' },
    { key: 'points',          label: '🏅 Points',      desc: 'Manage reward points' },
    { key: 'logs',            label: '📜 Logs',        desc: 'View system & team logs' },
    { key: 'system-settings', label: '⚙️ Settings',    desc: 'Configure company settings' },
];

var ROLE_OPTIONS = [
    { value: 'employee',      label: '👷 Employee',     desc: 'Basic access (permissions apply)' },
    { value: 'moderator',     label: '🛡️ Moderator',    desc: 'Can manage orders & tasks' },
    { value: 'finance_admin', label: '💼 Finance Admin', desc: 'Financial data access' },
    { value: 'super_admin',   label: '👑 Super Admin',   desc: 'Full access (ignores permissions)' },
];

export async function renderUserManagementUI() {
    var content = document.getElementById('mainContentArea');
    if (!content) return;

    var role = window.CuteState.role;
    var isAuthorized = (role === 'founder' || role === 'super_admin');

    if (!isAuthorized) {
        content.innerHTML = `
            <div style="padding:100px; text-align:center;">
                <i class="ph ph-lock-keyhole" style="font-size:4rem; color:var(--danger);"></i>
                <h2 style="margin-top:24px; color:var(--danger);">ACCESS DENIED</h2>
                <p class="dim-label">Team management is restricted to founders and super admins.</p>
            </div>`;
        return;
    }

    content.innerHTML = `
        <div class="module-container animate-fade-in" style="padding:28px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:32px; flex-wrap:wrap; gap:16px;">
                <div>
                    <h2 style="font-size:1.6rem; font-weight:900; margin:0; letter-spacing:-0.02em;">Team Management</h2>
                    <p style="color:var(--text-muted); font-size:0.85rem; margin:4px 0 0;">Provision operators & configure section-level access control</p>
                </div>
                <button id="addMemberBtn" style="display:flex; align-items:center; gap:8px; padding:10px 20px; background:var(--accent); color:var(--bg-deep); border:none; border-radius:10px; font-weight:800; cursor:pointer; font-size:0.85rem;">
                    <i class="ph ph-user-plus"></i> Provision New Member
                </button>
            </div>
            <div id="teamStatsStrip" style="display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:16px; margin-bottom:28px;"></div>
            <div id="teamMembersGrid" style="display:grid; grid-template-columns:repeat(auto-fill,minmax(320px,1fr)); gap:20px;">
                <div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--text-dim);">
                    <div class="tm-spinner" style="margin:0 auto 12px;"></div>Syncing registry...
                </div>
            </div>
        </div>`;

    if (!document.getElementById('tm-styles')) {
        var style = document.createElement('style');
        style.id = 'tm-styles';
        style.textContent = `
            .tm-spinner { width:28px; height:28px; border:3px solid rgba(0,201,188,0.15); border-top-color:var(--accent); border-radius:50%; animation:tm-spin 0.8s linear infinite; }
            @keyframes tm-spin { to { transform:rotate(360deg); } }
            .perm-toggle { display:flex; align-items:center; justify-content:space-between; padding:10px 12px; border-radius:8px; border:1px solid var(--border); background:rgba(255,255,255,0.02); margin-bottom:8px; transition:0.2s; }
            .perm-toggle:hover { background:rgba(0,201,188,0.05); border-color:var(--accent); }
            .switch { position:relative; display:inline-block; width:40px; height:22px; flex-shrink:0; }
            .switch input { opacity:0; width:0; height:0; }
            .switch-slider { position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background:rgba(255,255,255,0.1); border-radius:22px; transition:0.3s; }
            .switch-slider:before { position:absolute; content:""; height:16px; width:16px; left:3px; bottom:3px; background:var(--text-dim); border-radius:50%; transition:0.3s; }
            .switch input:checked + .switch-slider { background:var(--accent); }
            .switch input:checked + .switch-slider:before { transform:translateX(18px); background:#fff; }
            .perm-badge { display:inline-block; padding:3px 8px; border-radius:6px; font-size:0.65rem; font-weight:700; background:rgba(0,201,188,0.1); color:var(--accent); margin:3px 3px 0 0; border:1px solid rgba(0,201,188,0.2); }
            .perm-badge.denied { background:rgba(255,255,255,0.03); color:var(--text-dim); border-color:var(--border); text-decoration:line-through; }
            .member-card { background:var(--bg-surface); border:1px solid var(--border); border-radius:16px; padding:20px; transition:all 0.3s; }
            .member-card:hover { border-color:var(--accent); transform:translateY(-2px); box-shadow:0 10px 30px rgba(0,0,0,0.3); }
            .role-badge { display:inline-block; padding:4px 10px; border-radius:8px; font-size:0.65rem; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; }
            .role-founder { background:rgba(198,167,94,0.15); color:#c6a75e; }
            .role-super_admin { background:rgba(239,68,68,0.1); color:#f87171; }
            .role-finance_admin { background:rgba(16,185,129,0.1); color:#34d399; }
            .role-moderator { background:rgba(59,130,246,0.1); color:#60a5fa; }
            .role-employee { background:rgba(255,255,255,0.05); color:var(--text-dim); }
            .tm-online-dot { width:8px; height:8px; border-radius:50%; display:inline-block; }
            .tm-online { background:#10b981; box-shadow:0 0 6px #10b981; }
            .tm-offline { background:var(--text-dim); }
            .tm-modal-overlay { position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,0.85); display:flex; align-items:center; justify-content:center; padding:20px; }
            .tm-modal-box { width:100%; max-width:580px; max-height:90vh; overflow-y:auto; background:var(--bg-surface); border:1px solid var(--border); padding:28px; border-radius:20px; box-shadow:0 40px 80px rgba(0,0,0,0.8); }
            .tm-input-group { margin-bottom:0; }
            .tm-input-group label { display:block; font-size:0.72rem; font-weight:700; color:var(--text-dim); margin-bottom:6px; text-transform:uppercase; letter-spacing:0.05em; }
            .tm-input-group input, .tm-input-group select { width:100%; padding:10px 14px; background:rgba(255,255,255,0.04); border:1px solid var(--border); border-radius:8px; color:var(--text-main); font-size:0.85rem; outline:none; box-sizing:border-box; }
            .tm-input-group input:focus, .tm-input-group select:focus { border-color:var(--accent); }
        `;
        document.head.appendChild(style);
    }

    document.getElementById('addMemberBtn')?.addEventListener('click', function() { showMemberModal(null); });
    await loadTeamGrid();
}

async function loadTeamGrid() {
    var grid = document.getElementById('teamMembersGrid');
    var statsStrip = document.getElementById('teamStatsStrip');
    if (!grid) return;

    try {
        var members = await getAllUsers();
        var now = new Date();
        var FIVE_MIN = 5 * 60 * 1000;

        var onlineCount = 0;
        members.forEach(function(m) {
            var last = m.lastActiveAt && m.lastActiveAt.toDate ? m.lastActiveAt.toDate() : (m.lastActiveAt ? new Date(m.lastActiveAt) : null);
            m.isOnline = last && (now - last) < FIVE_MIN;
            if (m.isOnline) onlineCount++;
        });

        if (statsStrip) {
            var roleBreakdown = {};
            members.forEach(function(m) { roleBreakdown[m.role] = (roleBreakdown[m.role] || 0) + 1; });
            var stats = [
                { label: 'Total Members', val: members.length, icon: 'ph-users', color: 'var(--accent)' },
                { label: 'Online Now', val: onlineCount, icon: 'ph-circle-wavy-check', color: '#10b981' },
                { label: 'Super Admins', val: roleBreakdown['super_admin'] || 0, icon: 'ph-crown', color: '#f87171' },
                { label: 'Employees', val: roleBreakdown['employee'] || 0, icon: 'ph-user', color: 'var(--text-dim)' },
            ];
            statsStrip.innerHTML = stats.map(function(s) {
                return '<div class="premium-card" style="padding:16px; text-align:center;">' +
                    '<i class="ph ' + s.icon + '" style="font-size:1.5rem; color:' + s.color + ';"></i>' +
                    '<div style="font-size:1.6rem; font-weight:900; margin:8px 0; color:' + s.color + ';">' + s.val + '</div>' +
                    '<div style="font-size:0.7rem; color:var(--text-dim); text-transform:uppercase; font-weight:700;">' + s.label + '</div>' +
                    '</div>';
            }).join('');
        }

        if (members.length === 0) {
            grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:60px; color:var(--text-dim);"><i class="ph ph-users-three" style="font-size:3rem; opacity:0.3;"></i><p style="margin-top:16px;">No team members found. Add your first operator.</p></div>';
            return;
        }

        grid.innerHTML = members.map(function(member) {
            var perms = member.permissions || {};
            var lastSeen = member.lastActiveAt && member.lastActiveAt.toDate ? member.lastActiveAt.toDate().toLocaleString() : 'Never';
            var permBadgesHtml = ALL_SECTIONS.map(function(s) {
                return '<span class="perm-badge ' + (perms[s.key] ? '' : 'denied') + '" title="' + s.desc + '">' + s.label + '</span>';
            }).join('');

            var ava = member.photoUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(member.name || 'A') + '&background=0f171c&color=00C9BC';

            return '<div class="member-card">' +
                '<div style="display:flex; gap:14px; align-items:flex-start; margin-bottom:16px;">' +
                '<div style="position:relative; flex-shrink:0;">' +
                '<img src="' + ava + '" style="width:52px; height:52px; border-radius:12px; object-fit:cover; border:1px solid var(--border);">' +
                '<span class="tm-online-dot ' + (member.isOnline ? 'tm-online' : 'tm-offline') + '" style="position:absolute; bottom:-2px; right:-2px; border:2px solid var(--bg-surface);"></span>' +
                '</div>' +
                '<div style="flex:1; min-width:0;">' +
                '<div style="font-size:1rem; font-weight:800; color:var(--text-main); margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + (member.name || 'Unknown') + '</div>' +
                '<div style="font-size:0.72rem; color:var(--text-dim); margin-bottom:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + (member.email || '') + '</div>' +
                '<span class="role-badge role-' + (member.role || 'employee') + '">' + (member.role || 'employee').replace('_', ' ') + '</span>' +
                '</div></div>' +
                (member.title ? '<div style="font-size:0.72rem; color:var(--accent); font-weight:700; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:12px; font-family:monospace;">' + member.title + '</div>' : '') +
                '<div style="margin-bottom:14px;">' +
                '<div style="font-size:0.65rem; color:var(--text-dim); text-transform:uppercase; font-weight:800; margin-bottom:8px; letter-spacing:0.1em;">Section Access</div>' +
                '<div style="line-height:1.8;">' + permBadgesHtml + '</div>' +
                '</div>' +
                '<div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border); padding-top:12px; margin-bottom:16px;">' +
                '<span style="font-size:0.68rem; color:var(--text-dim); text-transform:uppercase; font-weight:700;">Last Active</span>' +
                '<span style="font-size:0.72rem; color:' + (member.isOnline ? '#10b981' : 'var(--text-dim)') + '; font-family:monospace;">' + (member.isOnline ? '🟢 Online' : lastSeen.split(',')[0]) + '</span>' +
                '</div>' +
                '<div style="display:flex; gap:8px;">' +
                '<button class="pill" style="flex:1; font-size:0.75rem; padding:8px; cursor:pointer;" onclick="window._tmEdit(\'' + member.id + '\')">' +
                '<i class="ph ph-sliders"></i> Configure' +
                '</button>' +
                '<button class="pill" style="background:rgba(239,68,68,0.1); color:var(--danger); border-color:rgba(239,68,68,0.3); font-size:0.75rem; padding:8px 12px; cursor:pointer;" onclick="window._tmRemove(\'' + member.id + '\', \'' + (member.name || '').replace(/'/g, "\\'") + '\')">' +
                '<i class="ph ph-trash"></i>' +
                '</button>' +
                '</div></div>';
        }).join('');

    } catch (err) {
        console.error('[TeamMgmt] Load error:', err);
        grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--danger);">Failed to load team members: ' + err.message + '</div>';
    }
}

function buildPermissionsHTML(existing) {
    existing = existing || {};
    return ALL_SECTIONS.map(function(s) {
        return '<div class="perm-toggle">' +
            '<div style="flex:1;">' +
            '<div style="font-size:0.85rem; font-weight:700;">' + s.label + '</div>' +
            '<div style="font-size:0.7rem; color:var(--text-dim); margin-top:2px;">' + s.desc + '</div>' +
            '</div>' +
            '<label class="switch">' +
            '<input type="checkbox" name="perm_' + s.key + '"' + (existing[s.key] ? ' checked' : '') + '>' +
            '<span class="switch-slider"></span>' +
            '</label>' +
            '</div>';
    }).join('');
}

function showMemberModal(existingMember) {
    var isEdit = !!existingMember;
    var perms = existingMember ? (existingMember.permissions || {}) : {};

    document.getElementById('tm-member-modal')?.remove();

    var modal = document.createElement('div');
    modal.id = 'tm-member-modal';
    modal.className = 'tm-modal-overlay';
    modal.innerHTML = '<div class="tm-modal-box">' +
        '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px;">' +
        '<div><h2 style="margin:0; font-size:1.3rem; font-weight:900;">' + (isEdit ? 'Configure Operator' : 'Provision New Operator') + '</h2>' +
        '<p style="margin:4px 0 0; font-size:0.8rem; color:var(--text-dim);">' + (isEdit ? 'Editing: ' + (existingMember.name || '') : 'Grant system access to a new team member') + '</p></div>' +
        '<button id="tm-close-modal" style="background:none; border:none; color:var(--text-dim); font-size:1.5rem; cursor:pointer;">&times;</button>' +
        '</div>' +
        '<form id="tm-member-form">' +
        // Identity section
        '<div style="font-size:0.7rem; color:var(--text-dim); text-transform:uppercase; font-weight:800; letter-spacing:0.1em; margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid var(--border);">Identity</div>' +
        '<div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">' +
        '<div class="tm-input-group"><label>Firebase UID <span style="color:var(--danger);">*</span></label>' +
        '<input type="text" id="tm-uid" value="' + (existingMember ? existingMember.id : '') + '" placeholder="From Firebase Console" ' + (isEdit ? 'readonly style="opacity:0.5;"' : 'required') + '></div>' +
        '<div class="tm-input-group"><label>Role <span style="color:var(--danger);">*</span></label>' +
        '<select id="tm-role">' + ROLE_OPTIONS.map(function(r) {
            return '<option value="' + r.value + '"' + (existingMember && existingMember.role === r.value ? ' selected' : '') + '>' + r.label + ' — ' + r.desc + '</option>';
        }).join('') + '</select></div>' +
        '</div>' +
        '<div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px;">' +
        '<div class="tm-input-group"><label>Display Name</label><input type="text" id="tm-name" value="' + (existingMember ? (existingMember.name || '') : '') + '" placeholder="Full name"></div>' +
        '<div class="tm-input-group"><label>Email</label><input type="email" id="tm-email" value="' + (existingMember ? (existingMember.email || '') : '') + '" placeholder="team@arczen.store"></div>' +
        '</div>' +
        '<div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px;">' +
        '<div class="tm-input-group"><label>Title / Position</label><input type="text" id="tm-title" value="' + (existingMember ? (existingMember.title || '') : '') + '" placeholder="e.g. Lead Designer"></div>' +
        '<div class="tm-input-group"><label>Telegram ID</label><input type="text" id="tm-telegram" value="' + (existingMember ? (existingMember.telegramId || '') : '') + '" placeholder="Numeric Telegram ID"></div>' +
        '</div>' +
        // Beautiful flag
        '<div style="display:flex; align-items:center; justify-content:space-between; padding:12px 16px; background:rgba(0,201,188,0.05); border:1px solid rgba(0,201,188,0.2); border-radius:10px; margin-bottom:20px;">' +
        '<div><div style="font-weight:800; font-size:0.85rem;">System Access Enabled</div>' +
        '<div style="font-size:0.72rem; color:var(--text-dim); margin-top:2px;">The "beautiful" flag — must be ON for login to work</div></div>' +
        '<label class="switch"><input type="checkbox" id="tm-beautiful"' + (existingMember && existingMember.beautiful === false ? '' : ' checked') + '><span class="switch-slider"></span></label>' +
        '</div>' +
        // Permissions
        '<div style="font-size:0.7rem; color:var(--text-dim); text-transform:uppercase; font-weight:800; letter-spacing:0.1em; margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">' +
        '<span>Section Permissions</span>' +
        '<div style="display:flex; gap:8px;">' +
        '<button type="button" id="tm-grant-all" style="font-size:0.65rem; padding:4px 8px; background:rgba(0,201,188,0.1); border:1px solid rgba(0,201,188,0.2); color:var(--accent); border-radius:6px; cursor:pointer;">Grant All</button>' +
        '<button type="button" id="tm-revoke-all" style="font-size:0.65rem; padding:4px 8px; background:rgba(255,255,255,0.05); border:1px solid var(--border); color:var(--text-dim); border-radius:6px; cursor:pointer;">Revoke All</button>' +
        '</div></div>' +
        '<div id="tm-perms-container">' + buildPermissionsHTML(perms) + '</div>' +
        '<p style="font-size:0.72rem; color:var(--text-dim); margin-top:8px; margin-bottom:20px;">⚠️ Super Admin role ignores these toggles and gets full access.</p>' +
        // Actions
        '<div style="display:flex; gap:12px;">' +
        '<button type="button" id="tm-cancel-btn" class="pill" style="flex:1;">Cancel</button>' +
        '<button type="submit" style="flex:2; padding:12px; background:var(--accent); color:var(--bg-deep); border:none; border-radius:10px; font-weight:800; font-size:0.9rem; cursor:pointer;">' +
        (isEdit ? '💾 Save Changes' : '🚀 Provision Operator') + '</button>' +
        '</div>' +
        '</form></div>';

    document.body.appendChild(modal);

    function closeModal() { modal.remove(); }
    document.getElementById('tm-close-modal')?.addEventListener('click', closeModal);
    document.getElementById('tm-cancel-btn')?.addEventListener('click', closeModal);
    modal.addEventListener('click', function(e) { if (e.target === modal) closeModal(); });

    document.getElementById('tm-grant-all')?.addEventListener('click', function() {
        modal.querySelectorAll('#tm-perms-container input[type=checkbox]').forEach(function(cb) { cb.checked = true; });
    });
    document.getElementById('tm-revoke-all')?.addEventListener('click', function() {
        modal.querySelectorAll('#tm-perms-container input[type=checkbox]').forEach(function(cb) { cb.checked = false; });
    });

    document.getElementById('tm-member-form')?.addEventListener('submit', async function(e) {
        e.preventDefault();

        var uid = document.getElementById('tm-uid').value.trim();
        var name = document.getElementById('tm-name').value.trim();
        var email = document.getElementById('tm-email').value.trim();
        var title = document.getElementById('tm-title').value.trim();
        var role = document.getElementById('tm-role').value;
        var telegram = document.getElementById('tm-telegram').value.trim();
        var beautiful = document.getElementById('tm-beautiful').checked;

        if (!uid || uid.length < 10) {
            showToast('Please enter a valid Firebase UID (get it from Firebase Console → Authentication)', 'error');
            return;
        }

        var permissions = {};
        ALL_SECTIONS.forEach(function(s) {
            var cb = document.querySelector('#tm-perms-container input[name="perm_' + s.key + '"]');
            permissions[s.key] = cb ? cb.checked : false;
        });

        var memberData = {
            uid: uid,
            name: name || email,
            email: email,
            title: title,
            role: role,
            telegramId: telegram || null,
            beautiful: beautiful,
            permissions: permissions,
            status: 'active',
            updatedAt: serverTimestamp(),
        };

        if (!isEdit) {
            memberData.createdAt = serverTimestamp();
            memberData.provisioned_by = window.CuteState?.user?.uid || 'system';
        }

        try {
            await setDoc(doc(db, 'admins', uid), memberData, { merge: true });
            await setDoc(doc(db, 'users', uid), {
                email: email,
                role: role,
                status: 'active',
            }, { merge: true });

            showToast((isEdit ? (name || email) + ' updated' : (name || email) + ' provisioned!'), 'success');
            closeModal();
            await loadTeamGrid();
        } catch (err) {
            console.error('[TeamMgmt] Save error:', err);
            showToast('Failed: ' + err.message, 'error');
        }
    });
}

window._tmEdit = async function(uid) {
    try {
        var snap = await getDoc(doc(db, 'admins', uid));
        if (!snap.exists()) { showToast('Member not found', 'error'); return; }
        showMemberModal(Object.assign({ id: uid }, snap.data()));
    } catch (err) {
        showToast('Failed to load member data', 'error');
    }
};

window._tmRemove = async function(uid, name) {
    if (!confirm('Remove ' + name + ' from the team?\n\nThis revokes access immediately. Their Firebase Auth account is NOT deleted.')) return;
    try {
        await deleteDoc(doc(db, 'admins', uid));
        showToast(name + ' removed from team', 'success');
        await loadTeamGrid();
    } catch (err) {
        showToast('Failed: ' + err.message, 'error');
    }
};
