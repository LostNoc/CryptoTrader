/**
 * Pattern Visuals - Candlestick Pattern SVG Drawings & Modal
 * Shows visual representation of detected candlestick patterns
 */

const PatternVisuals = {
    // Pattern data with SVG drawings and descriptions
    patterns: {
        'Doji': {
            svg: `<svg viewBox="0 0 100 120" class="pattern-svg">
                <line x1="50" y1="10" x2="50" y2="110" stroke="#8b949e" stroke-width="2"/>
                <rect x="40" y="58" width="20" height="4" fill="#8b949e"/>
                <text x="50" y="130" class="candle-label">Doji</text>
            </svg>`,
            description: 'Açılış ve kapanış fiyatı neredeyse aynı. Piyasada kararsızlık var. Trend dönüşü sinyali olabilir.',
            type: 'neutral',
            meaning: 'Alıcılar ve satıcılar dengede. Yön değişimi bekleniyor.'
        },
        'Hammer': {
            svg: `<svg viewBox="0 0 100 120" class="pattern-svg">
                <line x1="50" y1="30" x2="50" y2="110" stroke="#8b949e" stroke-width="2"/>
                <rect x="35" y="30" width="30" height="15" fill="#26a69a" stroke="#26a69a"/>
                <text x="50" y="130" class="candle-label">Hammer</text>
            </svg>`,
            description: 'Uzun alt fitil, küçük gövde. Düşüş trendinin sonunda görülür. Alıcılar güç kazanıyor.',
            type: 'bullish',
            meaning: 'Satıcılar fiyatı aşağı çekti ama alıcılar geri aldı. Dönüş sinyali!'
        },
        'Inverted Hammer': {
            svg: `<svg viewBox="0 0 100 120" class="pattern-svg">
                <line x1="50" y1="10" x2="50" y2="90" stroke="#8b949e" stroke-width="2"/>
                <rect x="35" y="75" width="30" height="15" fill="#26a69a" stroke="#26a69a"/>
                <text x="50" y="130" class="candle-label">Ters Çekiç</text>
            </svg>`,
            description: 'Uzun üst fitil, küçük gövde altta. Düşüş sonrası potansiyel dönüş sinyali.',
            type: 'bullish',
            meaning: 'Alıcılar yukarı denedi ama ret yedi, ancak tekrar deneyebilirler.'
        },
        'Shooting Star': {
            svg: `<svg viewBox="0 0 100 120" class="pattern-svg">
                <line x1="50" y1="10" x2="50" y2="90" stroke="#8b949e" stroke-width="2"/>
                <rect x="35" y="75" width="30" height="15" fill="#ef5350" stroke="#ef5350"/>
                <text x="50" y="130" class="candle-label">Kayan Yıldız</text>
            </svg>`,
            description: 'Uzun üst fitil, küçük gövde. Yükseliş trendinin tepesinde görülür. Satış baskısı başlıyor.',
            type: 'bearish',
            meaning: 'Alıcılar yukarı zorladı ama satıcılar ret etti. Düşüş başlayabilir!'
        },
        'Bullish Engulfing': {
            svg: `<svg viewBox="0 0 140 120" class="pattern-svg">
                <rect x="30" y="40" width="20" height="30" fill="#ef5350" stroke="#ef5350"/>
                <line x1="40" y1="35" x2="40" y2="75" stroke="#8b949e" stroke-width="2"/>
                <rect x="70" y="30" width="35" height="50" fill="#26a69a" stroke="#26a69a"/>
                <line x1="87" y1="25" x2="87" y2="85" stroke="#8b949e" stroke-width="2"/>
                <text x="70" y="130" class="candle-label">Yutan Boğa</text>
            </svg>`,
            description: 'Yeşil mum önceki kırmızı mumu tamamen yutuyor. Çok güçlü alım sinyali!',
            type: 'bullish',
            meaning: 'Alıcılar tam kontrolü ele aldı. Güçlü yükseliş bekleniyor.'
        },
        'Bearish Engulfing': {
            svg: `<svg viewBox="0 0 140 120" class="pattern-svg">
                <rect x="30" y="40" width="20" height="30" fill="#26a69a" stroke="#26a69a"/>
                <line x1="40" y1="35" x2="40" y2="75" stroke="#8b949e" stroke-width="2"/>
                <rect x="70" y="30" width="35" height="50" fill="#ef5350" stroke="#ef5350"/>
                <line x1="87" y1="25" x2="87" y2="85" stroke="#8b949e" stroke-width="2"/>
                <text x="70" y="130" class="candle-label">Yutan Ayı</text>
            </svg>`,
            description: 'Kırmızı mum önceki yeşil mumu tamamen yutuyor. Çok güçlü satış sinyali!',
            type: 'bearish',
            meaning: 'Satıcılar tam kontrolü ele aldı. Güçlü düşüş bekleniyor.'
        },
        'Morning Star': {
            svg: `<svg viewBox="0 0 180 120" class="pattern-svg">
                <rect x="20" y="25" width="25" height="50" fill="#ef5350" stroke="#ef5350"/>
                <line x1="32" y1="20" x2="32" y2="80" stroke="#8b949e" stroke-width="2"/>
                <rect x="75" y="55" width="15" height="8" fill="#8b949e" stroke="#8b949e"/>
                <line x1="82" y1="50" x2="82" y2="68" stroke="#8b949e" stroke-width="2"/>
                <rect x="120" y="25" width="25" height="50" fill="#26a69a" stroke="#26a69a"/>
                <line x1="132" y1="20" x2="132" y2="80" stroke="#8b949e" stroke-width="2"/>
                <text x="90" y="130" class="candle-label">Sabah Yıldızı</text>
            </svg>`,
            description: '3 mumlu güçlü dönüş formasyonu. Büyük kırmızı + küçük doji + büyük yeşil.',
            type: 'bullish',
            meaning: 'Düşüş trendi sona erdi, yükseliş başlıyor. En güvenilir formasyonlardan!'
        },
        'Evening Star': {
            svg: `<svg viewBox="0 0 180 120" class="pattern-svg">
                <rect x="20" y="25" width="25" height="50" fill="#26a69a" stroke="#26a69a"/>
                <line x1="32" y1="20" x2="32" y2="80" stroke="#8b949e" stroke-width="2"/>
                <rect x="75" y="25" width="15" height="8" fill="#8b949e" stroke="#8b949e"/>
                <line x1="82" y1="20" x2="82" y2="38" stroke="#8b949e" stroke-width="2"/>
                <rect x="120" y="25" width="25" height="50" fill="#ef5350" stroke="#ef5350"/>
                <line x1="132" y1="20" x2="132" y2="80" stroke="#8b949e" stroke-width="2"/>
                <text x="90" y="130" class="candle-label">Akşam Yıldızı</text>
            </svg>`,
            description: '3 mumlu güçlü dönüş formasyonu. Büyük yeşil + küçük doji + büyük kırmızı.',
            type: 'bearish',
            meaning: 'Yükseliş trendi sona erdi, düşüş başlıyor. Kâr al sinyali!'
        },
        'Three White Soldiers': {
            svg: `<svg viewBox="0 0 180 120" class="pattern-svg">
                <rect x="20" y="60" width="25" height="35" fill="#26a69a" stroke="#26a69a"/>
                <line x1="32" y1="55" x2="32" y2="100" stroke="#8b949e" stroke-width="2"/>
                <rect x="70" y="40" width="25" height="40" fill="#26a69a" stroke="#26a69a"/>
                <line x1="82" y1="35" x2="82" y2="85" stroke="#8b949e" stroke-width="2"/>
                <rect x="120" y="20" width="25" height="45" fill="#26a69a" stroke="#26a69a"/>
                <line x1="132" y1="15" x2="132" y2="70" stroke="#8b949e" stroke-width="2"/>
                <text x="90" y="130" class="candle-label">3 Beyaz Asker</text>
            </svg>`,
            description: '3 ardışık yükselen yeşil mum. Her mum öncekinden daha yüksekte kapanıyor.',
            type: 'bullish',
            meaning: 'Çok güçlü alım baskısı! Trend devam edecek.'
        },
        'Three Black Crows': {
            svg: `<svg viewBox="0 0 180 120" class="pattern-svg">
                <rect x="20" y="20" width="25" height="35" fill="#ef5350" stroke="#ef5350"/>
                <line x1="32" y1="15" x2="32" y2="60" stroke="#8b949e" stroke-width="2"/>
                <rect x="70" y="40" width="25" height="40" fill="#ef5350" stroke="#ef5350"/>
                <line x1="82" y1="35" x2="82" y2="85" stroke="#8b949e" stroke-width="2"/>
                <rect x="120" y="60" width="25" height="45" fill="#ef5350" stroke="#ef5350"/>
                <line x1="132" y1="55" x2="132" y2="110" stroke="#8b949e" stroke-width="2"/>
                <text x="90" y="130" class="candle-label">3 Kara Karga</text>
            </svg>`,
            description: '3 ardışık düşen kırmızı mum. Her mum öncekinden daha düşükte kapanıyor.',
            type: 'bearish',
            meaning: 'Çok güçlü satış baskısı! Düşüş devam edecek.'
        },
        'Bullish Pin Bar': {
            svg: `<svg viewBox="0 0 100 120" class="pattern-svg">
                <line x1="50" y1="25" x2="50" y2="110" stroke="#8b949e" stroke-width="2"/>
                <rect x="35" y="25" width="30" height="20" fill="#26a69a" stroke="#26a69a"/>
                <text x="50" y="130" class="candle-label">Boğa Pin Bar</text>
            </svg>`,
            description: 'Çok uzun alt fitil. Alıcılar güçlü bir şekilde satışları reddetti.',
            type: 'bullish',
            meaning: 'Destek seviyesinde güçlü alıcı tepkisi. Bounce bekleniyor!'
        },
        'Bearish Pin Bar': {
            svg: `<svg viewBox="0 0 100 120" class="pattern-svg">
                <line x1="50" y1="10" x2="50" y2="95" stroke="#8b949e" stroke-width="2"/>
                <rect x="35" y="75" width="30" height="20" fill="#ef5350" stroke="#ef5350"/>
                <text x="50" y="130" class="candle-label">Ayı Pin Bar</text>
            </svg>`,
            description: 'Çok uzun üst fitil. Satıcılar güçlü bir şekilde alımları reddetti.',
            type: 'bearish',
            meaning: 'Direnç seviyesinde güçlü satıcı tepkisi. Düşüş bekleniyor!'
        }
    },

    // Show modal with pattern visual
    show(patternName) {
        const pattern = this.patterns[patternName];
        if (!pattern) {
            console.log('Pattern not found:', patternName);
            return;
        }

        // Create modal if doesn't exist
        let modal = document.getElementById('patternModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'patternModal';
            modal.className = 'pattern-modal';
            document.body.appendChild(modal);
        }

        // Set content
        modal.innerHTML = `
            <div class="pattern-modal-overlay" onclick="PatternVisuals.hide()"></div>
            <div class="pattern-modal-content ${pattern.type}">
                <button class="pattern-modal-close" onclick="PatternVisuals.hide()">✕</button>
                <div class="pattern-modal-header">
                    <h3>${patternName}</h3>
                    <span class="pattern-type-badge ${pattern.type}">
                        ${pattern.type === 'bullish' ? '📈 Yükseliş' : pattern.type === 'bearish' ? '📉 Düşüş' : '➖ Nötr'}
                    </span>
                </div>
                <div class="pattern-visual">
                    ${pattern.svg}
                </div>
                <div class="pattern-info">
                    <p class="pattern-description">${pattern.description}</p>
                    <div class="pattern-meaning">
                        <span class="meaning-icon">💡</span>
                        <span>${pattern.meaning}</span>
                    </div>
                </div>
            </div>
        `;

        // Show with animation
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    },

    // Hide modal
    hide() {
        const modal = document.getElementById('patternModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
};
