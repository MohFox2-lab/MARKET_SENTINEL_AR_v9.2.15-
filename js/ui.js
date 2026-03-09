const ui = {
    switchTab: function(tabId) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active', 'border-b-2', 'border-primary', 'text-primary');
            btn.classList.add('text-gray-500');
            if (btn.dataset.target === tabId) {
                btn.classList.add('active', 'border-b-2', 'border-primary', 'text-primary');
                btn.classList.remove('text-gray-500');
            }
        });
        document.querySelectorAll('.view-section').forEach(sec => {
            sec.classList.remove('active');
            sec.classList.add('hidden');
        });
        const target = document.getElementById(tabId);
        if(target){
            target.classList.remove('hidden');
            target.classList.add('active');
        }
    },
    showToast: function(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        const colors = {
            success: 'bg-success text-white',
            error: 'bg-danger text-white',
            info: 'bg-primary text-white'
        };
        toast.className = `${colors[type]} px-4 py-2 rounded shadow-lg transform transition-all duration-300 translate-y-0 opacity-100`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('opacity-0', 'translate-y-2');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },
    showLoading: function(show) {
        const el = document.getElementById('loading-overlay');
        if(show) el.classList.remove('hidden');
        else el.classList.add('hidden');
        if(show) el.style.display = 'flex';
        else el.style.display = 'none';
    }
};


window.ui = ui;
window.marketSentinel.ui = ui;
