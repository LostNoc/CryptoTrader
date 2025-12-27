/**
 * High Leverage Scanner - Advanced Pattern Detection
 * Designed for 75x-150x leverage trades targeting ~1% movements for 100% profit
 * 
 * Filters:
 * 1. Breakout Detection (S/R + Volume Confirmation)
 * 2. Triangle/Wedge Pattern Recognition
 * 3. Retest Confirmation
 * 4. Momentum Alignment (MACD, RSI, Stoch RSI, ADX)
 */

const HighLeverageScanner = {
    isScanning: false,
    signals: [],
    scanProgress: 0,

    /**
     * Main scan function - scans top 500 coins
     */
    async scan() {
        if (this.isScanning) return;
        this.isScanning = true;
        this.signals = [];

        const scanBtn = document.getElementById('hlScanBtn');
        const progress = document.getElementById('hlScanProgress');
        const progressFill = document.getElementById('hlProgressFill');
        const status = document.getElementById('hlScanStatus');
        const longList = document.getElementById('hlLongSignals');
        const shortList = document.getElementById('hlShortSignals');

        scanBtn.disabled = true;
        progress.style.display = 'block';
        longList.innerHTML = '<div class="hl-loading">Taranıyor...</div>';
        shortList.innerHTML = '<div class="hl-loading">Taranıyor...</div>';
        progressFill.style.width = '0%';

        try {
            status.textContent = 'Coin listesi alınıyor...';

            // Get top 500 coins from Binance
            const coins = await BinanceAPI.getTopCoins(500);
            const totalCoins = coins.length;
            progressFill.style.width = '10%';

            status.textContent = 'Pattern analizi başlıyor...';

            // Analyze each coin - update UI for EVERY coin (smooth progress)
            for (let i = 0; i < coins.length; i++) {
                const coin = coins[i];

                // Update progress for EVERY coin (smooth progress like detailed scan)
                status.textContent = `${coin.name} analiz ediliyor... (${i + 1}/${totalCoins})`;
                progressFill.style.width = (10 + (i / totalCoins * 85)) + '%';

                try {
                    // Get OHLC data for pattern analysis
                    const ohlcData = await this.getAnalysisData(coin.id);

                    if (ohlcData && ohlcData.length >= 20) {
                        // Ensure icon URL is set
                        if (!coin.image || coin.image === '') {
                            coin.image = BinanceAPI.getIconUrl(coin.binanceSymbol || coin.id.toUpperCase() + 'USDT');
                        }
                        const signal = await this.analyzePatterns(coin, ohlcData);
                        if (signal) {
                            this.signals.push(signal);
                        }
                    }

                    // Rate limiting - small delay every 10 coins
                    if (i % 10 === 0) {
                        await this.delay(30);
                    }
                } catch (e) {
                    console.log('Analysis error for:', coin.id, e.message);
                }
            }

            // Sort and get top 3 Long + 3 Short
            const longSignals = this.signals
                .filter(s => s.type === 'long')
                .sort((a, b) => b.score - a.score)
                .slice(0, 3);

            const shortSignals = this.signals
                .filter(s => s.type === 'short')
                .sort((a, b) => b.score - a.score)
                .slice(0, 3);

            progressFill.style.width = '100%';

            // Render results
            this.renderSignals(longList, longSignals, 'long');
            this.renderSignals(shortList, shortSignals, 'short');

            status.textContent = `Tamamlandı! ${longSignals.length} Long, ${shortSignals.length} Short sinyal bulundu.`;

        } catch (e) {
            console.error('High Leverage Scan error:', e);
            status.textContent = 'Hata: ' + (e.message || 'Bağlantı problemi');
            longList.innerHTML = '<div class="hl-error">Tarama başarısız</div>';
            shortList.innerHTML = '<div class="hl-error">Tarama başarısız</div>';
        }

        this.isScanning = false;
        scanBtn.disabled = false;
        setTimeout(() => { progress.style.display = 'none'; }, 3000);
    },

    /**
     * Get OHLC data for analysis (uses 1h for pattern detection)
     */
    async getAnalysisData(coinId) {
        const cacheKey = `hl_ohlc_${coinId}`;
        const cached = localStorage.getItem('crypto_' + cacheKey);

        if (cached) {
            const parsed = JSON.parse(cached);
            // 5-minute cache for high leverage scan
            if (Date.now() - parsed.timestamp < 5 * 60 * 1000) {
                return parsed.data;
            }
        }

        try {
            const data = await BinanceAPI.getCoinChartForScanner(coinId, 7);
            if (data) {
                let ohlcData = null;

                // Use OHLC if available
                if (data.ohlc && data.ohlc.length > 0) {
                    ohlcData = data.ohlc;
                }
                // Fallback: create pseudo-OHLC from prices
                else if (data.prices && data.prices.length > 0) {
                    ohlcData = data.prices.map((p, i) => {
                        const price = p[1] || p;
                        // Create pseudo-OHLC: [time, open, high, low, close, volume]
                        return [p[0] || Date.now(), price, price * 1.001, price * 0.999, price, data.volumes ? (data.volumes[i] ? data.volumes[i][1] : 1000000) : 1000000];
                    });
                }

                if (ohlcData && ohlcData.length > 0) {
                    localStorage.setItem('crypto_' + cacheKey, JSON.stringify({
                        data: ohlcData,
                        timestamp: Date.now()
                    }));
                    return ohlcData;
                }
            }
        } catch (e) {
            console.log('OHLC fetch error:', coinId, e.message);
        }

        return null;
    },

    /**
     * Main pattern analysis function - Less strict version
     */
    async analyzePatterns(coin, ohlcData) {
        const prices = ohlcData.map(c => c[4] || c.close);
        const volumes = ohlcData.map(c => c[5] || c.volume);
        const currentPrice = coin.current_price;

        if (prices.length < 20) return null;

        let longScore = 0;
        let shortScore = 0;
        let patterns = [];
        let reasons = [];

        // 1. BREAKOUT DETECTION (40 points max)
        const breakout = this.detectBreakout(ohlcData, prices, currentPrice);
        if (breakout.detected) {
            if (breakout.type === 'long') {
                longScore += breakout.score;
            } else {
                shortScore += breakout.score;
            }
            patterns.push(breakout.pattern);
            reasons.push(...breakout.reasons);
        }

        // 2. TRIANGLE/WEDGE PATTERNS (30 points max)
        const pattern = this.detectTriangleWedge(ohlcData, prices);
        if (pattern.detected) {
            if (pattern.type === 'long') {
                longScore += pattern.score;
            } else {
                shortScore += pattern.score;
            }
            patterns.push(pattern.name);
            reasons.push(pattern.reason);
        }

        // 3. VOLUME ANALYSIS
        const volumeAnalysis = Indicators.calculateVolumeAnalysis(volumes, prices);
        if (volumeAnalysis.spike) {
            if (volumeAnalysis.signal === 'bullish') {
                longScore += 15;
                reasons.push('Hacim patlaması 🔥');
            } else if (volumeAnalysis.signal === 'bearish') {
                shortScore += 15;
                reasons.push('Hacim patlaması 🔥');
            }
        }

        // 4. MOMENTUM INDICATORS - More generous scoring
        const rsi = Indicators.calculateRSI(prices);
        const macd = Indicators.calculateMACD(prices);
        const stochRsi = Indicators.calculateStochRSI(prices);

        // RSI signals
        if (rsi.value <= 35) {
            longScore += 20;
            reasons.push(`RSI aşırı satım (${rsi.value.toFixed(0)})`);
        } else if (rsi.value <= 45) {
            longScore += 10;
        } else if (rsi.value >= 65) {
            shortScore += 20;
            reasons.push(`RSI aşırı alım (${rsi.value.toFixed(0)})`);
        } else if (rsi.value >= 55) {
            shortScore += 10;
        }

        // MACD signals
        if (macd.histogram > 0 && macd.trend === 'bullish') {
            longScore += 15;
            reasons.push('MACD pozitif');
        } else if (macd.histogram < 0 && macd.trend === 'bearish') {
            shortScore += 15;
            reasons.push('MACD negatif');
        }

        // Stoch RSI
        if (stochRsi.oversold || stochRsi.k < 25) {
            longScore += 15;
            reasons.push('StochRSI düşük');
        } else if (stochRsi.overbought || stochRsi.k > 75) {
            shortScore += 15;
            reasons.push('StochRSI yüksek');
        }

        // Crossover bonus
        if (stochRsi.crossover === 'bullish') {
            longScore += 10;
            reasons.push('StochRSI kesişim ↑');
        } else if (stochRsi.crossover === 'bearish') {
            shortScore += 10;
            reasons.push('StochRSI kesişim ↓');
        }

        // 5. TREND via MA
        const ma = Indicators.calculateMA200(prices);
        if (ma.signal === 'bullish') {
            longScore += 10;
            reasons.push('MA üzerinde');
        } else if (ma.signal === 'bearish') {
            shortScore += 10;
            reasons.push('MA altında');
        }

        // 6. Bollinger Bands at extremes
        const bb = Indicators.calculateBollingerBands(prices);
        const bbPosition = (currentPrice - bb.lower) / (bb.upper - bb.lower);
        if (bbPosition <= 0.15) {
            longScore += 15;
            reasons.push('BB alt bandı');
        } else if (bbPosition >= 0.85) {
            shortScore += 15;
            reasons.push('BB üst bandı');
        }

        // 7. 24h momentum bonus
        const change24h = coin.price_change_percentage_24h || 0;
        if (change24h >= 5) {
            longScore += 10;
            reasons.push(`Momentum +${change24h.toFixed(1)}%`);
        } else if (change24h <= -5) {
            shortScore += 10;
            reasons.push(`Momentum ${change24h.toFixed(1)}%`);
        }

        // 8. Volume requirement - penalize very low volume
        const volume24h = coin.total_volume || 0;
        if (volume24h < 5000000) {
            longScore -= 10;
            shortScore -= 10;
        }

        // Determine type based on higher score
        const isLong = longScore > shortScore;
        const finalScore = isLong ? longScore : shortScore;
        const scoreDiff = Math.abs(longScore - shortScore);

        // If scores are too close, use momentum to determine direction
        let signalType = isLong ? 'long' : 'short';
        let adjustedScore = finalScore;

        if (scoreDiff < 5) {
            // Very unclear signal, reduce confidence
            adjustedScore = Math.max(finalScore - 10, 5);
            // Use 24h change as tiebreaker
            const change24h = coin.price_change_percentage_24h || 0;
            signalType = change24h >= 0 ? 'long' : 'short';
        }

        // Set pattern name if none detected
        if (patterns.length === 0) {
            patterns.push(signalType === 'long' ? 'Bullish Momentum' : 'Bearish Momentum');
        }

        return {
            coin,
            type: signalType,
            score: Math.min(Math.max(adjustedScore, 0), 100),
            price: currentPrice,
            patterns: patterns.join(', '),
            reasons: [...new Set(reasons)].slice(0, 4),
            riskNote: signalType === 'long'
                ? `Stop: $${(currentPrice * 0.99).toFixed(currentPrice < 1 ? 6 : 2)} (-1%)`
                : `Stop: $${(currentPrice * 1.01).toFixed(currentPrice < 1 ? 6 : 2)} (+1%)`
        };
    },

    /**
     * Detect S/R Breakout with Retest
     */
    detectBreakout(ohlcData, prices, currentPrice) {
        const result = { detected: false, type: null, score: 0, pattern: '', reasons: [] };

        // Get support/resistance levels
        const sr = Indicators.calculateSupportResistance(prices, ohlcData);

        if (!sr.nearestResistance && !sr.nearestSupport) return result;

        const recentCandles = ohlcData.slice(-5);
        const volumes = ohlcData.map(c => c[5] || c.volume);
        const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;

        // Check for resistance breakout (LONG)
        if (sr.nearestResistance) {
            const resistance = sr.nearestResistance.price;
            const tolerance = resistance * 0.003; // 0.3% tolerance

            // Price broke above resistance
            if (currentPrice > resistance + tolerance) {
                // Check if volume confirmed
                const breakoutCandle = recentCandles.find(c => {
                    const close = c[4] || c.close;
                    const vol = c[5] || c.volume;
                    return close > resistance && vol > avgVolume * 1.5;
                });

                if (breakoutCandle) {
                    result.detected = true;
                    result.type = 'long';
                    result.score = 20;
                    result.pattern = 'Direnç Kırılımı';
                    result.reasons.push('Direnç kırıldı');

                    // Volume bonus
                    const breakoutVol = breakoutCandle[5] || breakoutCandle.volume;
                    if (breakoutVol > avgVolume * 2) {
                        result.score += 10;
                        result.reasons.push('Güçlü hacim');
                    }

                    // Retest bonus - price came back close to resistance then bounced
                    const retestCandle = recentCandles.find(c => {
                        const low = c[3] || c.low;
                        return Math.abs(low - resistance) < tolerance;
                    });

                    if (retestCandle) {
                        result.score += 10;
                        result.pattern = 'Kırılım + Retest ✓';
                        result.reasons.push('Retest onaylandı');
                    }
                }
            }
        }

        // Check for support breakout (SHORT)
        if (!result.detected && sr.nearestSupport) {
            const support = sr.nearestSupport.price;
            const tolerance = support * 0.003;

            // Price broke below support
            if (currentPrice < support - tolerance) {
                const breakoutCandle = recentCandles.find(c => {
                    const close = c[4] || c.close;
                    const vol = c[5] || c.volume;
                    return close < support && vol > avgVolume * 1.5;
                });

                if (breakoutCandle) {
                    result.detected = true;
                    result.type = 'short';
                    result.score = 20;
                    result.pattern = 'Destek Kırılımı';
                    result.reasons.push('Destek kırıldı');

                    const breakoutVol = breakoutCandle[5] || breakoutCandle.volume;
                    if (breakoutVol > avgVolume * 2) {
                        result.score += 10;
                        result.reasons.push('Güçlü hacim');
                    }

                    // Retest bonus
                    const retestCandle = recentCandles.find(c => {
                        const high = c[2] || c.high;
                        return Math.abs(high - support) < tolerance;
                    });

                    if (retestCandle) {
                        result.score += 10;
                        result.pattern = 'Kırılım + Retest ✓';
                        result.reasons.push('Retest onaylandı');
                    }
                }
            }
        }

        return result;
    },

    /**
     * Detect Triangle and Wedge patterns
     */
    detectTriangleWedge(ohlcData, prices) {
        const result = { detected: false, type: null, score: 0, name: '', reason: '' };

        if (ohlcData.length < 20) return result;

        // Get highs and lows from recent candles
        const recent = ohlcData.slice(-20);
        const highs = recent.map(c => c[2] || c.high);
        const lows = recent.map(c => c[3] || c.low);

        // Calculate trend of highs and lows
        const highTrend = this.calculateTrend(highs);
        const lowTrend = this.calculateTrend(lows);

        const currentPrice = prices[prices.length - 1];
        const avgPrice = prices.slice(-10).reduce((a, b) => a + b, 0) / 10;

        // Ascending Triangle: Flat highs + Rising lows (Bullish)
        if (Math.abs(highTrend) < 0.001 && lowTrend > 0.001) {
            const resistance = Math.max(...highs.slice(-5));
            if (currentPrice > resistance * 0.995) {
                result.detected = true;
                result.type = 'long';
                result.score = 30;
                result.name = 'Yükselen Üçgen';
                result.reason = 'Ascending Triangle kırılımı';
            }
        }

        // Descending Triangle: Falling highs + Flat lows (Bearish)
        if (!result.detected && highTrend < -0.001 && Math.abs(lowTrend) < 0.001) {
            const support = Math.min(...lows.slice(-5));
            if (currentPrice < support * 1.005) {
                result.detected = true;
                result.type = 'short';
                result.score = 30;
                result.name = 'Alçalan Üçgen';
                result.reason = 'Descending Triangle kırılımı';
            }
        }

        // Falling Wedge: Both falling, but lows falling faster (Bullish reversal)
        if (!result.detected && highTrend < 0 && lowTrend < 0 && lowTrend < highTrend) {
            // Check for breakout above upper trendline
            if (currentPrice > avgPrice * 1.02) {
                result.detected = true;
                result.type = 'long';
                result.score = 25;
                result.name = 'Düşen Kama';
                result.reason = 'Falling Wedge yukarı kırılım';
            }
        }

        // Rising Wedge: Both rising, but highs rising slower (Bearish reversal)
        if (!result.detected && highTrend > 0 && lowTrend > 0 && highTrend < lowTrend) {
            // Check for breakout below lower trendline
            if (currentPrice < avgPrice * 0.98) {
                result.detected = true;
                result.type = 'short';
                result.score = 25;
                result.name = 'Yükselen Kama';
                result.reason = 'Rising Wedge aşağı kırılım';
            }
        }

        // Symmetrical Triangle: Converging (can break either way)
        if (!result.detected && highTrend < 0 && lowTrend > 0) {
            const range = Math.max(...highs.slice(-3)) - Math.min(...lows.slice(-3));
            const avgRange = (Math.max(...highs) - Math.min(...lows)) / 2;

            if (range < avgRange * 0.5) {
                // Narrowing - breakout imminent, check direction
                if (currentPrice > Math.max(...highs.slice(-3))) {
                    result.detected = true;
                    result.type = 'long';
                    result.score = 20;
                    result.name = 'Simetrik Üçgen';
                    result.reason = 'Symmetrical Triangle yukarı';
                } else if (currentPrice < Math.min(...lows.slice(-3))) {
                    result.detected = true;
                    result.type = 'short';
                    result.score = 20;
                    result.name = 'Simetrik Üçgen';
                    result.reason = 'Symmetrical Triangle aşağı';
                }
            }
        }

        return result;
    },

    /**
     * Calculate linear trend slope
     */
    calculateTrend(values) {
        const n = values.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

        for (let i = 0; i < n; i++) {
            sumX += i;
            sumY += values[i];
            sumXY += i * values[i];
            sumX2 += i * i;
        }

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const avgValue = sumY / n;

        // Normalize slope relative to average value
        return slope / avgValue;
    },

    /**
     * Analyze momentum indicators
     */
    analyzeMomentum(prices, ohlcData) {
        const result = {
            bullishScore: 0,
            bearishScore: 0,
            bullishReasons: [],
            bearishReasons: []
        };

        // MACD
        const macd = Indicators.calculateMACD(prices);
        if (macd.histogram > 0 && macd.trend === 'bullish') {
            result.bullishScore += 10;
            result.bullishReasons.push('MACD pozitif');
        } else if (macd.histogram < 0 && macd.trend === 'bearish') {
            result.bearishScore += 10;
            result.bearishReasons.push('MACD negatif');
        }

        // ADX
        const adx = Indicators.calculateADX(ohlcData);
        if (adx.hasTrend) {
            if (adx.signal === 'bullish') {
                result.bullishScore += 5;
                if (adx.strongTrend) result.bullishReasons.push('Güçlü trend');
            } else if (adx.signal === 'bearish') {
                result.bearishScore += 5;
                if (adx.strongTrend) result.bearishReasons.push('Güçlü trend');
            }
        }

        // OBV
        const volumes = ohlcData.map(c => c[5] || c.volume);
        const obv = Indicators.calculateOBV(prices, volumes);
        if (obv.signal === 'bullish') {
            result.bullishScore += 5;
            if (obv.trend === 'divergence_bullish') {
                result.bullishReasons.push('OBV divergence');
            }
        } else if (obv.signal === 'bearish') {
            result.bearishScore += 5;
            if (obv.trend === 'divergence_bearish') {
                result.bearishReasons.push('OBV divergence');
            }
        }

        return result;
    },

    /**
     * Analyze entry quality (RSI, Stoch RSI)
     */
    analyzeEntryQuality(prices, type) {
        const result = { score: 0, reasons: [] };

        const rsi = Indicators.calculateRSI(prices);
        const stochRsi = Indicators.calculateStochRSI(prices);

        if (type === 'long') {
            // Optimal RSI for long: 30-50 (not overbought)
            if (rsi.value >= 30 && rsi.value <= 50) {
                result.score += 5;
                result.reasons.push(`RSI optimal (${rsi.value.toFixed(0)})`);
            }
            // Stoch RSI bullish crossover
            if (stochRsi.crossover === 'bullish') {
                result.score += 5;
                result.reasons.push('StochRSI kesişim');
            }
        } else if (type === 'short') {
            // Optimal RSI for short: 50-70 (not oversold)
            if (rsi.value >= 50 && rsi.value <= 70) {
                result.score += 5;
                result.reasons.push(`RSI optimal (${rsi.value.toFixed(0)})`);
            }
            // Stoch RSI bearish crossover
            if (stochRsi.crossover === 'bearish') {
                result.score += 5;
                result.reasons.push('StochRSI kesişim');
            }
        }

        return result;
    },

    /**
     * Render signals to the page
     */
    renderSignals(container, signals, type) {
        if (signals.length === 0) {
            container.innerHTML = `
                <div class="hl-no-signal">
                    <span class="hl-no-icon">${type === 'long' ? '📈' : '📉'}</span>
                    <span>Uygun ${type === 'long' ? 'LONG' : 'SHORT'} sinyal bulunamadı</span>
                </div>
            `;
            return;
        }

        container.innerHTML = signals.map((s, index) => {
            const symbol = (s.coin.symbol || s.coin.name || 'XX').toUpperCase();
            const initials = symbol.substring(0, 2);
            const fallbackSvg = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2245%22 fill=%22%2358a6ff%22/><text x=%2250%22 y=%2265%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2232%22 font-weight=%22bold%22>${initials}</text></svg>`;
            const imgSrc = s.coin.image || fallbackSvg;

            return `
            <div class="hl-signal-card ${s.type}" onclick="HighLeverageScanner.selectCoin('${s.coin.id}')">
                <div class="hl-signal-rank">#${index + 1}</div>
                <div class="hl-signal-header">
                    <div class="hl-coin-info">
                        <img src="${imgSrc}" alt="${s.coin.symbol}" onerror="this.src='${fallbackSvg}'">
                        <div>
                            <h4>${s.coin.name}</h4>
                            <span class="hl-symbol">${symbol}</span>
                        </div>
                    </div>
                    <div class="hl-signal-score">
                        <span class="hl-score-value">${s.score}</span>
                        <span class="hl-score-label">PUAN</span>
                    </div>
                </div>
                <div class="hl-pattern-badge">
                    <span>${s.type === 'long' ? '📈' : '📉'}</span>
                    ${s.patterns}
                </div>
                <div class="hl-signal-price">
                    <span>Fiyat:</span>
                    <strong>${this.formatPrice(s.price)}</strong>
                </div>
                <div class="hl-signal-reasons">
                    ${s.reasons.map(r => `<span class="hl-reason">${r}</span>`).join('')}
                </div>
                <div class="hl-risk-note">
                    ⚠️ ${s.riskNote}
                </div>
            </div>
        `}).join('');
    },

    /**
     * Navigate to coin analysis
     */
    selectCoin(coinId) {
        document.querySelector('[data-tab="analysis"]').click();
        if (typeof App !== 'undefined' && App.loadCoin) {
            App.showBackToScannerBtn('highlev');
            App.loadCoin(coinId);
        }
    },

    /**
     * Format price with appropriate decimals
     */
    formatPrice(price) {
        if (price < 0.0001) return '$' + price.toFixed(8);
        if (price < 0.01) return '$' + price.toFixed(6);
        if (price < 1) return '$' + price.toFixed(4);
        return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};
