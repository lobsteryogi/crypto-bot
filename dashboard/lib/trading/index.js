// Trading module index - exports all trading functionality
export { config } from './config.js';
export { TradeDB } from './db.js';
export { Indicators } from './indicators.js';
export { Strategies } from './strategies.js';
export { PaperTrader } from './paper-trader.js';
export { VolatilityAdjuster } from './volatility-adjuster.js';
export { PositionSizer } from './position-sizer.js';
export { MartingaleSizer } from './martingale-sizer.js';
export { isTradeableHour, isWeekend } from './time-filter.js';
export { getSentiment } from './sentiment.js';
export { checkSentimentAlerts, getSentimentHistory } from './sentiment-monitor.js';
export { getBtcMomentum, shouldTradeBasedOnBtc } from './btc-correlation.js';
export { shouldTrade, getLossPatternSummary } from './risk-filter.js';

// Main trading loop controls
export {
  startTrading,
  stopTrading,
  getTradingStatus,
  getTrader,
  shutdown,
} from './trader.js';
