// Dynamic position sizing based on win rate and other metrics
// Higher win rate = larger position, lower win rate = smaller position

export class PositionSizer {
  /**
   * Calculate dynamic position size multiplier based on performance
   * @param {object} stats - Trading stats from PaperTrader.getStats()
   * @param {object} config - Sizing config
   * @returns {object} - { multiplier, reason }
   */
  static calculate(stats, config = {}) {
    const {
      minMultiplier = 0.25,      // Minimum size (25% of base)
      maxMultiplier = 2.0,       // Maximum size (200% of base)
      baseWinRate = 50,          // Win rate for 1x multiplier
      minTrades = 10,            // Minimum trades before adjusting
      winRateWeight = 0.7,       // How much win rate affects sizing
      streakWeight = 0.3,        // How much current streak affects sizing
    } = config;

    const winRate = parseFloat(stats.winRate) || 0;
    const totalTrades = stats.totalTrades || 0;

    // Not enough data - use base size
    if (totalTrades < minTrades) {
      return {
        multiplier: 1.0,
        reason: `Insufficient data (${totalTrades}/${minTrades} trades)`,
        confidence: 'low'
      };
    }

    // Calculate win rate factor (-1 to +1 range)
    // 0% win rate = -1, 50% = 0, 100% = +1
    const winRateFactor = (winRate - baseWinRate) / 50;

    // Get streak factor from recent trades
    const streakFactor = this.getStreakFactor(stats);

    // Combined factor (weighted average)
    const combinedFactor = (winRateFactor * winRateWeight) + (streakFactor * streakWeight);

    // Convert to multiplier (0 factor = 1x, -1 = minMultiplier, +1 = maxMultiplier)
    let multiplier;
    if (combinedFactor >= 0) {
      multiplier = 1 + (combinedFactor * (maxMultiplier - 1));
    } else {
      multiplier = 1 + (combinedFactor * (1 - minMultiplier));
    }

    // Clamp to bounds
    multiplier = Math.max(minMultiplier, Math.min(maxMultiplier, multiplier));

    // Round to 2 decimal places
    multiplier = Math.round(multiplier * 100) / 100;

    return {
      multiplier,
      reason: this.buildReason(winRate, totalTrades, streakFactor, multiplier),
      confidence: totalTrades >= 30 ? 'high' : 'medium',
      factors: {
        winRate,
        winRateFactor: Math.round(winRateFactor * 100) / 100,
        streakFactor: Math.round(streakFactor * 100) / 100,
        combinedFactor: Math.round(combinedFactor * 100) / 100
      }
    };
  }

  /**
   * Get streak factor based on recent wins/losses
   * @param {object} stats 
   * @returns {number} -1 to +1
   */
  static getStreakFactor(stats) {
    // Simple approximation: if winning more than losing recently
    const wins = stats.wins || 0;
    const losses = stats.losses || 0;
    const total = wins + losses;
    
    if (total === 0) return 0;
    
    // Recent performance bias
    // Could be improved by tracking actual streak in paper-trader
    const recentWinRate = wins / total;
    return (recentWinRate - 0.5) * 2; // Convert 0-1 to -1 to +1
  }

  /**
   * Build human-readable reason
   */
  static buildReason(winRate, trades, streakFactor, multiplier) {
    const sizeDesc = multiplier > 1.2 ? 'Increased' : 
                     multiplier < 0.8 ? 'Reduced' : 'Normal';
    const streakDesc = streakFactor > 0.2 ? 'hot streak' :
                       streakFactor < -0.2 ? 'cold streak' : 'neutral';
    
    return `${sizeDesc} size (${multiplier}x): ${winRate}% win rate over ${trades} trades, ${streakDesc}`;
  }

  /**
   * Calculate actual position size in USDT
   * @param {number} baseAmount - Base trade amount from config
   * @param {object} stats - Trading stats
   * @param {object} config - Sizing config
   * @returns {object} - { amount, multiplier, reason }
   */
  static getPositionSize(baseAmount, stats, config = {}) {
    const sizing = this.calculate(stats, config);
    return {
      amount: Math.round(baseAmount * sizing.multiplier * 100) / 100,
      ...sizing
    };
  }
}

export default PositionSizer;
