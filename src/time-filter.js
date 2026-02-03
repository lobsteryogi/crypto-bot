export function isTradeableHour(date = new Date(), config, explicitBlockedHours = null) {
    if (config && config.timeFilter && !config.timeFilter.enabled) {
        return true;
    }

    const hour = date.getUTCHours();
    
    // Use explicit list if provided, otherwise fall back to config
    const blockedHours = explicitBlockedHours || 
                        ((config && config.timeFilter && config.timeFilter.blockedHours) || [21, 22, 23, 0]);
    
    return !blockedHours.includes(hour);
}

export function isWeekend(date = new Date(), config) {
    if (config && config.timeFilter && !config.timeFilter.avoidWeekends) {
        return false; // Don't block weekends if feature disabled
    }

    const day = date.getUTCDay();
    return day === 0 || day === 6; // Sunday or Saturday
}
