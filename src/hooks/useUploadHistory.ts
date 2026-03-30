import { useCallback, useEffect } from "react";
import { CUSTOM_EVENTS, STORAGE_KEYS } from "@/lib/constants";
import { handleError } from "@/lib/errorHandler";
import type { UploadRecord } from "@/types";
import { useLocalStorage } from "./useLocalStorage";

/**
 * Custom hook for managing upload history with localStorage
 * Automatically syncs across components via custom events
 * @param slug - Event slug to scope the history to
 * @returns Object with history array and methods to manage it
 */
export function useUploadHistory(slug: string) {
  const [history, setHistory] = useLocalStorage<UploadRecord[]>(
    STORAGE_KEYS.UPLOADS(slug),
    [],
  );

  /**
   * Add new upload records to the beginning of history (newest first)
   */
  const addRecords = useCallback(
    (newRecords: UploadRecord[]) => {
      setHistory((prev) => [...newRecords, ...prev]);

      // Notify other components about the update
      window.dispatchEvent(
        new CustomEvent(CUSTOM_EVENTS.UPLOAD_COMPLETE, {
          detail: { slug },
        }),
      );
    },
    [setHistory, slug],
  );

  /**
   * Remove a record by driveId
   */
  const removeRecord = useCallback(
    (driveId: string) => {
      setHistory((prev) => prev.filter((r) => r.driveId !== driveId));
    },
    [setHistory],
  );

  /**
   * Clear all history for this event
   */
  const clearHistory = useCallback(() => {
    setHistory([]);
  }, [setHistory]);

  /**
   * Reload history from localStorage (useful after external updates)
   */
  const reloadHistory = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.UPLOADS(slug));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setHistory(parsed);
        }
      }
    } catch (error) {
      handleError(error, "useUploadHistory:reload");
    }
  }, [slug, setHistory]);

  /**
   * Listen for upload complete events from other components
   */
  useEffect(() => {
    const handleUploadComplete = (event: Event) => {
      const customEvent = event as CustomEvent<{ slug: string }>;
      if (customEvent.detail.slug === slug) {
        reloadHistory();
      }
    };

    window.addEventListener(
      CUSTOM_EVENTS.UPLOAD_COMPLETE,
      handleUploadComplete,
    );

    return () => {
      window.removeEventListener(
        CUSTOM_EVENTS.UPLOAD_COMPLETE,
        handleUploadComplete,
      );
    };
  }, [slug, reloadHistory]);

  return {
    history,
    addRecords,
    removeRecord,
    clearHistory,
    reloadHistory,
  };
}
