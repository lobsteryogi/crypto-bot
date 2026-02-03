import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * ตรวจสอบว่าควรเทรดในสถานการณ์ปัจจุบันหรือไม่
 * โดยดูจาก loss patterns ที่เคยขาดทุนมา
 */
export function shouldTrade(marketConditions) {
    try {
        const patternsPath = path.join(__dirname, '../data/loss-patterns.json');
        if (!fs.existsSync(patternsPath)) {
            return { allowed: true, reason: 'No loss patterns data yet' };
        }
        
        const patterns = JSON.parse(fs.readFileSync(patternsPath, 'utf8'));
        const { byTrend, byVolatility, bySide, byRSI } = patterns.patterns;
        
        const warnings = [];
        
        // ตรวจสอบ trend
        const trend = marketConditions.trend || 'sideways';
        if (byTrend && byTrend[trend]) {
            const avgLoss = byTrend[trend].count > 0 ? byTrend[trend].totalLoss / byTrend[trend].count : 0;
            if (byTrend[trend].count >= 5 && avgLoss > 6) {
                warnings.push(`High loss rate in ${trend} trend (avg ${avgLoss.toFixed(2)} USDT)`);
            }
        }
        
        // ตรวจสอบ volatility
        const volatility = marketConditions.volatility || 'normal';
        if (byVolatility && byVolatility[volatility]) {
            const avgLoss = byVolatility[volatility].count > 0 ? byVolatility[volatility].totalLoss / byVolatility[volatility].count : 0;
            if (byVolatility[volatility].count >= 5 && avgLoss > 6) {
                warnings.push(`High loss rate in ${volatility} volatility (avg ${avgLoss.toFixed(2)} USDT)`);
            }
        }
        
        // ตรวจสอบ side
        const side = (marketConditions.side || 'LONG').toUpperCase();
        if (bySide && bySide[side]) {
            const avgLoss = bySide[side].count > 0 ? bySide[side].totalLoss / bySide[side].count : 0;
            // เปรียบเทียบกับอีก side
            const otherSide = side === 'LONG' ? 'SHORT' : 'LONG';
            const otherAvgLoss = bySide[otherSide] && bySide[otherSide].count > 0 
                ? bySide[otherSide].totalLoss / bySide[otherSide].count 
                : 0;
            
            if (avgLoss > otherAvgLoss + 3 && bySide[side].count >= 3) {
                warnings.push(`${side} trades have higher loss rate (${avgLoss.toFixed(2)} vs ${otherAvgLoss.toFixed(2)} USDT)`);
            }
        }
        
        // ตรวจสอบ RSI range
        const rsi = marketConditions.rsi;
        if (rsi !== undefined && byRSI) {
            let rsiRange;
            if (rsi < 30) rsiRange = 'oversold';
            else if (rsi > 70) rsiRange = 'overbought';
            else rsiRange = 'normal';
            
            if (byRSI[rsiRange]) {
                const avgLoss = byRSI[rsiRange].count > 0 ? byRSI[rsiRange].totalLoss / byRSI[rsiRange].count : 0;
                if (byRSI[rsiRange].count >= 3 && avgLoss > 6) {
                    warnings.push(`High loss in ${rsiRange} RSI range (avg ${avgLoss.toFixed(2)} USDT)`);
                }
            }
        }
        
        // ถ้ามีหลาย warning ให้ block
        if (warnings.length >= 2) {
            return {
                allowed: false,
                reason: `Multiple risk factors: ${warnings.join('; ')}`,
                warnings
            };
        }
        
        if (warnings.length === 1) {
            return {
                allowed: true,
                reason: 'Moderate risk',
                warnings
            };
        }
        
        return {
            allowed: true,
            reason: 'No significant risk patterns detected'
        };
        
    } catch (error) {
        console.warn('⚠️ Risk assessment failed:', error.message);
        return { allowed: true, reason: 'Risk check failed, allowing trade' };
    }
}

/**
 * ดึงข้อมูล pattern เพื่อ log
 */
export function getLossPatternSummary() {
    try {
        const patternsPath = path.join(__dirname, '../data/loss-patterns.json');
        if (!fs.existsSync(patternsPath)) {
            return null;
        }
        
        const patterns = JSON.parse(fs.readFileSync(patternsPath, 'utf8'));
        return {
            totalLosses: patterns.totalLosses,
            avgLoss: patterns.avgLoss,
            timestamp: patterns.timestamp
        };
    } catch {
        return null;
    }
}
