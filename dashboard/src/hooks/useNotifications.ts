import { useState, useEffect, useCallback } from 'react';

export interface UseNotificationsReturn {
  permission: NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
  notify: (title: string, options?: NotificationOptions) => void;
  isSupported: boolean;
}

export function useNotifications(): UseNotificationsReturn {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!isSupported) return 'denied' as NotificationPermission;
    
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return 'denied' as NotificationPermission;
    }
  }, [isSupported]);

  const notify = useCallback((title: string, options?: NotificationOptions) => {
    if (!isSupported) return;
    
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, options);
      } catch (e) {
        console.error("Notification error:", e);
      }
    } else if (Notification.permission !== 'denied') {
      // Try requesting permission then notifying
      requestPermission().then(perm => {
        if (perm === 'granted') {
          try {
            new Notification(title, options);
          } catch (e) { console.error(e); }
        }
      });
    }
  }, [isSupported, requestPermission]);

  return { permission, requestPermission, notify, isSupported };
}
