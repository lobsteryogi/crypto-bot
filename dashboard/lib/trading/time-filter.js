import fs from 'fs';
import path from 'path';

const DATA_DIR = '/root/.openclaw/workspace/crypto-bot/data';

function loadDangerousHours() {
    try {
        const patternsPath = path.join(DATA_DIR, 'loss-patterns.json');
        if (!fs.existsSync(patternsPath)) {
            return [];
        }
        
        const patterns = JSON.parse(fs.readFileSync(patternsPath, 'utf8'));
        const byHour = patterns.patterns?.byHour || {};
        
        // หาชั่วโมงที่มี avg loss > 5 USDT และมีอย่างน้อย 2 trades
        const dangerousHours = Object.entries(byHour)
            .filter(([hour, data]) => {
                const avgLoss = data.count > 0 ? data.totalLoss / data.count : 0;
                return data.count >= 2 && avgLoss > 5;
            })
            .map(([hour]) => parseInt(hour));
        
        return dangerousHours;
    } catch (error) {
        console.warn('⚠️ Could not load loss patterns:', error.message);
        return [];
    }
}

export function isTradeableHour(date = new Date(), config, explicitBlockedHours = null) {
    if (config && config.timeFilter && !config.timeFilter.enabled) {
        return true;
    }

    const hour = date.getUTCHours();
    
    // Combine explicit blocked hours + dangerous hours from loss analysis
    const baseBlockedHours = explicitBlockedHours || 
                            ((config && config.timeFilter && config.timeFilter.blockedHours) || [21, 22, 23, 0]);
    
    const dangerousHours = loadDangerousHours();
    const allBlockedHours = [...new Set([...baseBlockedHours, ...dangerousHours])];
    
    return !allBlockedHours.includes(hour);
}

export function isWeekend(date = new Date(), config) {
    if (config && config.timeFilter && !config.timeFilter.avoidWeekends) {
        return false; // Don't block weekends if feature disabled
    }

    const day = date.getUTCDay();
    return day === 0 || day === 6; // Sunday or Saturday
}
