// Mobile Navigation Handler
import { logout } from './auth.js';
import { showToast } from './utils.js';

export function initMobileMenu() {
    // Check if duplicate
    if (document.getElementById('mobileMenuToggle')) return;

    // Create mobile menu toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'mobile-menu-toggle';
    toggleBtn.innerHTML = '<i class="material-icons-round">menu</i>';
    toggleBtn.id = 'mobileMenuToggle';

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'mobile-overlay';
    overlay.id = 'mobileOverlay';

    document.body.appendChild(toggleBtn);
    document.body.appendChild(overlay);

    // Toggle menu
    toggleBtn.addEventListener('click', () => {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.classList.toggle('mobile-open');
            overlay.classList.toggle('active');

            // Change icon
            const icon = toggleBtn.querySelector('i');
            icon.textContent = sidebar.classList.contains('mobile-open') ? 'close' : 'menu';
        }
    });

    // Close menu when overlay clicked
    overlay.addEventListener('click', () => {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.classList.remove('mobile-open');
            overlay.classList.remove('active');
            const icon = toggleBtn.querySelector('i');
            icon.textContent = 'menu';
        }
    });

    // Close menu when nav link clicked
    document.addEventListener('click', (e) => {
        if (e.target.closest('.sidebar nav a')) {
            const sidebar = document.querySelector('.sidebar');
            if (sidebar && sidebar.classList.contains('mobile-open')) {
                sidebar.classList.remove('mobile-open');
                overlay.classList.remove('active');
                const icon = toggleBtn.querySelector('i');
                icon.textContent = 'menu';
            }
        }
    });
}

// Initialize on auth state change
window.addEventListener('hashchange', () => {
    // Reinit mobile menu if dashboard is rendered
    if (document.querySelector('.dashboard-layout') && !document.getElementById('mobileMenuToggle')) {
        initMobileMenu();
    }
});
