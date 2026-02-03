// Sentiment analysis module for crypto trading
// Fetches Fear & Greed Index and news sentiment

import https from 'https';
import http from 'http';

// Simple HTTP fetch wrapper (no external deps)
function fetch(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    protocol.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ ok: res.statusCode === 200, status: res.statusCode, json: () => JSON.parse(data), text: () => data });
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Cache to avoid excessive API calls
const cache = {
  fearGreed: { data: null, timestamp: 0 },
  news: { data: null, timestamp: 0 }
};

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

/**
 * Fetch Fear & Greed Index from alternative.me
 * Returns value 0-100 (0 = extreme fear, 100 = extreme greed)
 */
async function fetchFearGreedIndex() {
  const now = Date.now();
  
  // Return cached data if fresh
  if (cache.fearGreed.data && (now - cache.fearGreed.timestamp) < CACHE_TTL) {
    return cache.fearGreed.data;
  }
  
  try {
    const response = await fetch('https://api.alternative.me/fng/?limit=1');
    if (!response.ok) {
      throw new Error(`Fear & Greed API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.data && data.data[0]) {
      const fngData = {
        value: parseInt(data.data[0].value),
        classification: data.data[0].value_classification,
        timestamp: data.data[0].timestamp,
        updated: new Date(data.data[0].timestamp * 1000).toISOString()
      };
      
      // Cache it
      cache.fearGreed = { data: fngData, timestamp: now };
      return fngData;
    }
    
    throw new Error('Invalid Fear & Greed data format');
  } catch (error) {
    console.error('Fear & Greed fetch error:', error.message);
    // Return cached data if available, even if stale
    if (cache.fearGreed.data) {
      return { ...cache.fearGreed.data, stale: true };
    }
    return { value: 50, classification: 'Neutral', error: error.message };
  }
}

/**
 * Fetch crypto news from CryptoCompare (free tier)
 * Analyzes sentiment from news headlines
 */
async function fetchNewsSentiment(symbol = 'BTC') {
  const now = Date.now();
  const cacheKey = `news_${symbol}`;
  
  // Return cached data if fresh
  if (cache.news[cacheKey] && (now - cache.news[cacheKey].timestamp) < CACHE_TTL) {
    return cache.news[cacheKey].data;
  }
  
  try {
    // Extract base symbol (e.g., 'BTC' from 'BTC/USDT')
    const baseSymbol = symbol.split('/')[0].toUpperCase();
    
    // CryptoCompare free API for news
    const url = `https://min-api.cryptocompare.com/data/v2/news/?categories=${baseSymbol}&lang=EN`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`CryptoCompare API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.Data && Array.isArray(data.Data)) {
      // Take last 20 news items
      const recentNews = data.Data.slice(0, 20);
      
      // Simple sentiment analysis based on keywords
      const sentimentScore = analyzeNewsSentiment(recentNews);
      
      const newsData = {
        score: sentimentScore.score,
        bullishCount: sentimentScore.bullish,
        bearishCount: sentimentScore.bearish,
        neutralCount: sentimentScore.neutral,
        totalArticles: recentNews.length,
        topHeadlines: recentNews.slice(0, 3).map(n => ({
          title: n.title,
          source: n.source,
          sentiment: getHeadlineSentiment(n.title)
        }))
      };
      
      // Cache it
      cache.news[cacheKey] = { data: newsData, timestamp: now };
      return newsData;
    }
    
    throw new Error('Invalid news data format');
  } catch (error) {
    console.error('News sentiment fetch error:', error.message);
    // Return cached data if available
    if (cache.news[cacheKey]) {
      return { ...cache.news[cacheKey].data, stale: true };
    }
    return { score: 50, error: error.message, totalArticles: 0 };
  }
}

// Bullish keywords
const BULLISH_KEYWORDS = [
  'surge', 'soar', 'rally', 'bull', 'bullish', 'breakout', 'moon', 'pump',
  'gain', 'gains', 'rise', 'rising', 'up', 'high', 'higher', 'ath', 'all-time high',
  'buy', 'buying', 'accumulate', 'adoption', 'institutional', 'etf', 'approved',
  'profit', 'profitable', 'growth', 'growing', 'positive', 'optimism', 'optimistic',
  'strong', 'strength', 'recover', 'recovery', 'rebound', 'bounce', 'launch',
  'partnership', 'upgrade', 'update', 'innovation', 'mainstream', 'support'
];

// Bearish keywords
const BEARISH_KEYWORDS = [
  'crash', 'plunge', 'dump', 'bear', 'bearish', 'breakdown', 'fall', 'falling',
  'drop', 'drops', 'decline', 'declining', 'down', 'low', 'lower', 'sell',
  'selling', 'selloff', 'sell-off', 'fear', 'panic', 'liquidation', 'liquidated',
  'loss', 'losses', 'negative', 'pessimism', 'pessimistic', 'weak', 'weakness',
  'ban', 'banned', 'regulation', 'sec', 'lawsuit', 'investigation', 'fraud',
  'hack', 'hacked', 'exploit', 'scam', 'collapse', 'bankrupt', 'insolvent',
  'warning', 'risk', 'risky', 'volatile', 'volatility', 'correction', 'dip'
];

/**
 * Analyze sentiment from news headlines
 */
function analyzeNewsSentiment(articles) {
  let bullish = 0;
  let bearish = 0;
  let neutral = 0;
  
  for (const article of articles) {
    const text = (article.title + ' ' + (article.body || '')).toLowerCase();
    
    let bullishHits = 0;
    let bearishHits = 0;
    
    for (const word of BULLISH_KEYWORDS) {
      if (text.includes(word)) bullishHits++;
    }
    
    for (const word of BEARISH_KEYWORDS) {
      if (text.includes(word)) bearishHits++;
    }
    
    if (bullishHits > bearishHits) {
      bullish++;
    } else if (bearishHits > bullishHits) {
      bearish++;
    } else {
      neutral++;
    }
  }
  
  // Calculate score (0-100)
  const total = bullish + bearish + neutral;
  if (total === 0) return { score: 50, bullish: 0, bearish: 0, neutral: 0 };
  
  // Score formula: 50 + (bullish% - bearish%) * 50
  const bullishPercent = bullish / total;
  const bearishPercent = bearish / total;
  const score = Math.round(50 + (bullishPercent - bearishPercent) * 50);
  
  return {
    score: Math.max(0, Math.min(100, score)),
    bullish,
    bearish,
    neutral
  };
}

/**
 * Get simple sentiment classification for a headline
 */
function getHeadlineSentiment(title) {
  const text = title.toLowerCase();
  let bullishHits = 0;
  let bearishHits = 0;
  
  for (const word of BULLISH_KEYWORDS) {
    if (text.includes(word)) bullishHits++;
  }
  
  for (const word of BEARISH_KEYWORDS) {
    if (text.includes(word)) bearishHits++;
  }
  
  if (bullishHits > bearishHits) return 'bullish';
  if (bearishHits > bullishHits) return 'bearish';
  return 'neutral';
}

/**
 * Get sentiment classification from score
 */
function getClassification(score) {
  if (score >= 80) return 'Extreme Greed';
  if (score >= 60) return 'Greed';
  if (score >= 40) return 'Neutral';
  if (score >= 20) return 'Fear';
  return 'Extreme Fear';
}

/**
 * Get trading bias from sentiment (-1 to 1)
 * Negative = contrarian bearish (when greedy), positive = contrarian bullish (when fearful)
 */
function getTradingBias(score) {
  // Contrarian approach: buy fear, sell greed
  // At score 0 (extreme fear): bias = +1 (strong buy)
  // At score 50 (neutral): bias = 0
  // At score 100 (extreme greed): bias = -1 (strong sell)
  return (50 - score) / 50;
}

/**
 * Main function: Get combined sentiment for a symbol
 * @param {string} symbol - Trading pair (e.g., 'BTC/USDT', 'SOL/USDT')
 * @returns {Object} Combined sentiment data
 */
export async function getSentiment(symbol = 'BTC/USDT') {
  try {
    // Fetch both data sources in parallel
    const [fearGreed, news] = await Promise.all([
      fetchFearGreedIndex(),
      fetchNewsSentiment(symbol)
    ]);
    
    // Calculate combined score (weighted average)
    // Fear & Greed: 60% weight (more reliable, broader market)
    // News sentiment: 40% weight (more volatile, coin-specific)
    const fgWeight = 0.6;
    const newsWeight = 0.4;
    
    const fgScore = fearGreed.value || 50;
    const newsScore = news.score || 50;
    
    const combinedScore = Math.round(fgScore * fgWeight + newsScore * newsWeight);
    const tradingBias = getTradingBias(combinedScore);
    
    // Generate summary
    const classification = getClassification(combinedScore);
    let summary = `Market: ${classification} (${combinedScore}/100). `;
    
    if (combinedScore < 25) {
      summary += 'Extreme fear - contrarian buy opportunity. ';
    } else if (combinedScore < 40) {
      summary += 'Fear in market - potential buying zone. ';
    } else if (combinedScore > 75) {
      summary += 'Extreme greed - contrarian caution advised. ';
    } else if (combinedScore > 60) {
      summary += 'Greed building - watch for reversal. ';
    } else {
      summary += 'Neutral sentiment - follow technicals. ';
    }
    
    if (news.bullishCount > news.bearishCount) {
      summary += `News: ${news.bullishCount} bullish vs ${news.bearishCount} bearish.`;
    } else if (news.bearishCount > news.bullishCount) {
      summary += `News: ${news.bearishCount} bearish vs ${news.bullishCount} bullish.`;
    } else {
      summary += 'News: Mixed sentiment.';
    }
    
    return {
      score: combinedScore,
      classification,
      tradingBias, // -1 to 1 (negative = sell bias, positive = buy bias)
      fearGreed: {
        value: fgScore,
        classification: fearGreed.classification || getClassification(fgScore),
        updated: fearGreed.updated
      },
      newsScore: {
        value: newsScore,
        bullish: news.bullishCount || 0,
        bearish: news.bearishCount || 0,
        neutral: news.neutralCount || 0,
        articles: news.totalArticles || 0,
        headlines: news.topHeadlines || []
      },
      summary,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Sentiment analysis error:', error.message);
    return {
      score: 50,
      classification: 'Unknown',
      tradingBias: 0,
      fearGreed: { value: 50, classification: 'Unknown' },
      newsScore: { value: 50 },
      summary: 'Unable to fetch sentiment data - using neutral.',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Export for testing
export { fetchFearGreedIndex, fetchNewsSentiment, getClassification, getTradingBias };
