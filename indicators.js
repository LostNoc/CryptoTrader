/**
 * Technical Indicators - Advanced Analysis Suite
 * Based on Gemini, ChatGPT, DeepSeek AI recommendations
 * Includes: RSI, MACD, MA, Bollinger, Volume, Candlestick Patterns, Support/Resistance, Fibonacci, Stoch RSI, ADX
 */

const Indicators = {
    // ============ TEMEL HESAPLAMALAR ============

    SMA(data, period) {
        const result = [];
        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) { result.push(null); continue; }
            let sum = 0;
            for (let j = 0; j < period; j++) sum += data[i - j];
            result.push(sum / period);
        }
        return result;
    },

    EMA(data, period) {
        const result = [];
        const k = 2 / (period + 1);
        let sum = 0;
        for (let i = 0; i < period; i++) sum += data[i];
        result.push(sum / period);
        for (let i = period; i < data.length; i++) {
            result.push((data[i] - result[result.length - 1]) * k + result[result.length - 1]);
        }
        return [...new Array(period - 1).fill(null), ...result];
    },

    // ============ MEVCUT İNDİKATÖRLER ============

    calculateMA200(prices) {
        const period = Math.min(prices.length, 200);
        const sma = this.SMA(prices, period);
        const maValue = sma[sma.length - 1];
        const currentPrice = prices[prices.length - 1];
        return {
            value: maValue,
            signal: currentPrice > maValue ? 'bullish' : 'bearish',
            description: currentPrice > maValue ? 'Fiyat MA üzerinde' : 'Fiyat MA altında',
            period
        };
    },

    calculateRSI(prices, period = 14) {
        if (prices.length < period + 1) return { value: 50, signal: 'neutral', description: 'Yetersiz veri' };
        const changes = [];
        for (let i = 1; i < prices.length; i++) changes.push(prices[i] - prices[i - 1]);
        const gains = changes.map(c => c > 0 ? c : 0);
        const losses = changes.map(c => c < 0 ? Math.abs(c) : 0);
        let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
        let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
        for (let i = period; i < changes.length; i++) {
            avgGain = (avgGain * (period - 1) + gains[i]) / period;
            avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
        }
        const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
        let signal = 'neutral', desc = 'Nötr bölgede';
        if (rsi >= 70) { signal = 'bearish'; desc = 'Aşırı alım'; }
        else if (rsi <= 30) { signal = 'bullish'; desc = 'Aşırı satım'; }
        else if (rsi > 50) { signal = 'bullish'; desc = 'Yükseliş eğilimi'; }
        else { signal = 'bearish'; desc = 'Düşüş eğilimi'; }
        return { value: Math.round(rsi * 100) / 100, signal, description: desc };
    },

    calculateMACD(prices, fast = 12, slow = 26, sig = 9) {
        if (prices.length < slow + sig) return { macd: 0, signal: 0, histogram: 0, trend: 'neutral', description: 'Yetersiz veri' };
        const fastEMA = this.EMA(prices, fast);
        const slowEMA = this.EMA(prices, slow);
        const macdLine = fastEMA.map((f, i) => f && slowEMA[i] ? f - slowEMA[i] : null).filter(v => v !== null);
        const signalLine = this.EMA(macdLine, sig);
        const latestMACD = macdLine[macdLine.length - 1];
        const latestSignal = signalLine[signalLine.length - 1];
        const histogram = latestMACD - latestSignal;
        let trend = histogram > 0 ? 'bullish' : 'bearish';
        let desc = histogram > 0 ? 'Pozitif momentum' : 'Negatif momentum';
        return { macd: Math.round(latestMACD * 10000) / 10000, signal: Math.round(latestSignal * 10000) / 10000, histogram: Math.round(histogram * 10000) / 10000, trend, description: desc };
    },

    calculateBollingerBands(prices, period = 20, stdDev = 2) {
        if (prices.length < period) return { upper: 0, middle: 0, lower: 0, signal: 'neutral', description: 'Yetersiz veri' };
        const sma = this.SMA(prices, period);
        const middle = sma[sma.length - 1];
        const recentPrices = prices.slice(-period);
        const mean = recentPrices.reduce((a, b) => a + b, 0) / period;
        const sd = Math.sqrt(recentPrices.map(p => Math.pow(p - mean, 2)).reduce((a, b) => a + b, 0) / period);
        const upper = middle + (stdDev * sd);
        const lower = middle - (stdDev * sd);
        const currentPrice = prices[prices.length - 1];
        let signal = 'neutral', desc = 'Orta bant civarında';
        if (currentPrice >= upper) { signal = 'bearish'; desc = 'Üst banda değdi'; }
        else if (currentPrice <= lower) { signal = 'bullish'; desc = 'Alt banda değdi'; }
        else if (currentPrice > middle) { signal = 'bullish'; desc = 'Orta bant üzerinde'; }
        else { signal = 'bearish'; desc = 'Orta bant altında'; }
        return { upper: Math.round(upper * 100) / 100, middle: Math.round(middle * 100) / 100, lower: Math.round(lower * 100) / 100, signal, description: desc };
    },

    calculatePivotPoints(high, low, close) {
        const pp = (high + low + close) / 3;
        return {
            pp: Math.round(pp * 100) / 100,
            r1: Math.round(((2 * pp) - low) * 100) / 100,
            r2: Math.round((pp + (high - low)) * 100) / 100,
            r3: Math.round((high + 2 * (pp - low)) * 100) / 100,
            s1: Math.round(((2 * pp) - high) * 100) / 100,
            s2: Math.round((pp - (high - low)) * 100) / 100,
            s3: Math.round((low - 2 * (high - pp)) * 100) / 100
        };
    },

    calculatePivotFromOHLC(ohlcData) {
        if (!ohlcData || ohlcData.length < 2) return { pp: 0, r1: 0, r2: 0, r3: 0, s1: 0, s2: 0, s3: 0 };
        const prev = ohlcData[ohlcData.length - 2];
        return this.calculatePivotPoints(prev[2], prev[3], prev[4]);
    },

    // ============ FAZ 1: HACİM ANALİZİ ============

    /**
     * OBV (On Balance Volume) - Hacim tabanlı trend göstergesi
     * 3 AI'ın ortak önerisi: "Hacimsiz sinyal değersiz"
     */
    calculateOBV(prices, volumes) {
        if (!volumes || volumes.length < 2) return { value: 0, signal: 'neutral', description: 'Yetersiz veri', trend: 'neutral' };

        let obv = 0;
        const obvValues = [0];

        for (let i = 1; i < prices.length; i++) {
            if (prices[i] > prices[i - 1]) {
                obv += volumes[i] || 0;
            } else if (prices[i] < prices[i - 1]) {
                obv -= volumes[i] || 0;
            }
            obvValues.push(obv);
        }

        // OBV trend analizi (son 10 değer)
        const recentOBV = obvValues.slice(-10);
        const obvChange = recentOBV[recentOBV.length - 1] - recentOBV[0];
        const priceChange = prices[prices.length - 1] - prices[prices.length - 10];

        let signal = 'neutral';
        let description = 'Nötr hacim akışı';
        let trend = 'neutral';

        // Divergence kontrolü
        if (obvChange > 0 && priceChange < 0) {
            signal = 'bullish';
            description = '🔥 Boğa Divergence - Gizli alım';
            trend = 'divergence_bullish';
        } else if (obvChange < 0 && priceChange > 0) {
            signal = 'bearish';
            description = '⚠️ Ayı Divergence - Gizli satış';
            trend = 'divergence_bearish';
        } else if (obvChange > 0) {
            signal = 'bullish';
            description = 'Pozitif hacim akışı';
            trend = 'accumulation';
        } else if (obvChange < 0) {
            signal = 'bearish';
            description = 'Negatif hacim akışı';
            trend = 'distribution';
        }

        return {
            value: Math.round(obv),
            signal,
            description,
            trend,
            change: obvChange > 0 ? '+' + this.formatVolume(obvChange) : this.formatVolume(obvChange)
        };
    },

    /**
     * Hacim Analizi - Spike ve trend tespiti
     */
    calculateVolumeAnalysis(volumes, prices) {
        if (!volumes || volumes.length < 20) {
            return {
                current: 0,
                average: 0,
                ratio: 1,
                spike: false,
                signal: 'neutral',
                description: 'Yetersiz veri',
                trend: 'neutral'
            };
        }

        const currentVolume = volumes[volumes.length - 1];
        const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
        const ratio = currentVolume / avgVolume;

        // Spike tespiti (ortalamadan %50+ fazla)
        const isSpike = ratio > 1.5;
        const isLowVolume = ratio < 0.5;

        // Son fiyat değişimi
        const priceChange = prices.length > 1 ?
            ((prices[prices.length - 1] - prices[prices.length - 2]) / prices[prices.length - 2]) * 100 : 0;

        let signal = 'neutral';
        let description = 'Normal hacim';
        let trend = 'normal';

        if (isSpike && priceChange > 0) {
            signal = 'bullish';
            description = '🚀 Hacim patlaması + Yükseliş';
            trend = 'breakout_up';
        } else if (isSpike && priceChange < 0) {
            signal = 'bearish';
            description = '💥 Hacim patlaması + Düşüş';
            trend = 'breakout_down';
        } else if (isSpike) {
            signal = 'neutral';
            description = '⚡ Yüksek hacim - Dikkat!';
            trend = 'high_activity';
        } else if (isLowVolume) {
            signal = 'neutral';
            description = '😴 Düşük hacim - Bekle';
            trend = 'low_activity';
        }

        return {
            current: currentVolume,
            average: avgVolume,
            ratio: Math.round(ratio * 100) / 100,
            spike: isSpike,
            lowVolume: isLowVolume,
            signal,
            description,
            trend,
            formatted: {
                current: this.formatVolume(currentVolume),
                average: this.formatVolume(avgVolume),
                ratio: (ratio * 100).toFixed(0) + '%'
            }
        };
    },

    formatVolume(vol) {
        if (vol >= 1e9) return (vol / 1e9).toFixed(2) + 'B';
        if (vol >= 1e6) return (vol / 1e6).toFixed(2) + 'M';
        if (vol >= 1e3) return (vol / 1e3).toFixed(2) + 'K';
        return vol.toFixed(0);
    },

    // ============ FAZ 1: MUM FORMASYONLARI ============

    /**
     * Mum Formasyonları Tespiti
     * Gemini: "Piyasanın gerçeği"
     * ChatGPT: "Teknik analizin kralı"
     */
    detectCandlestickPatterns(ohlcData) {
        if (!ohlcData || ohlcData.length < 5) {
            return { patterns: [], signal: 'neutral', description: 'Yetersiz veri' };
        }

        const patterns = [];
        const len = ohlcData.length;

        // Son 3 mum
        const candles = ohlcData.slice(-5).map(c => ({
            open: c[1] || c.open,
            high: c[2] || c.high,
            low: c[3] || c.low,
            close: c[4] || c.close,
            body: Math.abs((c[4] || c.close) - (c[1] || c.open)),
            upperWick: (c[2] || c.high) - Math.max(c[1] || c.open, c[4] || c.close),
            lowerWick: Math.min(c[1] || c.open, c[4] || c.close) - (c[3] || c.low),
            isBullish: (c[4] || c.close) > (c[1] || c.open)
        }));

        const current = candles[candles.length - 1];
        const prev = candles[candles.length - 2];
        const prev2 = candles[candles.length - 3];

        const avgBody = candles.reduce((a, c) => a + c.body, 0) / candles.length;

        // DOJI - Kararsızlık
        if (current.body < avgBody * 0.1) {
            patterns.push({
                name: 'Doji',
                type: 'neutral',
                emoji: '✖️',
                description: 'Kararsızlık - Yön değişimi olabilir',
                strength: 2
            });
        }

        // HAMMER - Dip sinyali
        if (current.lowerWick > current.body * 2 && current.upperWick < current.body * 0.5 && !current.isBullish) {
            patterns.push({
                name: 'Hammer',
                type: 'bullish',
                emoji: '🔨',
                description: 'Çekiç - Potansiyel dip',
                strength: 3
            });
        }

        // INVERTED HAMMER
        if (current.upperWick > current.body * 2 && current.lowerWick < current.body * 0.5) {
            patterns.push({
                name: 'Inverted Hammer',
                type: 'bullish',
                emoji: '🔧',
                description: 'Ters Çekiç - Alım baskısı',
                strength: 2
            });
        }

        // SHOOTING STAR - Tepe sinyali
        if (current.upperWick > current.body * 2 && current.lowerWick < current.body * 0.5 && current.isBullish && prev.isBullish) {
            patterns.push({
                name: 'Shooting Star',
                type: 'bearish',
                emoji: '⭐',
                description: 'Kayan Yıldız - Potansiyel tepe',
                strength: 3
            });
        }

        // BULLISH ENGULFING - Güçlü alım
        if (current.isBullish && !prev.isBullish &&
            current.open <= prev.close && current.close >= prev.open &&
            current.body > prev.body * 1.5) {
            patterns.push({
                name: 'Bullish Engulfing',
                type: 'bullish',
                emoji: '🟢',
                description: 'Yutan Boğa - Güçlü alım sinyali',
                strength: 4
            });
        }

        // BEARISH ENGULFING - Güçlü satış
        if (!current.isBullish && prev.isBullish &&
            current.open >= prev.close && current.close <= prev.open &&
            current.body > prev.body * 1.5) {
            patterns.push({
                name: 'Bearish Engulfing',
                type: 'bearish',
                emoji: '🔴',
                description: 'Yutan Ayı - Güçlü satış sinyali',
                strength: 4
            });
        }

        // MORNING STAR - 3 mum dip formasyonu
        if (candles.length >= 3 &&
            !prev2.isBullish && prev2.body > avgBody &&
            prev.body < avgBody * 0.3 &&
            current.isBullish && current.body > avgBody) {
            patterns.push({
                name: 'Morning Star',
                type: 'bullish',
                emoji: '🌅',
                description: 'Sabah Yıldızı - Güçlü dönüş sinyali',
                strength: 5
            });
        }

        // EVENING STAR - 3 mum tepe formasyonu
        if (candles.length >= 3 &&
            prev2.isBullish && prev2.body > avgBody &&
            prev.body < avgBody * 0.3 &&
            !current.isBullish && current.body > avgBody) {
            patterns.push({
                name: 'Evening Star',
                type: 'bearish',
                emoji: '🌆',
                description: 'Akşam Yıldızı - Güçlü düşüş sinyali',
                strength: 5
            });
        }

        // THREE WHITE SOLDIERS - 3 ardışık yeşil
        if (candles.length >= 3 &&
            current.isBullish && prev.isBullish && prev2.isBullish &&
            current.close > prev.close && prev.close > prev2.close) {
            patterns.push({
                name: 'Three White Soldiers',
                type: 'bullish',
                emoji: '💪',
                description: '3 Beyaz Asker - Güçlü yükseliş',
                strength: 5
            });
        }

        // THREE BLACK CROWS - 3 ardışık kırmızı
        if (candles.length >= 3 &&
            !current.isBullish && !prev.isBullish && !prev2.isBullish &&
            current.close < prev.close && prev.close < prev2.close) {
            patterns.push({
                name: 'Three Black Crows',
                type: 'bearish',
                emoji: '🦅',
                description: '3 Kara Karga - Güçlü düşüş',
                strength: 5
            });
        }

        // PIN BAR - Uzun fitil
        const totalRange = current.high - current.low;
        if (current.lowerWick > totalRange * 0.6 || current.upperWick > totalRange * 0.6) {
            const isPinUp = current.lowerWick > current.upperWick;
            patterns.push({
                name: isPinUp ? 'Bullish Pin Bar' : 'Bearish Pin Bar',
                type: isPinUp ? 'bullish' : 'bearish',
                emoji: isPinUp ? '📍' : '📌',
                description: isPinUp ? 'Alıcı Pin Bar - Ret' : 'Satıcı Pin Bar - Ret',
                strength: 3
            });
        }

        // Sonuç
        const bullishPatterns = patterns.filter(p => p.type === 'bullish');
        const bearishPatterns = patterns.filter(p => p.type === 'bearish');

        let signal = 'neutral';
        let description = 'Belirgin formasyon yok';

        if (bullishPatterns.length > bearishPatterns.length) {
            signal = 'bullish';
            description = bullishPatterns.map(p => p.name).join(', ');
        } else if (bearishPatterns.length > bullishPatterns.length) {
            signal = 'bearish';
            description = bearishPatterns.map(p => p.name).join(', ');
        } else if (patterns.length > 0) {
            description = patterns.map(p => p.name).join(', ');
        }

        return {
            patterns: patterns.sort((a, b) => b.strength - a.strength),
            signal,
            description,
            bullishCount: bullishPatterns.length,
            bearishCount: bearishPatterns.length
        };
    },

    // ============ FAZ 1: DESTEK/DİRENÇ ============

    /**
     * Otomatik Destek/Direnç Tespiti
     * 3 AI: "Piyasanın hafızası"
     */
    calculateSupportResistance(prices, ohlcData) {
        if (!prices || prices.length < 20) {
            return {
                supports: [],
                resistances: [],
                nearestSupport: null,
                nearestResistance: null,
                signal: 'neutral',
                description: 'Yetersiz veri'
            };
        }

        const currentPrice = prices[prices.length - 1];
        const levels = [];

        // Swing High/Low tespiti
        for (let i = 2; i < prices.length - 2; i++) {
            // Swing High
            if (prices[i] > prices[i - 1] && prices[i] > prices[i - 2] &&
                prices[i] > prices[i + 1] && prices[i] > prices[i + 2]) {
                levels.push({ price: prices[i], type: 'resistance', strength: 1 });
            }
            // Swing Low
            if (prices[i] < prices[i - 1] && prices[i] < prices[i - 2] &&
                prices[i] < prices[i + 1] && prices[i] < prices[i + 2]) {
                levels.push({ price: prices[i], type: 'support', strength: 1 });
            }
        }

        // OHLC'den ekstra seviyeler
        if (ohlcData && ohlcData.length > 0) {
            // Son 20 mumun high ve low değerleri
            const recentOHLC = ohlcData.slice(-20);
            recentOHLC.forEach(candle => {
                const high = candle[2] || candle.high;
                const low = candle[3] || candle.low;
                levels.push({ price: high, type: 'resistance', strength: 0.5 });
                levels.push({ price: low, type: 'support', strength: 0.5 });
            });
        }

        // Seviyeleri grupla (yakın olanları birleştir)
        const tolerance = currentPrice * 0.005; // %0.5 tolerans
        const groupedLevels = [];

        levels.sort((a, b) => a.price - b.price).forEach(level => {
            const existing = groupedLevels.find(g => Math.abs(g.price - level.price) < tolerance);
            if (existing) {
                existing.strength += level.strength;
                existing.touches++;
            } else {
                groupedLevels.push({ ...level, touches: 1 });
            }
        });

        // Güce göre sırala
        groupedLevels.sort((a, b) => b.strength - a.strength);

        // Destek ve dirençleri ayır
        const supports = groupedLevels
            .filter(l => l.price < currentPrice)
            .sort((a, b) => b.price - a.price)
            .slice(0, 3);

        const resistances = groupedLevels
            .filter(l => l.price > currentPrice)
            .sort((a, b) => a.price - b.price)
            .slice(0, 3);

        // En yakın seviyeleri bul
        const nearestSupport = supports[0] || null;
        const nearestResistance = resistances[0] || null;

        // Mesafe hesapla
        let signal = 'neutral';
        let description = 'Seviyeler arası';

        if (nearestSupport && nearestResistance) {
            const distToSupport = ((currentPrice - nearestSupport.price) / currentPrice) * 100;
            const distToResistance = ((nearestResistance.price - currentPrice) / currentPrice) * 100;

            if (distToSupport < 1) {
                signal = 'bullish';
                description = `Desteğe yakın (${distToSupport.toFixed(1)}%)`;
            } else if (distToResistance < 1) {
                signal = 'bearish';
                description = `Dirence yakın (${distToResistance.toFixed(1)}%)`;
            } else {
                description = `S: ${distToSupport.toFixed(1)}% | R: ${distToResistance.toFixed(1)}%`;
            }
        }

        return {
            supports: supports.map(s => ({ price: s.price, strength: s.strength, touches: s.touches })),
            resistances: resistances.map(r => ({ price: r.price, strength: r.strength, touches: r.touches })),
            nearestSupport,
            nearestResistance,
            signal,
            description
        };
    },

    // ============ FAZ 1: FİBONACCİ ============

    /**
     * Fibonacci Retracement Seviyeleri
     * DeepSeek: "%38.2, %50, %61.8 en kritik seviyeler"
     */
    calculateFibonacci(prices) {
        if (!prices || prices.length < 20) {
            return {
                levels: {},
                trend: 'neutral',
                signal: 'neutral',
                description: 'Yetersiz veri'
            };
        }

        // Son 50 mumda trend tespiti
        const lookback = Math.min(prices.length, 50);
        const recentPrices = prices.slice(-lookback);

        const high = Math.max(...recentPrices);
        const low = Math.min(...recentPrices);
        const diff = high - low;

        const currentPrice = prices[prices.length - 1];

        // Trend yönünü belirle (son 20 mum)
        const shortTerm = prices.slice(-20);
        const isUptrend = shortTerm[shortTerm.length - 1] > shortTerm[0];

        let levels = {};

        if (isUptrend) {
            // Yükseliş trendi - düşük'ten yüksek'e Fib
            levels = {
                'level_0': { price: low, label: '0%', description: 'Trend Başlangıcı' },
                'level_236': { price: low + diff * 0.236, label: '23.6%', description: 'Zayıf Destek' },
                'level_382': { price: low + diff * 0.382, label: '38.2%', description: 'Orta Destek' },
                'level_500': { price: low + diff * 0.5, label: '50%', description: 'Kritik Destek' },
                'level_618': { price: low + diff * 0.618, label: '61.8%', description: 'Altın Oran' },
                'level_786': { price: low + diff * 0.786, label: '78.6%', description: 'Derin Düzeltme' },
                'level_100': { price: high, label: '100%', description: 'Trend Tepesi' }
            };
        } else {
            // Düşüş trendi - yüksek'ten düşük'e Fib
            levels = {
                'level_0': { price: high, label: '0%', description: 'Trend Başlangıcı' },
                'level_236': { price: high - diff * 0.236, label: '23.6%', description: 'Zayıf Direnç' },
                'level_382': { price: high - diff * 0.382, label: '38.2%', description: 'Orta Direnç' },
                'level_500': { price: high - diff * 0.5, label: '50%', description: 'Kritik Direnç' },
                'level_618': { price: high - diff * 0.618, label: '61.8%', description: 'Altın Oran' },
                'level_786': { price: high - diff * 0.786, label: '78.6%', description: 'Derin Düzeltme' },
                'level_100': { price: low, label: '100%', description: 'Trend Dibi' }
            };
        }

        // Fiyatın hangi Fib seviyesinde olduğunu bul
        let nearestLevel = null;
        let minDistance = Infinity;

        Object.entries(levels).forEach(([key, level]) => {
            const distance = Math.abs(currentPrice - level.price);
            if (distance < minDistance) {
                minDistance = distance;
                nearestLevel = { key, ...level };
            }
        });

        const percentFromNearest = nearestLevel ?
            ((Math.abs(currentPrice - nearestLevel.price) / currentPrice) * 100).toFixed(2) : 0;

        let signal = 'neutral';
        let description = 'Fibonaci seviyeleri arası';

        // Kritik seviyelere yakınlık kontrolü
        const criticalLevels = ['level_382', 'level_500', 'level_618'];
        const nearCritical = criticalLevels.find(key => {
            const level = levels[key];
            const dist = Math.abs(currentPrice - level.price) / currentPrice;
            return dist < 0.01; // %1 yakınlık
        });

        if (nearCritical) {
            signal = isUptrend ? 'bullish' : 'bearish';
            description = `${levels[nearCritical].label} seviyesinde (${levels[nearCritical].description})`;
        }

        return {
            levels,
            high,
            low,
            trend: isUptrend ? 'uptrend' : 'downtrend',
            trendLabel: isUptrend ? '📈 Yükseliş' : '📉 Düşüş',
            nearestLevel,
            percentFromNearest,
            signal,
            description
        };
    },

    // ============ FAZ 2: STOCHASTIC RSI ============

    /**
     * Stochastic RSI - Hızlı momentum göstergesi
     * ChatGPT: "RSI'den daha hızlı tepki verir"
     */
    calculateStochRSI(prices, rsiPeriod = 14, stochPeriod = 14, kSmooth = 3, dSmooth = 3) {
        if (prices.length < rsiPeriod + stochPeriod) {
            return {
                k: 50, d: 50,
                signal: 'neutral',
                description: 'Yetersiz veri',
                crossover: null
            };
        }

        // Önce RSI hesapla
        const rsiValues = [];
        for (let i = rsiPeriod; i <= prices.length; i++) {
            const slice = prices.slice(i - rsiPeriod, i);
            const rsi = this.calculateRSI(slice, rsiPeriod - 1);
            rsiValues.push(rsi.value);
        }

        if (rsiValues.length < stochPeriod) {
            return { k: 50, d: 50, signal: 'neutral', description: 'Yetersiz veri', crossover: null };
        }

        // Stochastic hesapla
        const stochValues = [];
        for (let i = stochPeriod - 1; i < rsiValues.length; i++) {
            const slice = rsiValues.slice(i - stochPeriod + 1, i + 1);
            const lowest = Math.min(...slice);
            const highest = Math.max(...slice);
            const stoch = highest === lowest ? 50 : ((rsiValues[i] - lowest) / (highest - lowest)) * 100;
            stochValues.push(stoch);
        }

        // K çizgisi (SMA ile düzelt)
        const kValues = this.SMA(stochValues, kSmooth).filter(v => v !== null);
        const k = kValues[kValues.length - 1] || 50;

        // D çizgisi (K'nın SMA'sı)
        const dValues = this.SMA(kValues, dSmooth).filter(v => v !== null);
        const d = dValues[dValues.length - 1] || 50;

        // Önceki değerler
        const prevK = kValues[kValues.length - 2] || k;
        const prevD = dValues[dValues.length - 2] || d;

        let signal = 'neutral';
        let description = 'Nötr bölge';
        let crossover = null;

        // Crossover tespiti
        if (prevK <= prevD && k > d) {
            crossover = 'bullish';
            signal = 'bullish';
            description = '🔥 Boğa kesişimi (K > D)';
        } else if (prevK >= prevD && k < d) {
            crossover = 'bearish';
            signal = 'bearish';
            description = '⚠️ Ayı kesişimi (K < D)';
        }

        // Aşırı bölge kontrolü
        if (k >= 80 && d >= 80) {
            signal = 'bearish';
            description = '🔴 Aşırı alım bölgesi';
        } else if (k <= 20 && d <= 20) {
            signal = 'bullish';
            description = '🟢 Aşırı satım bölgesi';
        }

        return {
            k: Math.round(k * 100) / 100,
            d: Math.round(d * 100) / 100,
            signal,
            description,
            crossover,
            overbought: k >= 80,
            oversold: k <= 20
        };
    },

    // ============ FAZ 2: ADX (TREND GÜCÜ) ============

    /**
     * ADX - Average Directional Index
     * DeepSeek: "Trendin gücünü ölçer"
     */
    calculateADX(ohlcData, period = 14) {
        if (!ohlcData || ohlcData.length < period + 1) {
            return {
                adx: 0, plusDI: 0, minusDI: 0,
                signal: 'neutral',
                description: 'Yetersiz veri',
                trendStrength: 'weak'
            };
        }

        // True Range, +DM, -DM hesapla
        const trValues = [];
        const plusDM = [];
        const minusDM = [];

        for (let i = 1; i < ohlcData.length; i++) {
            const high = ohlcData[i][2] || ohlcData[i].high;
            const low = ohlcData[i][3] || ohlcData[i].low;
            const close = ohlcData[i][4] || ohlcData[i].close;
            const prevHigh = ohlcData[i - 1][2] || ohlcData[i - 1].high;
            const prevLow = ohlcData[i - 1][3] || ohlcData[i - 1].low;
            const prevClose = ohlcData[i - 1][4] || ohlcData[i - 1].close;

            // True Range
            const tr = Math.max(
                high - low,
                Math.abs(high - prevClose),
                Math.abs(low - prevClose)
            );
            trValues.push(tr);

            // +DM ve -DM
            const upMove = high - prevHigh;
            const downMove = prevLow - low;

            plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
            minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
        }

        if (trValues.length < period) {
            return { adx: 0, plusDI: 0, minusDI: 0, signal: 'neutral', description: 'Yetersiz veri', trendStrength: 'weak' };
        }

        // Smoothed değerler (Wilder's smoothing)
        const smoothTR = this.wilderSmooth(trValues, period);
        const smoothPlusDM = this.wilderSmooth(plusDM, period);
        const smoothMinusDM = this.wilderSmooth(minusDM, period);

        // +DI ve -DI hesapla
        const plusDI = smoothTR.map((tr, i) => tr > 0 ? (smoothPlusDM[i] / tr) * 100 : 0);
        const minusDI = smoothTR.map((tr, i) => tr > 0 ? (smoothMinusDM[i] / tr) * 100 : 0);

        // DX hesapla
        const dx = plusDI.map((pdi, i) => {
            const sum = pdi + minusDI[i];
            return sum > 0 ? (Math.abs(pdi - minusDI[i]) / sum) * 100 : 0;
        });

        // ADX (DX'in smoothed ortalaması)
        const adxValues = this.wilderSmooth(dx.slice(-period * 2), period);

        const adx = adxValues[adxValues.length - 1] || 0;
        const currentPlusDI = plusDI[plusDI.length - 1] || 0;
        const currentMinusDI = minusDI[minusDI.length - 1] || 0;

        // Trend gücü ve yönü
        let trendStrength = 'weak';
        let signal = 'neutral';
        let description = 'Trend yok veya zayıf';

        if (adx >= 50) {
            trendStrength = 'very_strong';
            description = '💪 Çok güçlü trend';
        } else if (adx >= 40) {
            trendStrength = 'strong';
            description = '🔥 Güçlü trend';
        } else if (adx >= 25) {
            trendStrength = 'moderate';
            description = '📈 Orta güçte trend';
        } else if (adx >= 20) {
            trendStrength = 'developing';
            description = '🌱 Gelişen trend';
        }

        // DI yönüne göre sinyal
        if (adx >= 20) {
            if (currentPlusDI > currentMinusDI) {
                signal = 'bullish';
                description += ' (Yükseliş)';
            } else {
                signal = 'bearish';
                description += ' (Düşüş)';
            }
        }

        return {
            adx: Math.round(adx * 100) / 100,
            plusDI: Math.round(currentPlusDI * 100) / 100,
            minusDI: Math.round(currentMinusDI * 100) / 100,
            signal,
            description,
            trendStrength,
            hasTrend: adx >= 20,
            strongTrend: adx >= 40
        };
    },

    // Wilder's Smoothing
    wilderSmooth(data, period) {
        if (data.length < period) return data;

        const result = [];
        let sum = data.slice(0, period).reduce((a, b) => a + b, 0);
        result.push(sum);

        for (let i = period; i < data.length; i++) {
            sum = sum - (sum / period) + data[i];
            result.push(sum);
        }

        return result.map(v => v / period);
    },

    // ============ YARDIMCI FONKSİYONLAR ============

    formatPrice(price, decimals = 2) {
        if (price === null || price === undefined || isNaN(price)) return '$--';
        if (price < 0.01) decimals = 6;
        else if (price < 1) decimals = 4;
        return '$' + price.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    },

    // ============ GENEL ANALİZ SKORU ============

    /**
     * Tüm indikatörleri birleştirerek genel skor hesapla
     */
    calculateOverallScore(indicators) {
        let bullishScore = 0;
        let bearishScore = 0;
        let totalWeight = 0;

        const weights = {
            rsi: 15,
            macd: 15,
            ma200: 10,
            bb: 10,
            volume: 20,      // 3 AI: "Hacim çok önemli"
            patterns: 20,    // 3 AI: "Price action en önemli"
            stochRsi: 5,
            adx: 5
        };

        if (indicators.rsi) {
            totalWeight += weights.rsi;
            if (indicators.rsi.signal === 'bullish') bullishScore += weights.rsi;
            else if (indicators.rsi.signal === 'bearish') bearishScore += weights.rsi;
        }

        if (indicators.macd) {
            totalWeight += weights.macd;
            if (indicators.macd.trend === 'bullish') bullishScore += weights.macd;
            else if (indicators.macd.trend === 'bearish') bearishScore += weights.macd;
        }

        if (indicators.ma200) {
            totalWeight += weights.ma200;
            if (indicators.ma200.signal === 'bullish') bullishScore += weights.ma200;
            else if (indicators.ma200.signal === 'bearish') bearishScore += weights.ma200;
        }

        if (indicators.bb) {
            totalWeight += weights.bb;
            if (indicators.bb.signal === 'bullish') bullishScore += weights.bb;
            else if (indicators.bb.signal === 'bearish') bearishScore += weights.bb;
        }

        if (indicators.volume) {
            totalWeight += weights.volume;
            if (indicators.volume.signal === 'bullish') bullishScore += weights.volume;
            else if (indicators.volume.signal === 'bearish') bearishScore += weights.volume;
        }

        if (indicators.patterns) {
            totalWeight += weights.patterns;
            if (indicators.patterns.signal === 'bullish') bullishScore += weights.patterns;
            else if (indicators.patterns.signal === 'bearish') bearishScore += weights.patterns;
        }

        if (indicators.stochRsi) {
            totalWeight += weights.stochRsi;
            if (indicators.stochRsi.signal === 'bullish') bullishScore += weights.stochRsi;
            else if (indicators.stochRsi.signal === 'bearish') bearishScore += weights.stochRsi;
        }

        if (indicators.adx) {
            totalWeight += weights.adx;
            if (indicators.adx.signal === 'bullish') bullishScore += weights.adx;
            else if (indicators.adx.signal === 'bearish') bearishScore += weights.adx;
        }

        const bullishPercent = totalWeight > 0 ? (bullishScore / totalWeight) * 100 : 50;
        const bearishPercent = totalWeight > 0 ? (bearishScore / totalWeight) * 100 : 50;

        let recommendation = 'BEKLE';
        let signal = 'neutral';

        if (bullishPercent >= 70) {
            recommendation = 'GÜÇLÜ AL';
            signal = 'strong_bullish';
        } else if (bullishPercent >= 55) {
            recommendation = 'AL';
            signal = 'bullish';
        } else if (bearishPercent >= 70) {
            recommendation = 'GÜÇLÜ SAT';
            signal = 'strong_bearish';
        } else if (bearishPercent >= 55) {
            recommendation = 'SAT';
            signal = 'bearish';
        }

        return {
            bullishPercent: Math.round(bullishPercent),
            bearishPercent: Math.round(bearishPercent),
            recommendation,
            signal,
            confidence: Math.abs(bullishPercent - bearishPercent)
        };
    }
};
