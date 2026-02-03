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
}
