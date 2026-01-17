
import { useState, useEffect } from 'react';
import { AppSettings } from '../types';

const STORAGE_KEY = 'vinyl_rhythm_settings';

const DEFAULT_SETTINGS: AppSettings = {
  enableAI: false,
  geminiApiKey: '',
  spinSpeed: 15,
  showParticles: true,
  showBlurBackground: true,
  useTraditionalChinese: false,
  showQualityTag: true
};

export const useAppSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (updates: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS);
  };

  return { settings, updateSettings, resetSettings };
};
