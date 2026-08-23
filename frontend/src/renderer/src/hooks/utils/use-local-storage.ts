import { useState } from 'react';

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options?: {
    filter?: (value: T) => T
  },
) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item === null) return initialValue;

      // Try to parse as JSON first
      try {
        const parsedValue = JSON.parse(item);
        return parsedValue;
      } catch {
        // If JSON.parse fails, return the raw string value
        // This handles cases where simple strings were stored directly
        return item as unknown as T;
      }
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      const filteredValue = options?.filter ? options.filter(valueToStore) : valueToStore;
      setStoredValue(valueToStore);

      // Always store as JSON string for consistency
      window.localStorage.setItem(key, JSON.stringify(filteredValue));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue] as const;
}
