// Task Completion Modal
import { getTask, updateTask } from './tasks.js';
import { showToast } from './utils.js';

export async function showTaskCompletionModal(taskId) {
    const task = await getTask(taskId);

    const modal = document.createElement('div');
    modal.className = 'modal';

    modal.innerHTML = `
        <div class="modal-content completion-modal" style="max-width: 550px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none;">
            <div class="modal-header" style="background: rgba(255,255,255,0.1); border-bottom: 1px solid rgba(255,255,255,0.2); backdrop-filter: blur(10px);">
                <h2 style="display: flex; align-items: center; gap: 0.75rem; margin: 0; font-size: 1.5rem;">
                    <span style="font-size: 2rem;">✅</span>
                    Mark as Complete
                </h2>
                <button class="modal-close" style="color: white; opacity: 0.8;">&times;</button>
            </div>
            <div style="padding: 0 1.5rem 1rem; margin-bottom: 0.5rem;">
                <div style="background: rgba(255,255,255,0.15); padding: 1rem; border-radius: 8px; backdrop-filter: blur(10px);">
                    <strong style="font-size: 1.1rem; display: block; margin-bottom: 0.25rem;">${task.title}</strong>
                    <small style="opacity: 0.9;">Assigned to: ${task.assignedToName}</small>
                </div>
            </div>
            <form id="completionForm" style="padding: 0 1.5rem 1.5rem;">
                <div class="input-group" style="margin-bottom: 1.25rem;">
                    <label style="color: white; font-weight: 600; margin-bottom: 0.5rem; display: block;">
                        Completion Notes / Comments <span style="color: #ffd166;">*</span>
                    </label>
                    <textarea id="completionNotes" rows="4" placeholder="Describe what you completed, any challenges faced, final deliverables..." required style="background: rgba(255,255,255,0.95); border: 2px solid transparent; border-radius: 8px; padding: 0.75rem; font-size: 0.95rem; width: 100%; transition: all 0.3s;"></textarea>
                    <small style="color: rgba(255,255,255,0.8); font-size: 0.85rem; display: block; margin-top: 0.5rem;">
                        💡 Provide details about the completed work
                    </small>
                </div>
                
                <div class="input-group" style="margin-bottom: 1.25rem;">
                    <label style="color: white; font-weight: 600; margin-bottom: 0.5rem; display: block;">
                        File Delivery Link <span style="color: #ffd166;">*</span>
                    </label>
                    <input type="text" id="fileLink" placeholder="drive.google.com/... or just paste any link" required style="background: rgba(255,255,255,0.95); border: 2px solid transparent; border-radius: 8px; padding: 0.75rem; font-size: 0.95rem; width: 100%; transition: all 0.3s;">
                    <small style="color: rgba(255,255,255,0.8); font-size: 0.85rem; display: block; margin-top: 0.5rem;">
                        🔗 Link to final deliverables (accepts any text format)
                    </small>
                </div>
                
                <div class="input-group" style="margin-bottom: 1.5rem;">
                    <label style="color: white; font-weight: 600; margin-bottom: 0.5rem; display: block;">
                        Delivery Method
                    </label>
                    <select id="deliveryMethod" style="background: rgba(255,255,255,0.95); border: 2px solid transparent; border-radius: 8px; padding: 0.75rem; font-size: 0.95rem; width: 100%; cursor: pointer;">
                        <option value="telegram">📱 Telegram</option>
                        <option value="drive">☁️ Google Drive</option>
                        <option value="whatsapp">💬 WhatsApp</option>
                        <option value="dropbox">📦 Dropbox</option>
                        <option value="other">🔗 Other</option>
                    </select>
                </div>
                
                <div class="modal-actions" style="display: flex; gap: 0.75rem;">
                    <button type="button" class="btn-secondary modal-close" style="flex: 1; background: rgba(255,255,255,0.2); color: white; border: 2px solid rgba(255,255,255,0.3); font-weight: 600; padding: 0.875rem;">
                        Cancel
                    </button>
                    <button type="submit" class="btn-primary" style="flex: 2; background: linear-gradient(135deg, #06d6a0 0%, #118ab2 100%); color: white; border: none; font-weight: 600; padding: 0.875rem; box-shadow: 0 4px 15px rgba(6, 214, 160, 0.4);">
                        ✓ Mark as Done
                    </button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);

    // Close handlers
    modal.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => modal.remove());
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });

    // Form submit
    document.getElementById('completionForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const completionData = {
            status: 'done',
            completionNotes: document.getElementById('completionNotes').value.trim(),
            fileLink: document.getElementById('fileLink').value.trim(),
            deliveryMethod: document.getElementById('deliveryMethod').value,
            completedAt: new Date().toISOString(),
            completedBy: window.CuteState.user.uid
        };

        try {
            await updateTask(taskId, completionData);
            showToast("Task marked as complete!", "success");
            modal.remove();

            // Reload tasks to show updated status
            const { renderProjectsPage } = await import('./ui.js');
            await renderProjectsPage();
        } catch (error) {
            console.error("Failed to complete task:", error);
            showToast("Failed to mark task as complete", "error");
        }
    });
}

// Make it globally accessible
window.showTaskCompletionModal = showTaskCompletionModal;
