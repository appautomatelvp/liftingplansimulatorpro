/**
 * ui-layout.js - Centralized Layout & Panel Exclusion Controller
 * 
 * Enforces panel exclusion rules:
 * - At most ONE modal open at any time
 * - At most ONE drawer open at any time
 * - At most ONE dropdown menu open at any time
 * - Esc key dismisses the topmost transient layer in order:
 *     1. Open modal (modal-library / modal-liftplan)
 *     2. Open dropdown menu
 *     3. Open compliance hud or gear editor
 *     4. Open drawer
 * - Automatic blur on modal open to suspend 3D key listeners
 */

window.UI = window.UI || {};

(function() {
    let activeModal = null;
    let activeDrawerTab = 'cargo';
    let is3DHotkeysSuspended = false;

    const LayoutController = {
        get isDrawerOpen() {
            const drawer = document.getElementById('right-side-drawer');
            return drawer ? drawer.classList.contains('drawer-open') : false;
        },

        get activeDrawerTab() {
            return activeDrawerTab;
        },

        get isModalOpen() {
            return !!activeModal;
        },

        // Dropdown menus management
        closeAllMenus() {
            document.querySelectorAll('.menu-dropdown').forEach(m => {
                m.classList.remove('open');
                const btn = m.querySelector('button[aria-haspopup="true"]');
                if (btn) btn.setAttribute('aria-expanded', 'false');
            });
        },

        toggleMenu(menuId) {
            const menuEl = document.getElementById(menuId);
            if (!menuEl) return;
            const wasOpen = menuEl.classList.contains('open');
            this.closeAllMenus();
            if (!wasOpen) {
                menuEl.classList.add('open');
                const btn = menuEl.querySelector('button[aria-haspopup="true"]');
                if (btn) btn.setAttribute('aria-expanded', 'true');
            }
        },

        // Modal management
        openModal(modalId) {
            this.closeAllMenus();
            if (activeModal && activeModal.id !== modalId) {
                this.closeModal(activeModal.id);
            }
            const modal = document.getElementById(modalId);
            if (!modal) return;

            // Blur any currently active input to avoid unwanted keystrokes
            if (document.activeElement && typeof document.activeElement.blur === 'function') {
                document.activeElement.blur();
            }

            modal.classList.add('open');
            modal.style.display = 'flex';
            activeModal = modal;
            // Dock-style plan wizard keeps the main 3D viewport interactive
            is3DHotkeysSuspended = modalId !== 'plan-wizard-modal';

            // Trigger modal content rendering if applicable
            if (modalId === 'liftplan-modal' && typeof renderLiftPlanModalContent === 'function') {
                renderLiftPlanModalContent();
            }
            if (modalId === 'plan-wizard-modal' && window.PlanWizard && typeof window.PlanWizard.render === 'function') {
                window.PlanWizard.render();
            }
        },

        closeModal(modalId) {
            const modal = modalId ? document.getElementById(modalId) : activeModal;
            if (!modal) return;
            modal.classList.remove('open');
            modal.style.display = 'none';
            if (activeModal === modal) {
                activeModal = null;
            }
            if (!document.querySelector('.modal-backdrop.open, #library-studio-modal.open, #liftplan-modal.open, #plan-wizard-modal.open')) {
                is3DHotkeysSuspended = false;
            }
        },

        // Drawer management
        openDrawer(tabName) {
            if (typeof openRightDrawer === 'function') {
                openRightDrawer(tabName);
                if (tabName) activeDrawerTab = tabName;
            }
        },

        closeDrawer() {
            if (typeof closeRightDrawer === 'function') {
                closeRightDrawer();
            }
        },

        toggleDrawer(tabName) {
            if (typeof toggleRightDrawer === 'function') {
                toggleRightDrawer(tabName);
                if (tabName) activeDrawerTab = tabName;
            }
        },

        // Close all transient layers (menus, popovers, floating panels)
        closeAllTransient() {
            this.closeAllMenus();
            const compHud = document.getElementById('compliance-hud-panel');
            if (compHud && !compHud.classList.contains('hidden')) {
                compHud.classList.add('hidden');
                document.getElementById('btn-open-compliance')?.classList.remove('active');
            }
            if (typeof closeGearEditor === 'function') {
                closeGearEditor();
            } else {
                const gearEd = document.getElementById('gear-editor');
                if (gearEd && gearEd.style.display !== 'none' && gearEd.style.display !== '') {
                    gearEd.style.display = 'none';
                    document.body.classList.remove('gear-editor-open');
                }
            }
            if (typeof closeRightDrawer === 'function') this.closeDrawer();
            document.body.classList.remove('show-hud', 'show-cam');
        },

        // Check if 3D hotkeys should be suspended
        shouldSuspend3DHotkeys() {
            if (activeModal && activeModal.id === 'plan-wizard-modal') return false;
            return is3DHotkeysSuspended || !!activeModal;
        },

        // Centralized Escape key dispatcher
        handleEscape() {
            // 1. If any modal is open, dismiss it
            if (activeModal || document.querySelector('#library-studio-modal.open, #liftplan-modal.open, #plan-wizard-modal.open')) {
                this.closeModal('library-studio-modal');
                this.closeModal('liftplan-modal');
                this.closeModal('plan-wizard-modal');
                return true;
            }

            // 2. If any menu is open, close it
            const openMenu = document.querySelector('.menu-dropdown.open');
            if (openMenu) {
                this.closeAllMenus();
                return true;
            }

            // 3. If compliance hud or gear editor is open, close it
            const compHud = document.getElementById('compliance-hud-panel');
            if (compHud && !compHud.classList.contains('hidden')) {
                compHud.classList.add('hidden');
                document.getElementById('btn-open-compliance')?.classList.remove('active');
                return true;
            }
            const gearEd = document.getElementById('gear-editor');
            if (gearEd && gearEd.style.display !== 'none' && gearEd.style.display !== '') {
                gearEd.style.display = 'none';
                document.body.classList.remove('gear-editor-open');
                return true;
            }

            // 4. If drawer is open, close it
            if (this.isDrawerOpen) {
                this.closeDrawer();
                return true;
            }

            return false;
        }
    };

    window.UI.layout = LayoutController;

    // Toast notification utility
    window.UI.toast = function(message, type = 'info', durationMs = 3000) {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container pointer-events-none fixed top-16 right-4 z-[var(--z-toast)] flex flex-col gap-2';
            container.setAttribute('data-testid', 'toast');
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        const colorClasses = {
            info: 'bg-sky-950/90 border-sky-500/60 text-sky-200',
            success: 'bg-emerald-950/90 border-emerald-500/60 text-emerald-200',
            warning: 'bg-amber-950/90 border-amber-500/60 text-amber-200',
            error: 'bg-rose-950/90 border-rose-500/60 text-rose-200'
        }[type] || 'bg-slate-900/90 border-slate-700 text-slate-200';

        toast.className = `pendant-btn pointer-events-auto flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border shadow-xl backdrop-blur-md transition-all duration-300 transform translate-x-0 ${colorClasses}`;
        toast.innerHTML = `<span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => toast.remove(), 300);
        }, durationMs);
    };

    // Dynamic --dock-h tracker using ResizeObserver
    function initDockHeightObserver() {
        const dock = document.getElementById('bottom-dock-bar');
        if (!dock || typeof ResizeObserver === 'undefined') return;
        const ro = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const h = Math.round(entry.contentRect.height || dock.offsetHeight || 64);
                if (h > 0) {
                    document.documentElement.style.setProperty('--dock-h', `${h}px`);
                }
            }
        });
        ro.observe(dock);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDockHeightObserver);
    } else {
        initDockHeightObserver();
    }
})();
