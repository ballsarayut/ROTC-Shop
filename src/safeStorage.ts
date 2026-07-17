export const safeSetItem = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (error: any) {
    console.error(`Failed to save to localStorage for key: ${key}. Quota exceeded?`, error);
    if (error.name === 'QuotaExceededError' || error.message.includes('quota') || error.message.includes('Quota')) {
        // Try clearing some large caches to make room
        try {
            localStorage.removeItem('admin_orders_cache');
            localStorage.removeItem('admin_products_cache');
            localStorage.setItem(key, value); // try again
        } catch(innerE) {
            console.error("Still failed after clearing caches", innerE);
        }
    }
  }
};
