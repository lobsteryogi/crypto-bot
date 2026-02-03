/**
 * SOL-Specific Sentiment Analyzer
 * Uses alternative.me Fear & Greed + SOL news sentiment from cfgi.io
 * @module SOL-Sentiment
 */
import fetch from 'node-fetch';

const FEAR_GREED_API = 'https://api.alternative.me/fng/';
const CFGI_URL = 'https://cfgi.io/solana-fear-greed-index/';

/**
 * Parse sentiment from multiple sources
 * @returns {Promise<Object>} Sentiment data
 */
export async function getSolSentiment() {
  try {
    // Get general crypto Fear & Greed
    let cryptoScore = 50;
    let cryptoLevel = 'Neutral';
    
    try {
      const fngRes = await fetch(FEAR_GREED_API);
      const fngData = await fngRes.json();
      if (fngData.data && fngData.data[0]) {
        cryptoScore = parseInt(fngData.data[0].value);
        cryptoLevel = fngData.data[0].value_classification;
      }
    } catch (e) {
      console.warn('⚠️  Failed to fetch Fear & Greed Index');
    }

    // Get SOL-specific news sentiment from cfgi.io
    let positive = 0, negative = 0, neutral = 0;
    
    try {
      const response = await fetch(CFGI_URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      const html = await response.text();
      
      // Count sentiment labels in news (more flexible pattern)
      const positiveMatches = (html.match(/Positive<\/span>/gi) || []).length;
      const negativeMatches = (html.match(/Negative<\/span>/gi) || []).length;
      const neutralMatches = (html.match(/Neutral<\/span>/gi) || []).length;
      
      positive = positiveMatches;
      negative = negativeMatches;
      neutral = neutralMatches;
    } catch (e) {
      console.warn('⚠️  Failed to fetch SOL news sentiment');
    }

    const totalNews = positive + negative + neutral;
    
    // Calculate SOL news score (0-100)
    const newsScore = totalNews > 0 
      ? Math.round(((positive - negative) / totalNews * 100) + 50)
      : 50;

    // Combined score (60% crypto-wide FnG, 40% SOL news)
    const combinedScore = Math.round((cryptoScore * 0.6) + (newsScore * 0.4));

    return {
      score: combinedScore,
      cryptoScore,
      cryptoLevel,
      newsScore,
      newsBreakdown: {
        positive,
        negative,
        neutral,
        total: totalNews
      },
      timestamp: new Date().toISOString(),
      sources: ['alternative.me', 'cfgi.io']
    };
  } catch (error) {
    console.error('❌ Failed to fetch SOL sentiment:', error.message);
    return {
      score: 50,
      cryptoScore: 50,
      cryptoLevel: 'Neutral',
      newsScore: 50,
      newsBreakdown: { positive: 0, negative: 0, neutral: 0, total: 0 },
      timestamp: new Date().toISOString(),
      sources: [],
      error: error.message
    };
  }
}

/**
 * Get simple sentiment direction for trading
 * @returns {Promise<string>} 'bullish' | 'bearish' | 'neutral'
 */
export async function getSolSentimentDirection() {
  const sentiment = await getSolSentiment();
  
  if (sentiment.score > 60) return 'bullish';
  if (sentiment.score < 40) return 'bearish';
  return 'neutral';
}

// CLI test
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🔍 Fetching SOL sentiment...\n');
  const sentiment = await getSolSentiment();
  console.log(JSON.stringify(sentiment, null, 2));
  
  const direction = await getSolSentimentDirection();
  console.log(`\n📊 Trading Direction: ${direction.toUpperCase()}`);
  console.log(`   Crypto FnG: ${sentiment.cryptoScore}/100 (${sentiment.cryptoLevel})`);
  console.log(`   SOL News: ${sentiment.newsScore}/100 (${sentiment.newsBreakdown.positive}+ ${sentiment.newsBreakdown.negative}- ${sentiment.newsBreakdown.neutral}=)`);
  console.log(`   Combined: ${sentiment.score}/100`);
}


