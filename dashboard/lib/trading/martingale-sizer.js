export class MartingaleSizer {
  constructor(config = {}) {
    this.mode = config.mode || 'off'; // 'martingale' | 'anti-martingale' | 'off'
    this.baseSize = config.baseSize; // This might be dynamically passed or static
    this.multiplier = config.multiplier; // e.g., 1.5x
    this.maxMultiplier = config.maxMultiplier; // cap at 3x
    this.streakCount = 0;
    this.lastResult = null;
  }

  // Allow setting streak from external state (persistence)
  setStreak(streak) {
    this.streakCount = streak;
  }

  getStreak() {
    return this.streakCount;
  }
  
  recordResult(win) {
    if (this.mode === 'martingale') {
      // Increase after loss
      this.streakCount = win ? 0 : this.streakCount + 1;
    } else if (this.mode === 'anti-martingale') {
      // Increase after win
      this.streakCount = win ? this.streakCount + 1 : 0;
    }
    this.lastResult = win ? 'WIN' : 'LOSS';
    return this.streakCount;
  }
  
  getPositionSize(currentBaseSize) {
    // If sizing is off, return base size (1x multiplier)
    if (this.mode === 'off' || !this.mode) {
      return currentBaseSize;
    }

    const mult = Math.min(
      Math.pow(this.multiplier, this.streakCount),
      this.maxMultiplier
    );
    return {
      size: currentBaseSize * mult,
      multiplier: mult,
      streak: this.streakCount
    };
  }
}
