/**
 * Binance API Wrapper
 * High limit, no API key required for public endpoints
 */

const BinanceAPI = {
    BASE_URL: 'https://api.binance.com/api/v3',

    // Cached symbol list for search
    symbolCache: null,
    symbolCacheTime: 0,
    CACHE_DURATION: 30 * 60 * 1000, // 30 minutes

    // Popular coins mapping (CoinGecko ID -> Binance symbol)
    COIN_MAP: {
        'bitcoin': 'BTCUSDT',
        'ethereum': 'ETHUSDT',
        'binancecoin': 'BNBUSDT',
        'ripple': 'XRPUSDT',
        'cardano': 'ADAUSDT',
        'solana': 'SOLUSDT',
        'dogecoin': 'DOGEUSDT',
        'polkadot': 'DOTUSDT',
        'avalanche-2': 'AVAXUSDT',
        'chainlink': 'LINKUSDT',
        'polygon': 'MATICUSDT',
        'litecoin': 'LTCUSDT',
        'uniswap': 'UNIUSDT',
        'stellar': 'XLMUSDT',
        'cosmos': 'ATOMUSDT',
        'monero': 'XMRUSDT',
        'tron': 'TRXUSDT',
        'near': 'NEARUSDT',
        'aptos': 'APTUSDT',
        'arbitrum': 'ARBUSDT',
        'optimism': 'OPUSDT',
        'filecoin': 'FILUSDT',
        'hedera': 'HBARUSDT',
        'vechain': 'VETUSDT',
        'algorand': 'ALGOUSDT',
        'fantom': 'FTMUSDT',
        'the-sandbox': 'SANDUSDT',
        'decentraland': 'MANAUSDT',
        'axie-infinity': 'AXSUSDT',
        'aave': 'AAVEUSDT',
        'maker': 'MKRUSDT',
        'eos': 'EOSUSDT',
        'theta-token': 'THETAUSDT',
        'injective-protocol': 'INJUSDT',
        'render-token': 'RENDERUSDT',
        'sui': 'SUIUSDT',
        'sei-network': 'SEIUSDT',
        'pepe': 'PEPEUSDT',
        'shiba-inu': 'SHIBUSDT',
        'floki': 'FLOKIUSDT'
    },

    // Coin icons (Binance doesn't provide icons, use CryptoCompare)
    getIconUrl(symbol) {
        const base = symbol.replace('USDT', '').replace('BUSD', '');
        return `https://assets.coincap.io/assets/icons/${base.toLowerCase()}@2x.png`;
    },

    // Get all trading symbols (for search)
    async getSymbols() {
        if (this.symbolCache && Date.now() - this.symbolCacheTime < this.CACHE_DURATION) {
            return this.symbolCache;
        }

        try {
            const res = await fetch(`${this.BASE_URL}/exchangeInfo`);
            const data = await res.json();

            // Filter only USDT pairs and active symbols
            this.symbolCache = data.symbols
                .filter(s => s.quoteAsset === 'USDT' && s.status === 'TRADING')
                .map(s => ({
                    symbol: s.symbol,
                    baseAsset: s.baseAsset,
                    name: s.baseAsset,
                    id: s.baseAsset.toLowerCase()
                }));

            this.symbolCacheTime = Date.now();
            return this.symbolCache;
        } catch (e) {
            console.error('Failed to get symbols:', e);
            return [];
        }
    },

    // Search coins locally
    async searchCoins(query) {
        const symbols = await this.getSymbols();
        const q = query.toLowerCase();
        return symbols
            .filter(s => s.baseAsset.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
            .slice(0, 8)
            .map(s => ({
                id: s.id,
                symbol: s.baseAsset.toLowerCase(),
                name: s.baseAsset,
                thumb: this.getIconUrl(s.symbol)
            }));
    },

    // Get coin ID to Binance symbol
    getSymbol(coinId) {
        // Check map first
        if (this.COIN_MAP[coinId]) {
            return this.COIN_MAP[coinId];
        }
        // Fallback: assume coinId is base asset
        return coinId.toUpperCase() + 'USDT';
    },

    // Get 24h ticker data
    async getTicker(symbol) {
        const res = await fetch(`${this.BASE_URL}/ticker/24hr?symbol=${symbol}`);
        if (!res.ok) throw new Error('Ticker fetch failed');
        return await res.json();
    },

    // Get all tickers (for scanner)
    async getAllTickers() {
        const res = await fetch(`${this.BASE_URL}/ticker/24hr`);
        if (!res.ok) throw new Error('All tickers fetch failed');
        const data = await res.json();
        // Filter USDT pairs only
        return data.filter(t => t.symbol.endsWith('USDT'));
    },

    // Get klines (candlestick/OHLC data)
    // interval: 1m, 5m, 15m, 1h, 4h, 1d, 1w
    async getKlines(symbol, interval = '1d', limit = 100) {
        const res = await fetch(`${this.BASE_URL}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
        if (!res.ok) throw new Error('Klines fetch failed');
        const data = await res.json();

        // Format: [openTime, open, high, low, close, volume, closeTime, ...]
        return data.map(k => ({
            time: k[0] / 1000, // Unix timestamp
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5])
        }));
    },

    // Get price chart data (for line chart)
    async getChartData(symbol, days = 30) {
        const interval = days <= 1 ? '5m' : days <= 7 ? '1h' : '4h';
        const limit = days <= 1 ? 288 : days <= 7 ? 168 : Math.min(days * 6, 500);

        const klines = await this.getKlines(symbol, interval, limit);
        return klines.map(k => ({
            time: Math.floor(k.time),
            value: k.close
        }));
    },

    // Get OHLC data (for pivot calculations and volume analysis)
    async getOHLC(symbol, days = 30) {
        const limit = Math.min(days, 100);
        const klines = await this.getKlines(symbol, '1d', limit);

        // Format for indicators: [timestamp, open, high, low, close, volume]
        return klines.map(k => [
            k.time * 1000,
            k.open,
            k.high,
            k.low,
            k.close,
            k.volume  // Added volume for volume analysis
        ]);
    },

    // Get coin info (combined ticker + metadata)
    async getCoinInfo(coinId) {
        const symbol = this.getSymbol(coinId);
        const [ticker, klines] = await Promise.all([
            this.getTicker(symbol),
            this.getKlines(symbol, '1d', 7)
        ]);

        // Calculate 7d sparkline from daily klines
        const sparkline = klines.map(k => k.close);

        return {
            id: coinId,
            symbol: ticker.symbol.replace('USDT', '').toLowerCase(),
            name: ticker.symbol.replace('USDT', ''),
            image: { small: this.getIconUrl(symbol) },
            market_data: {
                current_price: { usd: parseFloat(ticker.lastPrice) },
                price_change_percentage_24h: parseFloat(ticker.priceChangePercent),
                high_24h: { usd: parseFloat(ticker.highPrice) },
                low_24h: { usd: parseFloat(ticker.lowPrice) },
                total_volume: { usd: parseFloat(ticker.quoteVolume) }
            },
            sparkline_in_7d: { price: sparkline }
        };
    },

    // Get top coins by volume (for scanner)
    async getTopCoins(limit = 200) {
        const tickers = await this.getAllTickers();

        // Sort by quote volume and take top N
        const sorted = tickers
            .filter(t => parseFloat(t.quoteVolume) > 1000000) // Min $1M volume
            .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
            .slice(0, limit);

        return sorted.map(t => {
            const baseAsset = t.symbol.replace('USDT', '');
            return {
                id: baseAsset.toLowerCase(),
                symbol: baseAsset.toLowerCase(),
                name: baseAsset,
                image: this.getIconUrl(t.symbol),
                current_price: parseFloat(t.lastPrice),
                price_change_percentage_24h: parseFloat(t.priceChangePercent),
                total_volume: parseFloat(t.quoteVolume),
                market_cap: parseFloat(t.quoteVolume) * 10, // Approximation
                binanceSymbol: t.symbol
            };
        });
    },

    // Get detailed data for scanner (configurable days)
    async getCoinChartForScanner(coinId, days = 30) {
        try {
            const symbol = this.getSymbol(coinId);
            // 4h klines: ~6 candles per day
            const limit = Math.min(days * 6, 500);
            const klines = await this.getKlines(symbol, '4h', limit);
            return {
                prices: klines.map(k => [k.time * 1000, k.close])
            };
        } catch (e) {
            console.error('Chart fetch error for', coinId, e);
            return null;
        }
    },

    // ============ WEBSOCKET REAL-TIME STREAMING ============

    ws: null,
    wsSymbol: null,
    wsCallbacks: {
        onPrice: null,
        onTrade: null
    },

    // Connect to WebSocket for real-time price updates
    connectWebSocket(symbol, callbacks = {}) {
        // Close existing connection if any
        this.disconnectWebSocket();

        this.wsSymbol = symbol.toLowerCase();
        this.wsCallbacks = { ...this.wsCallbacks, ...callbacks };

        // Connect to Binance WebSocket - ticker stream for real-time price
        const wsUrl = `wss://stream.binance.com:9443/ws/${this.wsSymbol}@ticker`;

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('🔗 WebSocket connected:', symbol);
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    // Ticker data format
                    const priceData = {
                        symbol: data.s,
                        price: parseFloat(data.c),           // Current price
                        priceChange: parseFloat(data.p),     // Price change
                        priceChangePercent: parseFloat(data.P), // Price change percent
                        high24h: parseFloat(data.h),         // 24h high
                        low24h: parseFloat(data.l),          // 24h low
                        volume: parseFloat(data.v),          // Volume
                        quoteVolume: parseFloat(data.q),     // Quote volume
                        timestamp: data.E                     // Event time
                    };

                    if (this.wsCallbacks.onPrice) {
                        this.wsCallbacks.onPrice(priceData);
                    }
                } catch (e) {
                    console.error('WebSocket message parse error:', e);
                }
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

            this.ws.onclose = () => {
                console.log('🔌 WebSocket disconnected');
                this.ws = null;
            };

            return true;
        } catch (e) {
            console.error('WebSocket connection failed:', e);
            return false;
        }
    },

    // Disconnect WebSocket
    disconnectWebSocket() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
            this.wsSymbol = null;
            console.log('WebSocket closed');
        }
    },

    // Check if WebSocket is connected
    isWebSocketConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    },

    // Connect to trade stream for real-time chart updates
    connectTradeStream(symbol, onTrade) {
        const wsUrl = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@trade`;

        const tradeWs = new WebSocket(wsUrl);

        tradeWs.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const trade = {
                    price: parseFloat(data.p),
                    quantity: parseFloat(data.q),
                    time: data.T / 1000, // Convert to seconds
                    isBuyerMaker: data.m
                };
                if (onTrade) onTrade(trade);
            } catch (e) {
                console.error('Trade parse error:', e);
            }
        };

        return tradeWs;
    }
};
