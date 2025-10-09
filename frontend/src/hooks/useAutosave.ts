import { useEffect, useRef, useCallback } from 'react';

interface AutosaveOptions {
  delay?: number; // milliseconds
  enabled?: boolean;
  onSave: (data: any) => Promise<void> | void;
  onError?: (error: Error) => void;
}

export function useAutosave(data: any, options: AutosaveOptions) {
  const { delay = 2000, enabled = true, onSave, onError } = options;
  const timeoutRef = useRef<NodeJS.Timeout>();
  const lastSavedRef = useRef<string>('');
  const isSavingRef = useRef(false);

  const save = useCallback(async () => {
    if (!enabled || isSavingRef.current) return;
    
    const dataString = JSON.stringify(data);
    if (dataString === lastSavedRef.current) return; // No changes

    isSavingRef.current = true;
    try {
      await onSave(data);
      lastSavedRef.current = dataString;
    } catch (error) {
      console.error('Autosave failed:', error);
      onError?.(error as Error);
    } finally {
      isSavingRef.current = false;
    }
  }, [data, enabled, onSave, onError]);

  useEffect(() => {
    if (!enabled) return;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(save, delay);

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, delay, enabled, save]);

  // Manual save function
  const saveNow = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    save();
  }, [save]);

  return { saveNow, isSaving: isSavingRef.current };
}
