/**
 * Crypto Trader Pro - Main Application (Binance API)
 */

const App = {
    chart: null,
    lineSeries: null,
    selectedCoin: { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', image: '' },
    priceData: [],
    ohlcData: [],
    currentTimeframe: 30,
    currentSymbol: null,
    searchTimeout: null,
    lastPrice: 0,
    cameFromScanner: false,
    lastScannerTab: 'signals',

    async init() {
        this.setupEventListeners();
        this.initChart();
        // Pre-load symbol cache for faster search
        BinanceAPI.getSymbols();
        await this.loadCoin('bitcoin');
    },

    setupEventListeners() {
        // Search
        document.getElementById('coinSearch').addEventListener('input', (e) => this.handleSearch(e.target.value));
        document.getElementById('coinSearch').addEventListener('focus', () => {
            const results = document.getElementById('searchResults');
            if (results.children.length > 0) results.classList.add('active');
        });
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-box')) document.getElementById('searchResults').classList.remove('active');
        });

        // Timeframe
        document.querySelectorAll('.timeframe-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTimeframe = parseInt(btn.dataset.tf);
                this.loadCoin(this.selectedCoin.id);
            });
        });

        // Position toggle
        document.getElementById('longBtn').addEventListener('click', () => {
            document.getElementById('longBtn').classList.add('active');
            document.getElementById('shortBtn').classList.remove('active');
            RiskCalculator.setPosition(true);
        });
        document.getElementById('shortBtn').addEventListener('click', () => {
            document.getElementById('shortBtn').classList.add('active');
            document.getElementById('longBtn').classList.remove('active');
            RiskCalculator.setPosition(false);
        });

        // Calculate button
        document.getElementById('calculateBtn').addEventListener('click', () => this.calculateRisk());

        // Refresh
        document.getElementById('refreshBtn').addEventListener('click', () => this.loadCoin(this.selectedCoin.id));

        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const tab = btn.dataset.tab;
                document.getElementById('analysisTab').style.display = tab === 'analysis' ? 'block' : 'none';
                document.getElementById('signalsTab').style.display = tab === 'signals' ? 'block' : 'none';
                document.getElementById('highleverageTab').style.display = tab === 'highleverage' ? 'block' : 'none';
            });
        });

        // Scan button
        document.getElementById('scanBtn').addEventListener('click', () => Scanner.scan());

        // High Leverage Scan button
        document.getElementById('hlScanBtn').addEventListener('click', () => HighLeverageScanner.scan());

        // Clear cache button
        document.getElementById('clearCacheBtn').addEventListener('click', () => {
            Cache.clear();
            BinanceAPI.symbolCache = null;
            this.showToast('✅ Önbellek temizlendi! Güncel veriler kullanılacak.');
        });

        // Leverage preset buttons
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('leverage').value = btn.dataset.lev;
            });
        });

        // Scan mode toggle
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                Scanner.setMode(btn.dataset.mode);
            });
        });
    },

    showToast(message, isError = false) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = 'toast show' + (isError ? ' error' : '');
        setTimeout(() => { toast.className = 'toast'; }, 3000);
    },

    initChart() {
        const container = document.getElementById('priceChart');
        this.chart = LightweightCharts.createChart(container, {
            layout: { background: { color: '#161b22' }, textColor: '#8b949e' },
            grid: { vertLines: { color: '#21262d' }, horzLines: { color: '#21262d' } },
            crosshair: { mode: 1 },
            rightPriceScale: { borderColor: '#21262d' },
            timeScale: { borderColor: '#21262d', timeVisible: true },
            handleScroll: { mouseWheel: true, pressedMouseMove: true },
            handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true }
        });
        this.lineSeries = this.chart.addAreaSeries({
            topColor: 'rgba(88, 166, 255, 0.4)',
            bottomColor: 'rgba(88, 166, 255, 0.0)',
            lineColor: '#58a6ff',
            lineWidth: 2
        });
        new ResizeObserver(() => this.chart.applyOptions({ width: container.clientWidth })).observe(container);
    },

    async handleSearch(query) {
        clearTimeout(this.searchTimeout);
        if (query.length < 2) {
            document.getElementById('searchResults').classList.remove('active');
            return;
        }
        this.searchTimeout = setTimeout(async () => {
            try {
                const coins = await BinanceAPI.searchCoins(query);
                this.renderSearchResults(coins);
            } catch (e) { console.error('Search error:', e); }
        }, 200);
    },

    renderSearchResults(coins) {
        const container = document.getElementById('searchResults');
        if (coins.length === 0) { container.classList.remove('active'); return; }
        container.innerHTML = coins.map(coin => `
            <div class="search-result-item" data-id="${coin.id}" data-symbol="${coin.symbol}" data-name="${coin.name}" data-image="${coin.thumb}">
                <img src="${coin.thumb}" alt="${coin.symbol}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2240%22 fill=%22%2358a6ff%22/><text x=%2250%22 y=%2260%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2230%22>${coin.symbol.substring(0, 2).toUpperCase()}</text></svg>'">
                <span class="name">${coin.name}</span>
                <span class="symbol">${coin.symbol.toUpperCase()}</span>
            </div>
        `).join('');
        container.classList.add('active');
        container.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                this.selectedCoin = { id: item.dataset.id, symbol: item.dataset.symbol, name: item.dataset.name, image: item.dataset.image };
                document.getElementById('coinSearch').value = '';
                container.classList.remove('active');
                this.loadCoin(this.selectedCoin.id);
            });
        });
    },

    async loadCoin(coinId) {
        // IMPORTANT: Disconnect old WebSocket FIRST to prevent price mixing
        BinanceAPI.disconnectWebSocket();
        this.showLiveIndicator(false);

        document.getElementById('chartLoading').classList.remove('hidden');
        try {
            const cacheKey = `coin_${coinId}_${this.currentTimeframe}`;
            let data = Cache.get(cacheKey);

            if (!data) {
                const symbol = BinanceAPI.getSymbol(coinId);
                const [ticker, chartData, ohlcData] = await Promise.all([
                    BinanceAPI.getTicker(symbol),
                    BinanceAPI.getChartData(symbol, this.currentTimeframe),
                    BinanceAPI.getOHLC(symbol, this.currentTimeframe)
                ]);

                data = {
                    ticker,
                    chart: chartData,
                    ohlc: ohlcData,
                    symbol
                };
                Cache.set(cacheKey, data);
            }

            const { ticker, chart: chartData, ohlc, symbol } = data;
            this.ohlcData = ohlc;

            // Update coin info
            const baseAsset = symbol.replace('USDT', '');
            this.selectedCoin = {
                id: coinId,
                symbol: baseAsset.toLowerCase(),
                name: baseAsset,
                image: BinanceAPI.getIconUrl(symbol)
            };

            const iconEl = document.getElementById('coinIcon');
            iconEl.src = this.selectedCoin.image;
            iconEl.onerror = () => {
                iconEl.src = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="%2358a6ff"/><text x="50" y="60" text-anchor="middle" fill="white" font-size="30">${baseAsset.substring(0, 2)}</text></svg>`;
            };

            document.getElementById('coinName').textContent = baseAsset;
            document.getElementById('coinSymbol').textContent = baseAsset;

            const price = parseFloat(ticker.lastPrice);
            const change = parseFloat(ticker.priceChangePercent);
            const high24h = parseFloat(ticker.highPrice);
            const low24h = parseFloat(ticker.lowPrice);

            document.getElementById('coinPrice').textContent = this.formatPrice(price);
            const changeEl = document.getElementById('coinChange');
            changeEl.textContent = (change >= 0 ? '+' : '') + change.toFixed(2) + '%';
            changeEl.className = 'coin-change ' + (change >= 0 ? 'positive' : 'negative');

            // Update 24h high/low
            document.getElementById('high24h').textContent = this.formatPrice(high24h);
            document.getElementById('low24h').textContent = this.formatPrice(low24h);

            // Update chart
            this.priceData = chartData.map(p => p.value);
            this.lineSeries.setData(chartData);
            this.chart.timeScale().fitContent();

            // Set price for calculator
            RiskCalculator.setPrice(price);

            // Update indicators
            this.updateIndicators();

            // Connect WebSocket for real-time updates
            this.currentSymbol = symbol;
            this.lastPrice = price;
            this.connectRealTime(symbol);
        } catch (e) {
            console.error('Load error:', e);
            this.showToast('⚠️ Veri yüklenemedi: ' + e.message, true);
        }
        document.getElementById('chartLoading').classList.add('hidden');
    },

    updateIndicators() {
        // Extract volume data from OHLC
        const volumes = this.ohlcData ? this.ohlcData.map(c => c[5] || c.volume || 0) : [];

        // Store all indicator results for overall score calculation
        const allIndicators = {};

        // Helper function to add trend emoji
        const addTrendEmoji = (signal, text) => {
            if (signal === 'bullish') return '👍 ' + text;
            if (signal === 'bearish') return '👎 ' + text;
            return '➖ ' + text;
        };

        // ============ VOLUME ANALYSIS (Kritik) ============
        const volumeAnalysis = Indicators.calculateVolumeAnalysis(volumes, this.priceData);
        allIndicators.volume = volumeAnalysis;

        document.getElementById('volumeCurrent').textContent = volumeAnalysis.formatted?.current || '--';
        document.getElementById('volumeAverage').textContent = volumeAnalysis.formatted?.average || '--';
        document.getElementById('volumeRatio').textContent = volumeAnalysis.formatted?.ratio || '--';
        document.getElementById('volumeSignal').textContent = addTrendEmoji(volumeAnalysis.signal, volumeAnalysis.description);
        document.getElementById('volumeSignal').className = 'indicator-signal ' + volumeAnalysis.signal;

        const spikeEl = document.getElementById('volumeSpike');
        if (volumeAnalysis.spike) {
            spikeEl.classList.remove('hidden');
            spikeEl.classList.add('pulse');
        } else {
            spikeEl.classList.add('hidden');
        }

        // ============ OBV ============
        const obv = Indicators.calculateOBV(this.priceData, volumes);
        document.getElementById('obvValue').textContent = Indicators.formatVolume(Math.abs(obv.value));
        document.getElementById('obvChange').textContent = obv.change || '--';
        document.getElementById('obvSignal').textContent = addTrendEmoji(obv.signal, obv.description);
        document.getElementById('obvSignal').className = 'indicator-signal ' + obv.signal;

        // ============ CANDLESTICK PATTERNS (Kritik) ============
        const patterns = Indicators.detectCandlestickPatterns(this.ohlcData);
        allIndicators.patterns = patterns;

        const patternsList = document.getElementById('patternsList');
        if (patterns.patterns.length > 0) {
            patternsList.innerHTML = patterns.patterns.slice(0, 3).map(p =>
                `<div class="pattern-item ${p.type}" data-pattern="${p.name}" style="cursor: pointer;">
                    <span class="pattern-emoji">${p.emoji}</span>
                    <span class="pattern-name">${p.name}</span>
                    <span class="pattern-trend">${p.type === 'bullish' ? '👍' : p.type === 'bearish' ? '👎' : '➖'}</span>
                </div>`
            ).join('');

            // Pattern item'larına tıklama olayı ekle
            patternsList.querySelectorAll('.pattern-item').forEach(item => {
                item.addEventListener('click', () => {
                    const patternName = item.dataset.pattern;
                    if (typeof PatternVisuals !== 'undefined') {
                        PatternVisuals.show(patternName);
                    }
                });
            });
        } else {
            patternsList.innerHTML = '<span class="no-pattern">Formasyon yok</span>';
        }
        document.getElementById('patternsSignal').textContent = addTrendEmoji(patterns.signal, patterns.description);
        document.getElementById('patternsSignal').className = 'indicator-signal ' + patterns.signal;

        // ============ SUPPORT/RESISTANCE (Kritik) ============
        const sr = Indicators.calculateSupportResistance(this.priceData, this.ohlcData);

        const resistanceEl = document.getElementById('resistanceLevels');
        if (sr.resistances.length > 0) {
            resistanceEl.innerHTML = sr.resistances.slice(0, 2).map(r =>
                `<span class="sr-value resistance">${Indicators.formatPrice(r.price)}</span>`
            ).join('');
        } else {
            resistanceEl.innerHTML = '<span>$--</span>';
        }

        const supportEl = document.getElementById('supportLevels');
        if (sr.supports.length > 0) {
            supportEl.innerHTML = sr.supports.slice(0, 2).map(s =>
                `<span class="sr-value support">${Indicators.formatPrice(s.price)}</span>`
            ).join('');
        } else {
            supportEl.innerHTML = '<span>$--</span>';
        }

        document.getElementById('srSignal').textContent = addTrendEmoji(sr.signal, sr.description);
        document.getElementById('srSignal').className = 'indicator-signal ' + sr.signal;

        // ============ FIBONACCI ============
        const fib = Indicators.calculateFibonacci(this.priceData);

        document.getElementById('fibTrend').textContent = fib.trendLabel || '--';
        document.getElementById('fib618').textContent = fib.levels?.level_618 ? Indicators.formatPrice(fib.levels.level_618.price) : '$--';
        document.getElementById('fib500').textContent = fib.levels?.level_500 ? Indicators.formatPrice(fib.levels.level_500.price) : '$--';
        document.getElementById('fib382').textContent = fib.levels?.level_382 ? Indicators.formatPrice(fib.levels.level_382.price) : '$--';
        document.getElementById('fib236').textContent = fib.levels?.level_236 ? Indicators.formatPrice(fib.levels.level_236.price) : '$--';
        document.getElementById('fibSignal').textContent = addTrendEmoji(fib.signal, fib.description);
        document.getElementById('fibSignal').className = 'indicator-signal ' + fib.signal;

        // ============ STOCHASTIC RSI ============
        const stochRsi = Indicators.calculateStochRSI(this.priceData);
        allIndicators.stochRsi = stochRsi;

        document.getElementById('stochK').textContent = stochRsi.k.toFixed(1);
        document.getElementById('stochD').textContent = stochRsi.d.toFixed(1);
        document.getElementById('stochKPointer').style.left = stochRsi.k + '%';
        document.getElementById('stochDPointer').style.left = stochRsi.d + '%';
        document.getElementById('stochRsiSignal').textContent = addTrendEmoji(stochRsi.signal, stochRsi.description);
        document.getElementById('stochRsiSignal').className = 'indicator-signal ' + stochRsi.signal;

        // ============ ADX ============
        const adx = Indicators.calculateADX(this.ohlcData);
        allIndicators.adx = adx;

        document.getElementById('adxValue').textContent = adx.adx.toFixed(1);
        document.getElementById('plusDI').textContent = adx.plusDI.toFixed(1);
        document.getElementById('minusDI').textContent = adx.minusDI.toFixed(1);
        document.getElementById('adxStrengthFill').style.width = Math.min(adx.adx * 2, 100) + '%';
        document.getElementById('adxSignal').textContent = addTrendEmoji(adx.signal, adx.description);
        document.getElementById('adxSignal').className = 'indicator-signal ' + adx.signal;

        // ============ RSI ============
        const rsi = Indicators.calculateRSI(this.priceData);
        allIndicators.rsi = rsi;

        document.getElementById('rsiValue').textContent = rsi.value;
        document.getElementById('rsiIndicator').style.left = rsi.value + '%';
        document.getElementById('rsiSignal').textContent = addTrendEmoji(rsi.signal, rsi.description);
        document.getElementById('rsiSignal').className = 'indicator-signal ' + rsi.signal;

        // ============ MA200 ============
        const ma = Indicators.calculateMA200(this.priceData);
        allIndicators.ma200 = ma;

        document.getElementById('ma200Value').textContent = Indicators.formatPrice(ma.value);
        document.getElementById('ma200Signal').textContent = addTrendEmoji(ma.signal, ma.description);
        document.getElementById('ma200Signal').className = 'indicator-signal ' + ma.signal;

        // ============ MACD ============
        const macd = Indicators.calculateMACD(this.priceData);
        allIndicators.macd = macd;

        document.getElementById('macdValue').textContent = macd.macd;
        document.getElementById('macdSignalLine').textContent = macd.signal;
        document.getElementById('macdHistogram').textContent = macd.histogram;
        document.getElementById('macdSignal').textContent = addTrendEmoji(macd.trend, macd.description);
        document.getElementById('macdSignal').className = 'indicator-signal ' + macd.trend;

        // ============ BOLLINGER BANDS ============
        const bb = Indicators.calculateBollingerBands(this.priceData);
        allIndicators.bb = bb;

        document.getElementById('bbUpper').textContent = Indicators.formatPrice(bb.upper);
        document.getElementById('bbMiddle').textContent = Indicators.formatPrice(bb.middle);
        document.getElementById('bbLower').textContent = Indicators.formatPrice(bb.lower);
        document.getElementById('bbSignal').textContent = addTrendEmoji(bb.signal, bb.description);
        document.getElementById('bbSignal').className = 'indicator-signal ' + bb.signal;

        // ============ PIVOT POINTS ============
        const pivot = Indicators.calculatePivotFromOHLC(this.ohlcData);
        document.getElementById('pivotPP').textContent = Indicators.formatPrice(pivot.pp);
        document.getElementById('pivotR1').textContent = Indicators.formatPrice(pivot.r1);
        document.getElementById('pivotR2').textContent = Indicators.formatPrice(pivot.r2);
        document.getElementById('pivotR3').textContent = Indicators.formatPrice(pivot.r3);
        document.getElementById('pivotS1').textContent = Indicators.formatPrice(pivot.s1);
        document.getElementById('pivotS2').textContent = Indicators.formatPrice(pivot.s2);
        document.getElementById('pivotS3').textContent = Indicators.formatPrice(pivot.s3);

        // ============ OVERALL SCORE (Genel Skor) ============
        const overall = Indicators.calculateOverallScore(allIndicators);

        document.getElementById('bullishPercent').textContent = overall.bullishPercent;
        document.getElementById('bearishPercent').textContent = overall.bearishPercent;
        document.getElementById('bullishBar').style.width = overall.bullishPercent + '%';
        document.getElementById('bearishBar').style.width = overall.bearishPercent + '%';
        document.getElementById('confidenceValue').textContent = overall.confidence;

        const recEl = document.getElementById('overallRecommendation');
        recEl.textContent = overall.recommendation;
        recEl.className = 'recommendation ' + overall.signal;

        // Update overall card color
        const scoreCard = document.getElementById('overallScoreCard');
        scoreCard.className = 'overall-score-card ' + overall.signal;
    },

    calculateRisk() {
        const portfolio = parseFloat(document.getElementById('portfolioSize').value) || 0;
        const leverage = parseInt(document.getElementById('leverage').value) || 50;
        const slPercent = parseFloat(document.getElementById('stopLossPercent').value) || 2;

        const result = RiskCalculator.calculate(portfolio, leverage, slPercent);
        if (result.error) { alert(result.error); return; }

        // Store last calculation for margin calculator
        this.lastCalcResult = result;

        document.getElementById('entryAmount').textContent = RiskCalculator.formatUSD(result.entryAmount);
        document.getElementById('positionSize').textContent = RiskCalculator.formatUSD(result.positionSize);
        document.getElementById('slPrice').textContent = RiskCalculator.formatUSD(result.slPrice);
        document.getElementById('slPercent').textContent = (result.isLong ? '-' : '+') + result.slPercent + '%';
        document.getElementById('tp1').textContent = RiskCalculator.formatUSD(result.tp1);
        document.getElementById('tp2').textContent = RiskCalculator.formatUSD(result.tp2);
        document.getElementById('tp3').textContent = RiskCalculator.formatUSD(result.tp3);
        document.getElementById('liqPrice').textContent = RiskCalculator.formatUSD(result.liqPrice);
        document.getElementById('maxLoss').textContent = RiskCalculator.formatUSD(result.maxLoss);
        document.getElementById('calcResults').classList.add('active');
    },

    formatPrice(price) {
        if (price < 0.01) return '$' + price.toFixed(6);
        if (price < 1) return '$' + price.toFixed(4);
        return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    // Back to scanner from analysis
    backToScanner() {
        this.cameFromScanner = false;
        document.getElementById('backToScannerBtn').classList.add('hidden');
        document.querySelector(`[data-tab="${this.lastScannerTab}"]`).click();
    },

    // Show back button when coming from scanner
    showBackToScannerBtn(fromTab) {
        this.cameFromScanner = true;
        this.lastScannerTab = fromTab;
        document.getElementById('backToScannerBtn').classList.remove('hidden');
    },

    // Hide back button
    hideBackToScannerBtn() {
        this.cameFromScanner = false;
        document.getElementById('backToScannerBtn').classList.add('hidden');
    },

    // ============ REAL-TIME PRICE UPDATES ============

    connectRealTime(symbol) {
        // Connect to Binance WebSocket for live price updates
        BinanceAPI.connectWebSocket(symbol, {
            onPrice: (data) => this.updateLivePrice(data)
        });

        // Show live indicator
        this.showLiveIndicator(true);
    },

    updateLivePrice(data) {
        // IMPORTANT: Verify this data is for the current coin
        // This prevents old WebSocket messages from updating wrong coin
        if (data.symbol !== this.currentSymbol) {
            return; // Ignore data from different symbol
        }

        // Update price display
        const priceEl = document.getElementById('coinPrice');
        const changeEl = document.getElementById('coinChange');

        const newPrice = data.price;
        const priceChange = data.priceChangePercent;

        // Animate price change
        const isUp = newPrice > this.lastPrice;
        const isDown = newPrice < this.lastPrice;

        priceEl.textContent = this.formatPrice(newPrice);

        // Flash effect for price change
        if (isUp || isDown) {
            priceEl.classList.remove('flash-up', 'flash-down');
            void priceEl.offsetWidth; // Trigger reflow
            priceEl.classList.add(isUp ? 'flash-up' : 'flash-down');
        }

        // Update change percentage
        changeEl.textContent = (priceChange >= 0 ? '+' : '') + priceChange.toFixed(2) + '%';
        changeEl.className = 'coin-change ' + (priceChange >= 0 ? 'positive' : 'negative');

        // Update last price
        this.lastPrice = newPrice;

        // Update calculator price
        RiskCalculator.setPrice(newPrice);

        // Add new point to chart (every second update)
        if (this.lineSeries && Math.random() > 0.5) {
            const now = Math.floor(Date.now() / 1000);
            this.lineSeries.update({ time: now, value: newPrice });
        }
    },

    showLiveIndicator(show) {
        let indicator = document.getElementById('liveIndicator');
        if (!indicator && show) {
            indicator = document.createElement('div');
            indicator.id = 'liveIndicator';
            indicator.className = 'live-indicator';
            indicator.innerHTML = '<span class="live-dot"></span> CANLI';
            document.querySelector('.coin-info')?.appendChild(indicator);
        }
        if (indicator) {
            indicator.style.display = show ? 'flex' : 'none';
        }
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
