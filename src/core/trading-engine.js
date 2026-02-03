// src/core/trading-engine.js
import { log } from '../utils/logger.js';
import { config } from '../config.js';
import { Strategies } from '../strategies.js';
import { MCPService } from '../services/mcp-service.js';
import { VolatilityAdjuster } from '../volatility-adjuster.js';
import { Indicators } from '../utils/indicators.js';

export class TradingEngine {
  constructor(positionManager) {
    this.pm = positionManager;
  }

  async analyze(symbol, candles, multiCandles = null) {
    const currentPrice = candles[candles.length - 1].close;
    const isMultiTF = Strategies.isMultiTimeframe(config.strategy.name);
    
    // 1. Calculate Volatility & Adjust SL/TP
    const volAdjusted = this.getVolatilityAdjustments(candles);
    
    // 2. Get Strategy Signal
    let strategyParams = { ...config.strategy.params };
    // TODO: Add RSI optimization params check here
    
    const signalData = isMultiTF 
      ? Strategies.getStrategy(config.strategy.name)(multiCandles, strategyParams)
      : Strategies.getStrategy(config.strategy.name)(candles, strategyParams);

    // 3. AI Analysis via MCP (Future enhancement)
    // const aiAnalysis = await MCPService.analyzeMarket({ symbol, currentPrice, signal: signalData });
    
    return {
      symbol,
      currentPrice,
      signal: signalData.signal,
      reason: signalData.reason,
      indicators: signalData.indicators,
      adjustments: volAdjusted
    };
  }

  getVolatilityAdjustments(candles) {
    const vaConfig = config.trading.volatilityAdjustment;
    let adjustments = {
      sl: config.trading.stopLossPercent,
      tp: config.trading.takeProfitPercent,
      leverage: config.trading.leverage || 1
    };

    if (vaConfig?.enabled) {
      const atrSeries = Indicators.atr(candles, vaConfig.atrPeriod);
      const currentATR = atrSeries[atrSeries.length - 1];
      
      if (currentATR) {
        const avgPeriod = vaConfig.avgAtrPeriod || 100;
        const history = atrSeries.slice(-avgPeriod).filter(v => v !== null);
        const averageATR = history.reduce((sum, val) => sum + val, 0) / history.length;
        const multiplier = VolatilityAdjuster.calculateMultiplier(currentATR, averageATR);

        adjustments.sl = VolatilityAdjuster.adjustedStopLoss(config.trading.stopLossPercent, multiplier, vaConfig.minSlPercent, vaConfig.maxSlPercent);
        adjustments.tp = VolatilityAdjuster.adjustedTakeProfit(config.trading.takeProfitPercent, multiplier, vaConfig.minTpPercent, vaConfig.maxTpPercent);
        
        // Leverage Adjustment
        const laConfig = config.trading.leverageAdjustment || {};
        adjustments.leverage = VolatilityAdjuster.adjustedLeverage(
          config.trading.leverage || 10, multiplier, laConfig.minLeverage || 3, laConfig.maxLeverage || 20
        );
      }
    }
    return adjustments;
  }
}
