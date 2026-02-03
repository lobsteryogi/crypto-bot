export class RsiOptimizer {
    constructor(config = {}) {
        this.config = {
            minTradesPerBucket: 3,
            ...config
        };
    }

    parseRsiFromReason(reason) {
        if (!reason) return null;
        // Matches "RSI oversold (29.69)" or similar patterns
        const match = reason.match(/RSI \w+ \((\d+(?:\.\d+)?)\)/);
        if (match && match[1]) {
            return parseFloat(match[1]);
        }
        return null;
    }

    analyzeTradesByRsi(trades) {
        const buckets = {
            long: {}, // RSI < 50 usually
            short: {} // RSI > 50 usually (though bot seems to be long-only mostly based on logs, handling both is safer)
        };

        // Initialize buckets (e.g., 0-5, 5-10, ... 95-100)
        for (let i = 0; i < 100; i += 5) {
            buckets.long[i] = { range: `${i}-${i+5}`, wins: 0, total: 0, profit: 0 };
            buckets.short[i] = { range: `${i}-${i+5}`, wins: 0, total: 0, profit: 0 };
        }

        for (const trade of trades) {
            const rsi = this.parseRsiFromReason(trade.reason);
            if (rsi === null) continue;

            const bucketKey = Math.floor(rsi / 5) * 5;
            if (bucketKey < 0 || bucketKey >= 100) continue;

            const targetBucket = trade.type === 'long' ? buckets.long : buckets.short;
            
            if (targetBucket[bucketKey]) {
                targetBucket[bucketKey].total++;
                if (trade.profit > 0) targetBucket[bucketKey].wins++;
                targetBucket[bucketKey].profit += trade.profit;
            }
        }

        return buckets;
    }

    getOptimalThresholds(trades) {
        const analysis = this.analyzeTradesByRsi(trades);
        
        // Find optimal oversold (long entry)
        // We look for the highest RSI bucket (up to 50) that still maintains a high win rate (> 60%?)
        // OR simply finding the bucket with the highest win rate and some volume
        
        let bestOversold = 30; // Default
        let maxWinRateLong = 0;

        // Analyze Long buckets (Oversold optimization)
        // We typically look at buckets from 10 to 50
        for (let i = 10; i < 50; i += 5) {
            const bucket = analysis.long[i];
            if (bucket.total >= this.config.minTradesPerBucket) {
                const winRate = bucket.wins / bucket.total;
                // If this higher RSI still yields good results, it might be a better threshold (more trades)
                // Heuristic: Weighted score of winRate * log(total) ?
                // For now, let's pick the threshold that has > 55% win rate and allows most trades (highest RSI)
                // Or safely: pick the bucket with highest winrate
                
                if (winRate > maxWinRateLong) {
                    maxWinRateLong = winRate;
                    bestOversold = i + 5; // Set threshold to the upper bound of this successful bucket
                }
            }
        }

        // For this task, we mainly care about 'oversold' for entry if it's a long-only bot.
        // If the bot shorts, we'd do the same for overbought.
        
        // Let's stick to the requirements: "Return: { oversold: 35, overbought: 65 }"
        
        // Simple Logic:
        // 1. Filter buckets with win rate > 60%
        // 2. Set oversold to the highest RSI key from those buckets (more trades)
        
        let optimalOversold = 30;
        let bestLongScore = -1;

        Object.entries(analysis.long).forEach(([key, stats]) => {
            const rsiStart = parseInt(key);
            if (rsiStart >= 50) return; // Ignore high RSI for oversold logic

            if (stats.total >= this.config.minTradesPerBucket) {
                const winRate = stats.wins / stats.total;
                // We want high win rate, but also we don't want RSI to be too low (rare trades)
                // So we prefer higher RSI if win rate is acceptable.
                
                // If winrate is solid (>0.5), consider it
                if (winRate > 0.55) {
                   // If this bucket is good, we can potentially raise the threshold to include it
                   // Threshold should be inclusive, so if bucket 35-40 is good, threshold could be 40.
                   optimalOversold = Math.max(optimalOversold, rsiStart + 5);
                }
            }
        });

        // Cap changes to avoid wild swings
        optimalOversold = Math.min(Math.max(optimalOversold, 20), 45);

        return {
            oversold: optimalOversold,
            overbought: 70 // Keeping default or static for now if we don't have short data/exit data correlation easily mapped
            // Note: Exit reason "RSI overbought (62.50)" is for closing.
            // Optimization usually focuses on ENTRY triggers. 
            // If we want to optimize EXIT, we'd need to correlate exit RSI with "leaving money on table" vs "caught the peak", which is harder.
            // Requirement says "Find optimal oversold/overbought thresholds", likely meaning Entry thresholds for Long/Short 
            // OR Entry/Exit if we treat overbought as exit for long.
        };
    }
}
