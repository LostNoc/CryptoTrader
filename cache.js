/**
 * API Cache - LocalStorage based caching to avoid rate limits
 */

const Cache = {
    // Cache duration in milliseconds (5 minutes)
    DURATION: 5 * 60 * 1000,

    set(key, data) {
        const item = {
            data: data,
            timestamp: Date.now()
        };
        try {
            localStorage.setItem('crypto_' + key, JSON.stringify(item));
        } catch (e) {
            console.warn('Cache write failed:', e);
        }
    },

    get(key) {
        try {
            const item = localStorage.getItem('crypto_' + key);
            if (!item) return null;

            const parsed = JSON.parse(item);
            const age = Date.now() - parsed.timestamp;

            // Check if cache is still valid
            if (age < this.DURATION) {
                console.log(`Cache hit: ${key} (${Math.round(age / 1000)}s old)`);
                return parsed.data;
            }

            console.log(`Cache expired: ${key}`);
            return null;
        } catch (e) {
            return null;
        }
    },

    clear() {
        Object.keys(localStorage)
            .filter(k => k.startsWith('crypto_'))
            .forEach(k => localStorage.removeItem(k));
        console.log('Cache cleared');
    },

    // Get cache age in seconds
    getAge(key) {
        try {
            const item = localStorage.getItem('crypto_' + key);
            if (!item) return null;
            const parsed = JSON.parse(item);
            return Math.round((Date.now() - parsed.timestamp) / 1000);
        } catch (e) {
            return null;
        }
    }
};
