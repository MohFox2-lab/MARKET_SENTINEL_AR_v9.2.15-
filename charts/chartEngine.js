const chartEngine = {
    instance: null,
    render: function(ctxId, marketData, analysisResult) {
        const canvas = document.getElementById(ctxId);
        if(!canvas || !window.Chart) return;
        const ctx = canvas.getContext('2d');
        if(this.instance) this.instance.destroy();

        const rows = marketData.rows.slice(-100); // Last 100 days
        const labels = rows.map(r => r.date);
        const prices = rows.map(r => r.close);

        // Overlays
        const sma20Raw = indicators.SMA(marketData.rows, 20).slice(-100);
        const ema20Raw = indicators.EMA(marketData.rows, 20).slice(-100);
        const bb = indicators.BOLLINGER(marketData.rows, 20, 2);
        const bbUpper = (bb.upper || []).slice(-100);
        const bbLower = (bb.lower || []).slice(-100);

        this.instance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'السعر (close)',
                        data: prices,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.1
                    },
                    {
                        label: 'SMA 20',
                        data: sma20Raw,
                        borderColor: '#f59e0b',
                        borderWidth: 1.5,
                        borderDash: [5, 5],
                        pointRadius: 0
                    },
                    {
                        label: 'EMA 20',
                        data: ema20Raw,
                        borderColor: '#10b981',
                        borderWidth: 1.2,
                        borderDash: [2, 4],
                        pointRadius: 0
                    },
                    {
                        label: 'BB Upper',
                        data: bbUpper,
                        borderColor: '#6b7280',
                        borderWidth: 1,
                        borderDash: [3, 3],
                        pointRadius: 0
                    },
                    {
                        label: 'BB lower',
                        data: bbLower,
                        borderColor: '#6b7280',
                        borderWidth: 1,
                        borderDash: [3, 3],
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index',
                },
                plugins: {
                    legend: { position: 'top', align: 'end', labels: { font: { family: 'Cairo' } } }
                },
                scales: {
                    x: { ticks: { maxTicksLimit: 10 } }
                }
            }
        });
    }
};


window.chartEngine = chartEngine;
window.marketSentinel.chartEngine = chartEngine;
