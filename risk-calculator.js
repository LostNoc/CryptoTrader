/**
 * Risk Calculator - %2 Risk Rule for Leveraged Trading
 */

const RiskCalculator = {
    currentPrice: 0,
    isLong: true,

    setPrice(price) {
        this.currentPrice = price;
    },

    setPosition(isLong) {
        this.isLong = isLong;
    },

    calculate(portfolioSize, leverage, stopLossPercent) {
        if (!this.currentPrice || this.currentPrice <= 0) {
            return { error: 'Coin fiyatı alınamadı' };
        }

        const riskPercent = 0.02; // %2 risk
        const maxLoss = portfolioSize * riskPercent;

        // Position size = Max Loss / (Stop Loss % / 100)
        const positionSize = maxLoss / (stopLossPercent / 100);

        // Entry amount = Position Size / Leverage
        const entryAmount = positionSize / leverage;

        // Calculate SL price based on position direction
        let slPrice, liqPrice;
        if (this.isLong) {
            slPrice = this.currentPrice * (1 - stopLossPercent / 100);
            liqPrice = this.currentPrice * (1 - (100 / leverage) / 100);
        } else {
            slPrice = this.currentPrice * (1 + stopLossPercent / 100);
            liqPrice = this.currentPrice * (1 + (100 / leverage) / 100);
        }

        // Calculate TP levels (Risk:Reward ratios)
        const slDistance = Math.abs(this.currentPrice - slPrice);
        let tp1, tp2, tp3;
        if (this.isLong) {
            tp1 = this.currentPrice + slDistance;     // 1:1 RR
            tp2 = this.currentPrice + (slDistance * 2); // 1:2 RR
            tp3 = this.currentPrice + (slDistance * 3); // 1:3 RR
        } else {
            tp1 = this.currentPrice - slDistance;
            tp2 = this.currentPrice - (slDistance * 2);
            tp3 = this.currentPrice - (slDistance * 3);
        }

        return {
            entryAmount: this.round(entryAmount),
            positionSize: this.round(positionSize),
            maxLoss: this.round(maxLoss),
            slPrice: this.round(slPrice),
            slPercent: stopLossPercent,
            liqPrice: this.round(liqPrice),
            tp1: this.round(tp1),
            tp2: this.round(tp2),
            tp3: this.round(tp3),
            currentPrice: this.currentPrice,
            leverage,
            isLong: this.isLong
        };
    },

    round(num) {
        if (num < 0.01) return Math.round(num * 1000000) / 1000000;
        if (num < 1) return Math.round(num * 10000) / 10000;
        return Math.round(num * 100) / 100;
    },

    formatUSD(num) {
        if (num === null || isNaN(num)) return '$0.00';
        if (num < 0.01) return '$' + num.toFixed(6);
        if (num < 1) return '$' + num.toFixed(4);
        return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    // ============ TEMİNAT HESAPLAYICI ============

    /**
     * Teminat ekleme hesaplaması
     * @param {number} currentMargin - Mevcut teminat (entry amount)
     * @param {number} additionalMargin - Eklenecek teminat
     * @param {number} positionSize - Pozisyon büyüklüğü
     * @param {boolean} isLong - Long mu Short mu
     * @returns {Object} Yeni likidasyon bilgileri
     */
    calculateMarginEffect(currentMargin, additionalMargin, positionSize, isLong = true) {
        if (!this.currentPrice || this.currentPrice <= 0) {
            return { error: 'Coin fiyatı alınamadı' };
        }

        const entryPrice = this.currentPrice;
        const totalMargin = currentMargin + additionalMargin;

        // Yeni efektif kaldıraç
        const newLeverage = positionSize / totalMargin;

        // Yeni likidasyon yüzdesi (yaklaşık olarak margin/position oranı)
        const liqPercent = (totalMargin / positionSize) * 100;

        // Yeni likidasyon fiyatı
        let newLiqPrice;
        if (isLong) {
            newLiqPrice = entryPrice * (1 - liqPercent / 100);
        } else {
            newLiqPrice = entryPrice * (1 + liqPercent / 100);
        }

        // Önceki likidasyon fiyatı (sadece mevcut teminat ile)
        const oldLiqPercent = (currentMargin / positionSize) * 100;
        let oldLiqPrice;
        if (isLong) {
            oldLiqPrice = entryPrice * (1 - oldLiqPercent / 100);
        } else {
            oldLiqPrice = entryPrice * (1 + oldLiqPercent / 100);
        }

        // Likidasyon fiyatı ne kadar değişti (yüzde)
        const liqImprovement = Math.abs(((newLiqPrice - oldLiqPrice) / entryPrice) * 100);

        return {
            newLiqPrice: this.round(newLiqPrice),
            oldLiqPrice: this.round(oldLiqPrice),
            newLeverage: this.round(newLeverage),
            liqImprovement: this.round(liqImprovement),
            totalMargin: this.round(totalMargin),
            liqPercent: this.round(liqPercent)
        };
    },

    /**
     * Hedef likidasyon için gereken teminat hesapla
     * @param {number} currentMargin - Mevcut teminat
     * @param {number} positionSize - Pozisyon büyüklüğü
     * @param {number} targetLiqPercent - Hedef likidasyon yüzdesi (giriş fiyatından)
     * @param {boolean} isLong - Long mu Short mu
     * @returns {Object} Gereken teminat bilgileri
     */
    calculateRequiredMargin(currentMargin, positionSize, targetLiqPercent, isLong = true) {
        if (!this.currentPrice || this.currentPrice <= 0) {
            return { error: 'Coin fiyatı alınamadı' };
        }

        const entryPrice = this.currentPrice;

        // Hedef likidasyon fiyatı
        let targetLiqPrice;
        if (isLong) {
            targetLiqPrice = entryPrice * (1 - targetLiqPercent / 100);
        } else {
            targetLiqPrice = entryPrice * (1 + targetLiqPercent / 100);
        }

        // Gereken toplam teminat
        const requiredTotalMargin = (targetLiqPercent / 100) * positionSize;

        // Eklenmesi gereken teminat
        const additionalMarginNeeded = Math.max(0, requiredTotalMargin - currentMargin);

        // Yeni efektif kaldıraç
        const newLeverage = positionSize / requiredTotalMargin;

        return {
            targetLiqPrice: this.round(targetLiqPrice),
            requiredTotalMargin: this.round(requiredTotalMargin),
            additionalMarginNeeded: this.round(additionalMarginNeeded),
            newLeverage: this.round(newLeverage),
            targetLiqPercent: targetLiqPercent
        };
    }
};
