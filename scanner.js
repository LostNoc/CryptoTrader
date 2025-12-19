/**
 * Coin Scanner - Dual Mode (Quick / Detailed) - Binance API
 */

const Scanner = {
    isScanning: false,
    signals: [],
    mode: 'quick', // 'quick' or 'detailed'

    setMode(mode) {
        this.mode = mode;
        const desc = document.getElementById('scanModeDesc');
        if (mode === 'quick') {
            desc.textContent = 'Top 200 coin, 7 günlük teknik analiz (~30 sn)';
        } else {
            desc.textContent = 'Top 100 coin, 30 günlük teknik analiz (~60 sn)';
        }
    },

    async scan() {
        if (this.isScanning) return;
        this.isScanning = true;
        this.signals = [];

        const scanBtn = document.getElementById('scanBtn');
        const progress = document.getElementById('scanProgress');
        const progressFill = document.getElementById('progressFill');
        const status = document.getElementById('scanStatus');
        const list = document.getElementById('signalsList');

        scanBtn.disabled = true;
        progress.style.display = 'block';
        list.innerHTML = '';
        progressFill.style.width = '5%';

        try {
            if (this.mode === 'quick') {
                await this.quickScan(status, progressFill);
            } else {
                await this.detailedScan(status, progressFill);
            }

            // Separate LONG and SHORT, show mix of both
            const longSignals = this.signals.filter(s => s.type === 'long').sort((a, b) => b.score - a.score);
            const shortSignals = this.signals.filter(s => s.type === 'short').sort((a, b) => b.score - a.score);

            // Take top 3 from each, then combine and resort
            const topLongs = longSignals.slice(0, 3);
            const topShorts = shortSignals.slice(0, 3);
            const topSignals = [...topLongs, ...topShorts].sort((a, b) => b.score - a.score).slice(0, 5);

            // Render results
            this.renderSignals(topSignals);
            progressFill.style.width = '100%';

            const longCount = topSignals.filter(s => s.type === 'long').length;
            const shortCount = topSignals.filter(s => s.type === 'short').length;
            status.textContent = `${longCount} Long, ${shortCount} Short sinyal bulundu!`;

        } catch (e) {
            console.error('Scan error:', e);
            const errorMsg = e.message?.includes('429') || e.message?.includes('rate')
                ? 'API limit aşıldı! 1 dakika bekleyin.'
                : 'Bağlantı hatası, tekrar deneyin.';
            status.textContent = errorMsg;
            if (typeof App !== 'undefined' && App.showToast) {
                App.showToast('⚠️ ' + errorMsg, true);
            }
        }

        this.isScanning = false;
        scanBtn.disabled = false;
        setTimeout(() => { progress.style.display = 'none'; }, 2000);
    },

    async quickScan(status, progressFill) {
        status.textContent = 'Top 200 coin alınıyor (Binance)...';

        // Short cache for quick scan (2 minutes)
        const cacheKey = 'quick_scan_binance';
        let coins = null;
        const cached = localStorage.getItem('crypto_' + cacheKey);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp < 2 * 60 * 1000) {
                coins = parsed.data;
                status.textContent = 'Cache\'den yükleniyor...';
            }
        }

        if (!coins) {
            coins = await BinanceAPI.getTopCoins(200);
            localStorage.setItem('crypto_' + cacheKey, JSON.stringify({ data: coins, timestamp: Date.now() }));
        }

        progressFill.style.width = '20%';
        status.textContent = 'Teknik analiz yapılıyor (İndikatör tabanlı)...';

        // Quick scan now uses the same technical analysis as detailed scan
        // But with 7-day data for faster processing
        for (let i = 0; i < coins.length; i++) {
            const coin = coins[i];

            if (i % 20 === 0) {
                status.textContent = `${coin.name} analiz ediliyor... (${i + 1}/200)`;
                progressFill.style.width = (20 + (i / coins.length * 75)) + '%';
            }

            try {
                // Check cache for chart data (2 min cache)
                const chartCacheKey = `quick_chart_${coin.id}`;
                let chartData = null;
                const chartCached = localStorage.getItem('crypto_' + chartCacheKey);
                if (chartCached) {
                    const parsed = JSON.parse(chartCached);
                    if (Date.now() - parsed.timestamp < 2 * 60 * 1000) {
                        chartData = parsed.data;
                    }
                }

                if (!chartData) {
                    // Get 7-day data for quick analysis
                    chartData = await BinanceAPI.getCoinChartForScanner(coin.id, 7);
                    if (chartData) {
                        localStorage.setItem('crypto_' + chartCacheKey, JSON.stringify({ data: chartData, timestamp: Date.now() }));
                    }
                    // Small delay to avoid API rate limits
                    await this.delay(50);
                }

                if (chartData?.prices?.length > 50) {
                    const signal = this.analyzeWithTechnicalScore(coin, chartData);
                    if (signal && signal.score >= 35) {
                        this.signals.push(signal);
                    }
                }
            } catch (e) {
                console.log('Quick scan error for:', coin.id, e.message);
            }
        }
    },

    async detailedScan(status, progressFill) {
        status.textContent = 'Top 100 coin listesi alınıyor (Binance)...';

        // Get top 100 coins
        const coinList = await BinanceAPI.getTopCoins(100);
        progressFill.style.width = '10%';

        // Analyze each coin with 30-day data
        for (let i = 0; i < coinList.length; i++) {
            const coin = coinList[i];
            status.textContent = `${coin.name} analiz ediliyor... (${i + 1}/100)`;
            progressFill.style.width = (10 + (i / coinList.length * 85)) + '%';

            try {
                // Check cache for this coin (2 min cache)
                const cacheKey = `detailed_binance_${coin.id}`;
                let chartData = null;
                const cached = localStorage.getItem('crypto_' + cacheKey);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Date.now() - parsed.timestamp < 2 * 60 * 1000) {
                        chartData = parsed.data;
                    }
                }

                if (!chartData) {
                    chartData = await BinanceAPI.getCoinChartForScanner(coin.id);
                    if (chartData) {
                        localStorage.setItem('crypto_' + cacheKey, JSON.stringify({ data: chartData, timestamp: Date.now() }));
                    }
                    // Small delay to be nice to the API
                    await this.delay(100);
                }

                if (chartData?.prices?.length > 100) {
                    const signal = this.analyzeWithFullData(coin, chartData);
                    if (signal && signal.score >= 40) {
                        this.signals.push(signal);
                    }
                }
            } catch (e) {
                console.log('Error analyzing:', coin.id, e);
            }
        }
    },

    /**
     * Teknik Analiz Tabanlı Sinyal Analizi
     * Indicators.calculateOverallScore ile aynı mantığı kullanır
     */
    analyzeWithTechnicalScore(coin, chartData) {
        const prices = chartData.prices.map(p => p[1]);
        const currentPrice = coin.current_price;

        if (prices.length < 50) return null;

        // Tüm indikatörleri hesapla
        const rsi = Indicators.calculateRSI(prices);
        const macd = Indicators.calculateMACD(prices);
        const bb = Indicators.calculateBollingerBands(prices);
        const ma = Indicators.calculateMA200(prices);
        const stochRsi = Indicators.calculateStochRSI(prices);

        // Genel skoru hesapla (Indicators.calculateOverallScore ile aynı ağırlıklar)
        const allIndicators = {
            rsi: rsi,
            macd: macd,
            bb: bb,
            ma200: ma,
            stochRsi: stochRsi
        };

        const overall = Indicators.calculateOverallScore(allIndicators);

        // Long veya Short sinyali belirle
        let type = 'neutral';
        let score = 0;
        let reasons = [];

        const bullishPercent = overall.bullishPercent;
        const bearishPercent = overall.bearishPercent;

        // LONG sinyal koşulları (Teknik Analiz "AL" diyorsa)
        if (bullishPercent >= 55) {
            type = 'long';
            score = bullishPercent;

            // Nedenleri ekle
            if (rsi.signal === 'bullish') {
                if (rsi.value <= 30) reasons.push(`RSI aşırı satım (${rsi.value.toFixed(0)})`);
                else reasons.push(`RSI yükseliş (${rsi.value.toFixed(0)})`);
            }
            if (macd.trend === 'bullish') reasons.push('MACD pozitif');
            if (stochRsi.signal === 'bullish') reasons.push('Stoch RSI alım');
            if (bb.signal === 'bullish') reasons.push('BB alt banda yakın');
            if (ma.signal === 'bullish') reasons.push('MA üzerinde');
        }
        // SHORT sinyal koşulları (Teknik Analiz "SAT" diyorsa)
        else if (bearishPercent >= 55) {
            type = 'short';
            score = bearishPercent;

            // Nedenleri ekle
            if (rsi.signal === 'bearish') {
                if (rsi.value >= 70) reasons.push(`RSI aşırı alım (${rsi.value.toFixed(0)})`);
                else reasons.push(`RSI düşüş (${rsi.value.toFixed(0)})`);
            }
            if (macd.trend === 'bearish') reasons.push('MACD negatif');
            if (stochRsi.signal === 'bearish') reasons.push('Stoch RSI satım');
            if (bb.signal === 'bearish') reasons.push('BB üst banda yakın');
            if (ma.signal === 'bearish') reasons.push('MA altında');
        }

        // Nötr ise sinyal verme
        if (type === 'neutral') {
            return null;
        }

        // Güven eşiği kontrolü
        if (Math.abs(bullishPercent - bearishPercent) < 15) {
            return null; // Yeterli güven yok
        }

        return {
            coin,
            type,
            score: Math.min(score, 100),
            price: currentPrice,
            rsi: rsi.value,
            stochRsi: stochRsi.k,
            macd: macd.histogram > 0 ? 'Pozitif' : 'Negatif',
            reasons: reasons.slice(0, 3),
            overall: overall
        };
    },

    analyzeWithFullData(coin, chartData) {
        // Detailed scan için de aynı fonksiyonu kullan
        return this.analyzeWithTechnicalScore(coin, chartData);
    },

    calculateSignal(coin, prices, volumes = null) {
        const currentPrice = coin.current_price;

        const rsi = Indicators.calculateRSI(prices);
        const macd = Indicators.calculateMACD(prices);
        const bb = Indicators.calculateBollingerBands(prices);
        const ma = Indicators.calculateMA200(prices);
        const stochRsi = Indicators.calculateStochRSI(prices);

        let longScore = 0;
        let shortScore = 0;
        let longReasons = [];
        let shortReasons = [];

        // RSI signals
        if (rsi.value <= 30) {
            longScore += 25;
            longReasons.push('RSI aşırı satım (' + rsi.value.toFixed(0) + ')');
        } else if (rsi.value <= 40) {
            longScore += 12;
            longReasons.push('RSI düşük (' + rsi.value.toFixed(0) + ')');
        }

        if (rsi.value >= 70) {
            shortScore += 25;
            shortReasons.push('RSI aşırı alım (' + rsi.value.toFixed(0) + ')');
        } else if (rsi.value >= 60) {
            shortScore += 12;
            shortReasons.push('RSI yüksek (' + rsi.value.toFixed(0) + ')');
        }

        // Stoch RSI signals (Faz 2)
        if (stochRsi.oversold) {
            longScore += 20;
            longReasons.push('Stoch RSI aşırı satım');
        } else if (stochRsi.crossover === 'bullish') {
            longScore += 15;
            longReasons.push('Stoch RSI boğa kesişimi');
        }

        if (stochRsi.overbought) {
            shortScore += 20;
            shortReasons.push('Stoch RSI aşırı alım');
        } else if (stochRsi.crossover === 'bearish') {
            shortScore += 15;
            shortReasons.push('Stoch RSI ayı kesişimi');
        }

        // MACD signals
        if (macd.histogram > 0 && macd.trend === 'bullish') {
            longScore += 15;
            longReasons.push('MACD yükseliş');
        }
        if (macd.histogram < 0 && macd.trend === 'bearish') {
            shortScore += 15;
            shortReasons.push('MACD düşüş');
        }

        // Bollinger Bands
        const bbPosition = (currentPrice - bb.lower) / (bb.upper - bb.lower);
        if (bbPosition <= 0.1) {
            longScore += 20;
            longReasons.push('BB alt bandında');
        } else if (bbPosition <= 0.3) {
            longScore += 10;
            longReasons.push('BB alt bölgede');
        }

        if (bbPosition >= 0.9) {
            shortScore += 20;
            shortReasons.push('BB üst bandında');
        } else if (bbPosition >= 0.7) {
            shortScore += 10;
            shortReasons.push('BB üst bölgede');
        }

        // MA200 trend
        if (ma.signal === 'bullish') {
            longScore += 10;
            longReasons.push('MA üzerinde');
        } else {
            shortScore += 10;
            shortReasons.push('MA altında');
        }

        // 24h change
        const change24h = coin.price_change_percentage_24h || 0;
        if (change24h >= 8) {
            longScore += 10;
            longReasons.push('Güçlü momentum');
        } else if (change24h >= 3) {
            longScore += 5;
        }

        if (change24h <= -8) {
            shortScore += 10;
            shortReasons.push('Zayıf momentum');
        } else if (change24h <= -3) {
            shortScore += 5;
        }

        // Volume bonus (3 AI: "Hacimsiz sinyal değersiz")
        const coinVolume = coin.total_volume || 0;
        if (coinVolume > 100000000) {  // $100M+ volume
            longScore += 10;
            shortScore += 10;
            // Add to reasons only if it's significant
            if (longScore > shortScore) {
                longReasons.push('Çok yüksek hacim');
            } else {
                shortReasons.push('Çok yüksek hacim');
            }
        } else if (coinVolume > 50000000) {  // $50M+ volume
            longScore += 5;
            shortScore += 5;
        }

        const isLong = longScore > shortScore;
        const score = isLong ? longScore : shortScore;
        const reasons = isLong ? longReasons : shortReasons;

        if (Math.abs(longScore - shortScore) < 10) {
            return null;
        }

        return {
            coin,
            type: isLong ? 'long' : 'short',
            score: Math.min(score, 100),
            price: currentPrice,
            rsi: rsi.value,
            stochRsi: stochRsi.k,
            macd: macd.histogram > 0 ? 'Pozitif' : 'Negatif',
            reasons: reasons.slice(0, 3)
        };
    },

    renderSignals(signals) {
        const list = document.getElementById('signalsList');
        if (signals.length === 0) {
            list.innerHTML = '<div class="no-signals"><span>🔍</span>Güçlü sinyal bulunamadı.<br>Daha sonra tekrar deneyin.</div>';
            return;
        }

        list.innerHTML = signals.map(s => `
            <div class="signal-card ${s.type}" onclick="Scanner.selectCoin('${s.coin.id}')">
                <div class="signal-header">
                    <div class="signal-coin">
                        <img src="${s.coin.image}" alt="${s.coin.symbol}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2240%22 fill=%22%2358a6ff%22/></svg>'">
                        <div class="signal-coin-info">
                            <h4>${s.coin.name}</h4>
                            <span>${s.coin.symbol}</span>
                        </div>
                    </div>
                    <span class="signal-type ${s.type}">${s.type === 'long' ? '📈 LONG' : '📉 SHORT'}</span>
                </div>
                <div class="signal-details">
                    <div class="signal-detail">
                        <div class="signal-detail-label">Fiyat</div>
                        <div class="signal-detail-value">${this.formatPrice(s.price)}</div>
                    </div>
                    <div class="signal-detail">
                        <div class="signal-detail-label">RSI</div>
                        <div class="signal-detail-value">${s.rsi.toFixed(1)}</div>
                    </div>
                    <div class="signal-detail">
                        <div class="signal-detail-label">MACD</div>
                        <div class="signal-detail-value">${s.macd}</div>
                    </div>
                    <div class="signal-detail">
                        <div class="signal-detail-label">24s Değişim</div>
                        <div class="signal-detail-value">${(s.coin.price_change_percentage_24h || 0) >= 0 ? '+' : ''}${(s.coin.price_change_percentage_24h || 0).toFixed(1)}%</div>
                    </div>
                </div>
                <div class="signal-score">
                    <span class="score-label">Sinyal Gücü</span>
                    <span class="score-value">⭐ ${s.score}/100</span>
                </div>
                <div class="signal-reason">
                    <strong>Neden:</strong> ${s.reasons.join(' • ')}
                </div>
            </div>
        `).join('');
    },

    selectCoin(coinId) {
        document.querySelector('[data-tab="analysis"]').click();
        App.loadCoin(coinId);
    },

    formatPrice(price) {
        if (price < 0.01) return '$' + price.toFixed(6);
        if (price < 1) return '$' + price.toFixed(4);
        return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};
