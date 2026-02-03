// Test sentiment analysis module
import { getSentiment, fetchFearGreedIndex, fetchNewsSentiment, getClassification, getTradingBias } from './sentiment.js';

async function testSentiment() {
  console.log('🧪 Testing Sentiment Analysis Module\n');
  console.log('='.repeat(60));
  
  // Test 1: Fear & Greed Index
  console.log('\n📊 Test 1: Fear & Greed Index');
  try {
    const fng = await fetchFearGreedIndex();
    console.log('  ✅ Fear & Greed fetched successfully');
    console.log(`     Value: ${fng.value}`);
    console.log(`     Classification: ${fng.classification}`);
    console.log(`     Updated: ${fng.updated || 'N/A'}`);
  } catch (error) {
    console.log(`  ❌ Fear & Greed failed: ${error.message}`);
  }
  
  // Test 2: News Sentiment
  console.log('\n📰 Test 2: News Sentiment (BTC)');
  try {
    const news = await fetchNewsSentiment('BTC/USDT');
    console.log('  ✅ News sentiment fetched successfully');
    console.log(`     Score: ${news.score}`);
    console.log(`     Bullish: ${news.bullishCount}, Bearish: ${news.bearishCount}, Neutral: ${news.neutralCount}`);
    console.log(`     Articles analyzed: ${news.totalArticles}`);
    if (news.topHeadlines && news.topHeadlines.length > 0) {
      console.log('     Top headlines:');
      news.topHeadlines.forEach((h, i) => {
        console.log(`       ${i+1}. [${h.sentiment}] ${h.title.substring(0, 60)}...`);
      });
    }
  } catch (error) {
    console.log(`  ❌ News sentiment failed: ${error.message}`);
  }
  
  // Test 3: News Sentiment for SOL
  console.log('\n📰 Test 3: News Sentiment (SOL)');
  try {
    const news = await fetchNewsSentiment('SOL/USDT');
    console.log('  ✅ SOL news sentiment fetched');
    console.log(`     Score: ${news.score}`);
    console.log(`     Articles: ${news.totalArticles}`);
  } catch (error) {
    console.log(`  ❌ SOL news failed: ${error.message}`);
  }
  
  // Test 4: Full sentiment function
  console.log('\n🧠 Test 4: Full getSentiment() for BTC/USDT');
  try {
    const sentiment = await getSentiment('BTC/USDT');
    console.log('  ✅ Full sentiment analysis completed');
    console.log(`     Combined Score: ${sentiment.score}`);
    console.log(`     Classification: ${sentiment.classification}`);
    console.log(`     Trading Bias: ${sentiment.tradingBias.toFixed(2)} (${sentiment.tradingBias > 0 ? 'bullish' : sentiment.tradingBias < 0 ? 'bearish' : 'neutral'})`);
    console.log(`     Fear & Greed: ${sentiment.fearGreed.value} (${sentiment.fearGreed.classification})`);
    console.log(`     News Score: ${sentiment.newsScore.value}`);
    console.log(`     Summary: ${sentiment.summary}`);
  } catch (error) {
    console.log(`  ❌ Full sentiment failed: ${error.message}`);
  }
  
  // Test 5: Full sentiment function for SOL
  console.log('\n🧠 Test 5: Full getSentiment() for SOL/USDT');
  try {
    const sentiment = await getSentiment('SOL/USDT');
    console.log('  ✅ SOL sentiment analysis completed');
    console.log(`     Combined Score: ${sentiment.score}`);
    console.log(`     Classification: ${sentiment.classification}`);
    console.log(`     Trading Bias: ${sentiment.tradingBias.toFixed(2)}`);
    console.log(`     Summary: ${sentiment.summary}`);
  } catch (error) {
    console.log(`  ❌ SOL sentiment failed: ${error.message}`);
  }
  
  // Test 6: Classification helper
  console.log('\n🏷️ Test 6: Classification helper');
  const testScores = [5, 20, 35, 50, 65, 80, 95];
  testScores.forEach(score => {
    console.log(`     Score ${score}: ${getClassification(score)} (bias: ${getTradingBias(score).toFixed(2)})`);
  });
  
  // Test 7: Cache test (second call should be faster)
  console.log('\n⚡ Test 7: Cache Test');
  const start1 = Date.now();
  await getSentiment('BTC/USDT');
  const time1 = Date.now() - start1;
  
  const start2 = Date.now();
  await getSentiment('BTC/USDT');
  const time2 = Date.now() - start2;
  
  console.log(`     First call: ${time1}ms`);
  console.log(`     Second call (cached): ${time2}ms`);
  console.log(`     Cache working: ${time2 < time1 / 2 ? '✅ Yes' : '⚠️ Maybe (check TTL)'}`);
  
  console.log('\n' + '='.repeat(60));
  console.log('🎉 Sentiment Analysis Tests Complete!\n');
}

testSentiment().catch(console.error);
