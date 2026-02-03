
export class HourOptimizer {
  /**
   * Analyze trades to calculate win rates per hour
   * @param {Array} trades - List of completed trades
   * @returns {Object} - Analysis result { hour: { trades: N, wins: N, winRate: % } }
   */
  analyzeTradesByHour(trades) {
    const analysis = {};

    // Initialize all 24 hours
    for (let i = 0; i < 24; i++) {
      analysis[i] = { trades: 0, wins: 0, winRate: 0 };
    }

    // Process trades
    for (const trade of trades) {
      if (!trade.closeTime) continue;
      
      const date = new Date(trade.closeTime); // Use close time for analysis
      const hour = date.getUTCHours();
      
      analysis[hour].trades++;
      if (trade.profit > 0) {
        analysis[hour].wins++;
      }
    }

    // Calculate win rates
    for (let i = 0; i < 24; i++) {
      const data = analysis[i];
      if (data.trades > 0) {
        data.winRate = parseFloat(((data.wins / data.trades) * 100).toFixed(2));
      }
    }

    return analysis;
  }

  /**
   * Identify hours with poor performance
   * @param {Array} trades - List of trades
   * @param {number} minTrades - Minimum trades required to make a decision
   * @param {number} maxWinRate - Win rate threshold (below this is bad)
   * @returns {Array} - List of bad hours [0, 1, 5...]
   */
  getBadHours(trades, minTrades = 3, maxWinRate = 40) {
    const analysis = this.analyzeTradesByHour(trades);
    const badHours = [];

    for (let i = 0; i < 24; i++) {
      const data = analysis[i];
      if (data.trades >= minTrades && data.winRate < maxWinRate) {
        badHours.push(i);
      }
    }

    return badHours;
  }

  /**
   * Identify hours with good performance
   * @param {Array} trades - List of trades
   * @param {number} minTrades - Minimum trades required
   * @param {number} minWinRate - Win rate threshold (above this is good)
   * @returns {Array} - List of good hours
   */
  getGoodHours(trades, minTrades = 3, minWinRate = 60) {
    const analysis = this.analyzeTradesByHour(trades);
    const goodHours = [];

    for (let i = 0; i < 24; i++) {
      const data = analysis[i];
      if (data.trades >= minTrades && data.winRate > minWinRate) {
        goodHours.push(i);
      }
    }

    return goodHours;
  }
}
