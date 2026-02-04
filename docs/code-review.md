# Code Review: Crypto-Bot
**Date:** 2026-02-04
**Reviewer:** Antigravity (AI Assistant)

## 1. Core Logic & Bugs

### ⚠️ Critical: Race Condition in `runTradingCycle`
In `trader.js`, the code executes:
1. `pm.checkExistingPositions(...)` (closes hit SL/TP)
2. `engine.analyze(...)`
3. `handleReversals(...)` (closes positions on signal flip)
4. `executeEntry(...)` (opens new position)

**Issue:** If a position is closed by SL/TP in step 2, but the signal in step 4 is still valid, the bot might immediately re-enter the same trade that just hit its stop loss, leading to "death by a thousand cuts" in a choppy market.

### ⚠️ Logical Error: Leverage vs Amount Calculation
In `trader.js` function `executeEntry`:
```javascript
const effectiveAmount = (order.amount * leverage) / price;
if (analysis.signal === 'buy') {
  trader.buy(symbol, price, effectiveAmount, analysis.reason, leverage);
}
```
In `paper-trader-sqlite.js`:
```javascript
buy(symbol, price, amount, reason, leverage = 1, ...) {
  const margin = (amount * price) / leverage;
  // ...
  const newBalance = this.balance - margin;
}
```
**Issue:** `effectiveAmount` already includes leverage (`order.amount * leverage / price`). When passed to `trader.buy`, it calculates `margin` by dividing by leverage again.
*   Example: `order.amount` = 100, `leverage` = 10, `price` = 1.
*   `effectiveAmount` = (100 * 10) / 1 = 1000.
*   `margin` = (1000 * 1) / 10 = 100. (This works, but is redundant and confusing).
*   **Actual Risk:** If `leverage` in `trader.buy` defaults to 1 (it does), the margin deducted will be the full position size (1000), likely causing "Insufficient balance" errors or over-exposure if balance is high.

### ⚠️ Direction Switch Logic
The `handleReversals` function closes opposite positions. However, it doesn't account for whether the position being closed was in profit or loss. If the strategy is "noisy", it will constantly flip positions, rack up fees, and realize losses prematurely.

---

## 2. Risk Management (SL/TP)

### 🔴 SL/TP Calculation Bug
In `trader.js`:
```javascript
const adj = engine.getVolatilityAdjustments(candles);
const closed = pm.checkExistingPositions(symbol, currentPrice, adj.sl, adj.tp);
```
In `paper-trader-sqlite.js`:
```javascript
checkPositions(symbol, currentPrice, highPrice = null, lowPrice = null) {
  // ...
  if (pos.stop_loss) {
    const slHit = isLong ? (lowPrice || currentPrice) <= pos.stop_loss : ...
  }
}
```
**Issue:** `pm.checkExistingPositions` passes `adj.sl` (a percentage, e.g., 2.5) as the 3rd argument. But `paper-trader.js` expects the 3rd argument to be `highPrice` for the candle.
*   The bot is checking if `currentPrice <= 2.5` (if 2.5 is passed as `highPrice`) or using the wrong variables for SL/TP logic.
*   **Result:** Stop losses and Take profits are likely **never triggering** correctly via the orchestrator, or triggering based on completely wrong price data.

---

## 3. Volatility Multiplier Logic

### ✅ Strengths
*   Uses ATR vs Average ATR to scale SL/TP. This is a sound professional approach.
*   Leverage reduction during high volatility is implemented in `VolatilityAdjuster.adjustedLeverage`.

### ❌ Weaknesses
*   **Symmetry:** SL and TP are adjusted by the same multiplier. In high volatility, both widen. While this keeps the Risk/Reward ratio the same, it increases the "time in trade," which might be dangerous in crypto.
*   **Hardcoded Limits:** `minSlPercent` (0.5%) and `maxSlPercent` (3.0%) are very tight for assets like SOL or AVAX, which can move 1% in a single 1m candle. The bot might be getting stopped out too early by the "clamps" rather than the volatility logic.

---

## 4. Recommendations

1.  **Fix Argument Mapping:** Correct `pm.checkExistingPositions` to pass the correct candle data to the trader, or update the trader to handle percentage-based checks.
2.  **Fix Margin Calculation:** Ensure `leverage` is handled consistently between `trader.js` and `PaperTrader`.
3.  **Add Cooling Period:** After a SL is hit, implement a `cooldown` for that symbol (e.g., 5-10 minutes) to prevent immediate re-entry.
4.  **Reduce LONG Exposure:** The code already has a 30% leverage reduction for LONGs (learned from loss patterns). This is good, keep it.
5.  **Audit `risk-filter.js`:** The hard block on "Short in Sideways" is excellent. Ensure the trend detection in `multi_timeframe` strategy is accurate enough to support this.

---
**Status:** Review Complete. Issues identified in SL/TP execution and Margin logic are high priority.
