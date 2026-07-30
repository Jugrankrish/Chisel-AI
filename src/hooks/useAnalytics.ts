import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Mock analytics hook to track page views and interactions.
 * In a real application, this would integrate with a service like Google Analytics, Mixpanel, etc.
 */
export function useAnalytics() {
  const location = useLocation();

  useEffect(() => {
    // Track page view on route change
    console.log(`[Analytics] Page View: ${location.pathname}`);
    
    // Example implementation for a real service:
    // window.dataLayer.push({ event: 'page_view', page_path: location.pathname });
  }, [location]);

  const trackEvent = (eventName: string, eventData?: Record<string, any>) => {
    console.log(`[Analytics] Event: ${eventName}`, eventData || {});
  };

  return { trackEvent };
}
