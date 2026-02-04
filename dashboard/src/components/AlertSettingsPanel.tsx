"use client";

import { useState, useEffect } from 'react';
import { useNotifications } from '../hooks/useNotifications';

export interface PriceAlert {
  id: string;
  price: number;
  direction: 'above' | 'below';
  enabled: boolean;
}

export interface AlertSettings {
  priceAlerts: PriceAlert[];
  tradeAlerts: boolean;
  winRateAlerts: boolean;
  winRateThreshold: number;
  dailySummary: boolean;
}

export const defaultSettings: AlertSettings = {
  priceAlerts: [],
  tradeAlerts: false,
  winRateAlerts: false,
  winRateThreshold: 50,
  dailySummary: false,
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChange: (settings: AlertSettings) => void;
  currentPrice: number;
}

export function AlertSettingsPanel({ isOpen, onClose, onSettingsChange, currentPrice }: Props) {
  const [settings, setSettings] = useState<AlertSettings>(defaultSettings);
  const { permission, requestPermission, notify, isSupported } = useNotifications();
  const [activeTab, setActiveTab] = useState<'general' | 'price'>('general');
  const [newPrice, setNewPrice] = useState<string>('');

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('cryptoBotAlertSettings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Merge with default to ensure all fields exist
        setSettings({ ...defaultSettings, ...parsed });
        onSettingsChange({ ...defaultSettings, ...parsed });
      } catch (e) {
        console.error("Failed to parse settings", e);
      }
    }
  }, []);

  const saveSettings = (newSettings: AlertSettings) => {
    setSettings(newSettings);
    localStorage.setItem('cryptoBotAlertSettings', JSON.stringify(newSettings));
    onSettingsChange(newSettings);
  };

  const handleToggle = (key: keyof AlertSettings) => {
    saveSettings({ ...settings, [key]: !settings[key] });
  };

  const handleWinRateChange = (val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0 && num <= 100) {
      saveSettings({ ...settings, winRateThreshold: num });
    }
  };

  const addPriceAlert = () => {
    const price = parseFloat(newPrice);
    if (isNaN(price) || price <= 0) return;

    const direction = price > currentPrice ? 'above' : 'below';
    const newAlert: PriceAlert = {
      id: Date.now().toString(),
      price,
      direction,
      enabled: true
    };

    saveSettings({
      ...settings,
      priceAlerts: [...settings.priceAlerts, newAlert]
    });
    setNewPrice('');
  };

  const removePriceAlert = (id: string) => {
    saveSettings({
      ...settings,
      priceAlerts: settings.priceAlerts.filter(a => a.id !== id)
    });
  };

  const handleRequestPermission = async () => {
    const result = await requestPermission();
    if (result === 'granted') {
      notify('Notifications Enabled', { body: 'You will now receive alerts from the Crypto Bot.' });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            🔔 Notification Settings
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        {/* Permission Check */}
        {!isSupported ? (
          <div className="p-4 bg-red-900/20 text-red-200 text-sm border-b border-red-800">
            Browser notifications are not supported on this device.
          </div>
        ) : permission !== 'granted' ? (
          <div className="p-4 bg-yellow-900/20 border-b border-yellow-800 flex justify-between items-center">
            <span className="text-yellow-200 text-sm">Enable browser notifications to receive alerts.</span>
            <button 
              onClick={handleRequestPermission}
              className="px-3 py-1 bg-yellow-600 hover:bg-yellow-500 text-white text-xs rounded font-bold"
            >
              Enable
            </button>
          </div>
        ) : null}

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          <button 
            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'general' ? 'bg-gray-800 text-blue-400 border-b-2 border-blue-400' : 'bg-gray-800/50 text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('general')}
          >
            General Alerts
          </button>
          <button 
            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'price' ? 'bg-gray-800 text-blue-400 border-b-2 border-blue-400' : 'bg-gray-800/50 text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('price')}
          >
            Price Targets
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
          {activeTab === 'general' ? (
            <>
              {/* Trade Alerts */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-medium">Trade Executed</div>
                  <div className="text-gray-400 text-xs">Notify on new buy/sell orders</div>
                </div>
                <button 
                  onClick={() => handleToggle('tradeAlerts')}
                  className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.tradeAlerts ? 'bg-green-500' : 'bg-gray-600'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${settings.tradeAlerts ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Win Rate Alerts */}
              <div className="space-y-3 pt-4 border-t border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">Win Rate Warning</div>
                    <div className="text-gray-400 text-xs">Notify if win rate drops below threshold</div>
                  </div>
                  <button 
                    onClick={() => handleToggle('winRateAlerts')}
                    className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.winRateAlerts ? 'bg-green-500' : 'bg-gray-600'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${settings.winRateAlerts ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
                {settings.winRateAlerts && (
                  <div className="flex items-center gap-3 bg-gray-900/50 p-3 rounded-lg">
                    <span className="text-sm text-gray-300">Threshold:</span>
                    <input 
                      type="number" 
                      value={settings.winRateThreshold}
                      onChange={(e) => handleWinRateChange(e.target.value)}
                      className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                    <span className="text-sm text-gray-300">%</span>
                  </div>
                )}
              </div>

              {/* Daily Summary */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-700">
                <div>
                  <div className="text-white font-medium">Daily Summary</div>
                  <div className="text-gray-400 text-xs">Daily P/L report (Browser)</div>
                </div>
                <button 
                  onClick={() => handleToggle('dailySummary')}
                  className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.dailySummary ? 'bg-green-500' : 'bg-gray-600'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${settings.dailySummary ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Test Button */}
              <div className="pt-6 mt-2 border-t border-gray-700">
                <button 
                  onClick={() => notify('Test Notification', { body: 'This is a test alert from your dashboard.' })}
                  disabled={permission !== 'granted'}
                  className="w-full py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-200 text-sm rounded-lg transition-colors font-medium"
                >
                  Send Test Notification
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input 
                  type="number" 
                  placeholder="Target Price (e.g. 105.50)" 
                  value={newPrice}
                  onChange={(e) => setNewPrice(e.target.value)}
                  className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
                <button 
                  onClick={addPriceAlert}
                  disabled={!newPrice}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm rounded font-medium"
                >
                  Add
                </button>
              </div>
              
              <div className="text-xs text-gray-500">
                Current Price: <span className="text-white font-mono">${currentPrice?.toFixed(2)}</span>
              </div>

              <div className="space-y-2 mt-4 max-h-[250px] overflow-y-auto">
                {settings.priceAlerts.length === 0 ? (
                  <div className="text-center text-gray-500 text-sm py-8 italic">No price alerts set</div>
                ) : (
                  settings.priceAlerts.map(alert => (
                    <div key={alert.id} className="flex items-center justify-between bg-gray-900/50 p-3 rounded-lg border border-gray-700/50">
                      <div>
                        <div className="text-white font-mono font-bold">${alert.price}</div>
                        <div className={`text-xs ${alert.direction === 'above' ? 'text-green-400' : 'text-red-400'}`}>
                          Alert when {alert.direction}
                        </div>
                      </div>
                      <button 
                        onClick={() => removePriceAlert(alert.id)}
                        className="text-gray-500 hover:text-red-400 p-2"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
