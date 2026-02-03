export class VolatilityAdjuster {
  /**
   * Calculate the volatility multiplier based on current vs average ATR
   * @param {number} currentATR - The current ATR value
   * @param {number} averageATR - The historical average ATR value
   * @returns {number} The multiplier (e.g., 1.2 for 20% higher volatility)
   */
  static calculateMultiplier(currentATR, averageATR) {
    if (!averageATR || averageATR === 0) return 1;
    return currentATR / averageATR;
  }

  /**
   * Calculate adjusted Stop Loss percentage
   * @param {number} basePercent - The base SL percentage from config
   * @param {number} multiplier - The volatility multiplier
   * @param {number} min - Minimum allowed SL percentage
   * @param {number} max - Maximum allowed SL percentage
   * @returns {number} Adjusted SL percentage
   */
  static adjustedStopLoss(basePercent, multiplier, min, max) {
    let adjusted = basePercent * multiplier;
    // Ensure we don't go below min or above max
    adjusted = Math.max(min, Math.min(adjusted, max));
    return parseFloat(adjusted.toFixed(2));
  }

  /**
   * Calculate adjusted Take Profit percentage
   * @param {number} basePercent - The base TP percentage from config
   * @param {number} multiplier - The volatility multiplier
   * @param {number} min - Minimum allowed TP percentage
   * @param {number} max - Maximum allowed TP percentage
   * @returns {number} Adjusted TP percentage
   */
  static adjustedTakeProfit(basePercent, multiplier, min, max) {
    let adjusted = basePercent * multiplier;
    // Ensure we don't go below min or above max
    adjusted = Math.max(min, Math.min(adjusted, max));
    return parseFloat(adjusted.toFixed(2));
  }

  /**
   * Calculate adjusted Leverage based on volatility
   * Lower volatility = can use higher leverage safely
   * Higher volatility = reduce leverage to avoid liquidation
   * 
   * @param {number} baseLeverage - The base leverage from config (e.g., 10x)
   * @param {number} multiplier - The volatility multiplier
   * @param {number} min - Minimum allowed leverage
   * @param {number} max - Maximum allowed leverage
   * @param {number} highVolThreshold - Multiplier threshold for "high vol" (e.g., 1.5)
   * @param {number} lowVolThreshold - Multiplier threshold for "low vol" (e.g., 0.8)
   * @returns {number} Adjusted leverage
   */
  static adjustedLeverage(
    baseLeverage,
    multiplier,
    min = 3,
    max = 20,
    highVolThreshold = 1.5,
    lowVolThreshold = 0.8
  ) {
    let adjusted = baseLeverage;

    if (multiplier >= highVolThreshold) {
      // High volatility: reduce leverage significantly
      // e.g., 10x -> 5x when vol is 1.5x+
      adjusted = baseLeverage / 2;
    } else if (multiplier <= lowVolThreshold) {
      // Low volatility: can increase leverage safely
      // e.g., 10x -> 15x when vol is <0.8x
      adjusted = baseLeverage * 1.5;
    }
    // Normal volatility (0.8 - 1.5): keep base leverage

    // Clamp to min/max
    adjusted = Math.max(min, Math.min(adjusted, max));
    return Math.round(adjusted); // Leverage should be integer
  }
}
