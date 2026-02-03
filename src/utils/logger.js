// src/utils/logger.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logsDir = path.join(__dirname, '../../logs');

export function log(message, type = 'info', symbol = '') {
  const timestamp = new Date().toISOString();
  const logPrefix = symbol ? `[${symbol}] ` : '';
  const logMessage = `[${timestamp}] [${type.toUpperCase()}] ${logPrefix}${message}`;
  
  console.log(logMessage);
  
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  const logFile = path.join(logsDir, `trading_${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(logFile, logMessage + '\n');
}
