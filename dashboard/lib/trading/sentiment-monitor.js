// Sentiment Monitoring & Alert System
// Tracks sentiment changes and alerts on extreme shifts

import { getSentiment } from './sentiment.js';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const DATA_DIR = '/root/.openclaw/workspace/crypto-bot/data';
const HISTORY_FILE = path.join(DATA_DIR, 'sentiment-history.json');
const MAX_HISTORY = 100; // Keep last 100 data points

// Alert thresholds
const ALERTS = {
  EXTREME_SHIFT: 30,      // Alert if score changes > 30 points in 1 hour
  EXTREME_FEAR: 15,       // Alert if score drops below 15
  EXTREME_GREED: 85,      // Alert if score rises above 85
  RAPID_DECLINE: 20,      // Alert if score drops > 20 in 30 min
  RAPID_SURGE: 20         // Alert if score rises > 20 in 30 min
};

/**
 * Load sentiment history from file
 */
async function loadHistory() {
  try {
    if (!existsSync(HISTORY_FILE)) {
      return [];
    }
    const data = await fs.readFile(HISTORY_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading sentiment history:', error.message);
    return [];
  }
}

/**
 * Save sentiment history to file
 */
async function saveHistory(history) {
  try {
    // Ensure data directory exists
    const dir = path.dirname(HISTORY_FILE);
    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }
    
    // Keep only last MAX_HISTORY entries
    const trimmed = history.slice(-MAX_HISTORY);
    await fs.writeFile(HISTORY_FILE, JSON.stringify(trimmed, null, 2));
  } catch (error) {
    console.error('Error saving sentiment history:', error.message);
  }
}

/**
 * Add new sentiment data point to history
 */
async function recordSentiment(sentimentData) {
  const history = await loadHistory();
  
  const record = {
    timestamp: Date.now(),
    score: sentimentData.score,
    classification: sentimentData.classification,
    fearGreedValue: sentimentData.fearGreed.value,
    newsScore: sentimentData.newsScore.value
  };
  
  history.push(record);
  await saveHistory(history);
  
  return history;
}

/**
 * Detect extreme sentiment shifts
 * Returns array of alerts if any thresholds are breached
 */
function detectShifts(history, currentScore) {
  const alerts = [];
  
  if (history.length === 0) {
    return alerts;
  }
  
  const now = Date.now();
  const lastHour = history.filter(h => now - h.timestamp < 60 * 60 * 1000);
  const last30Min = history.filter(h => now - h.timestamp < 30 * 60 * 1000);
  
  // Check extreme levels
  if (currentScore <= ALERTS.EXTREME_FEAR) {
    alerts.push({
      type: 'EXTREME_FEAR',
      severity: 'HIGH',
      message: `⚠️ EXTREME FEAR detected (score: ${currentScore}). Market panic - potential contrarian buy opportunity.`,
      action: 'Consider pausing shorts, favoring longs if technicals align.'
    });
  }
  
  if (currentScore >= ALERTS.EXTREME_GREED) {
    alerts.push({
      type: 'EXTREME_GREED',
      severity: 'HIGH',
      message: `⚠️ EXTREME GREED detected (score: ${currentScore}). Market euphoria - reversal risk high.`,
      action: 'Consider pausing longs, tightening stop-losses, favoring shorts.'
    });
  }
  
  // Check 1-hour shift
  if (lastHour.length > 0) {
    const hourAgo = lastHour[0];
    const hourShift = currentScore - hourAgo.score;
    
    if (Math.abs(hourShift) >= ALERTS.EXTREME_SHIFT) {
      alerts.push({
        type: 'EXTREME_SHIFT',
        severity: 'MEDIUM',
        message: `📊 LARGE SENTIMENT SHIFT: ${hourShift > 0 ? '+' : ''}${hourShift} points in 1 hour (${hourAgo.score} → ${currentScore})`,
        action: 'Major market shift detected. Review positions and wait for stability.'
      });
    }
  }
  
  // Check 30-min rapid change
  if (last30Min.length > 0) {
    const thirtyMinAgo = last30Min[0];
    const rapidShift = currentScore - thirtyMinAgo.score;
    
    if (rapidShift <= -ALERTS.RAPID_DECLINE) {
      alerts.push({
        type: 'RAPID_DECLINE',
        severity: 'HIGH',
        message: `📉 RAPID SENTIMENT DECLINE: ${rapidShift} points in 30 min. Fear spreading fast.`,
        action: 'Possible panic selling or FUD event. Pause trading until situation clarifies.'
      });
    }
    
    if (rapidShift >= ALERTS.RAPID_SURGE) {
      alerts.push({
        type: 'RAPID_SURGE',
        severity: 'MEDIUM',
        message: `📈 RAPID SENTIMENT SURGE: +${rapidShift} points in 30 min. FOMO building.`,
        action: 'Possible pump or major positive news. Exercise caution on chasing entries.'
      });
    }
  }
  
  return alerts;
}

/**
 * Check if trading should be paused based on sentiment alerts
 */
function shouldPauseTrading(alerts) {
  // Pause trading if HIGH severity alert exists
  const highSeverity = alerts.filter(a => a.severity === 'HIGH');
  
  if (highSeverity.length > 0) {
    return {
      pause: true,
      reason: highSeverity.map(a => a.type).join(', '),
      duration: 60, // minutes
      message: `Trading paused due to: ${highSeverity.map(a => a.message).join(' | ')}`
    };
  }
  
  return { pause: false };
}

/**
 * Main monitoring function
 * Call this periodically (e.g., every 15 minutes)
 */
export async function checkSentimentAlerts(symbol = 'BTC/USDT') {
  try {
    // Fetch current sentiment
    const sentiment = await getSentiment(symbol);
    
    // Record it
    const history = await recordSentiment(sentiment);
    
    // Detect shifts
    const alerts = detectShifts(history, sentiment.score);
    
    // Check if should pause trading
    const pauseDecision = shouldPauseTrading(alerts);
    
    return {
      sentiment,
      alerts,
      pauseDecision,
      history: {
        total: history.length,
        latest: history.slice(-5) // Last 5 data points
      }
    };
  } catch (error) {
    console.error('Sentiment monitoring error:', error.message);
    return {
      error: error.message,
      sentiment: null,
      alerts: [],
      pauseDecision: { pause: false }
    };
  }
}

/**
 * Get sentiment history for analysis
 */
export async function getSentimentHistory(hours = 24) {
  const history = await loadHistory();
  const cutoff = Date.now() - (hours * 60 * 60 * 1000);
  return history.filter(h => h.timestamp >= cutoff);
}

/**
 * Clear old history (utility function)
 */
export async function clearOldHistory(daysToKeep = 7) {
  const history = await loadHistory();
  const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
  const filtered = history.filter(h => h.timestamp >= cutoff);
  await saveHistory(filtered);
  return { removed: history.length - filtered.length, kept: filtered.length };
}
