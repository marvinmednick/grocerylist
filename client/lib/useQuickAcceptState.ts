import { useCallback, useEffect, useRef, useState } from 'react';

type UseQuickAcceptStateOptions = {
  triggerWord: string;
  armingDelayMs: number;
  query: string;
  onAcceptTop: () => void | Promise<void>;
};

type UseQuickAcceptStateResult = {
  isArmed: boolean;
  handleTextChange: (text: string) => string;
  handleSubmitEditing: () => void;
};

export function useQuickAcceptState({
  triggerWord,
  armingDelayMs,
  query,
  onAcceptTop,
}: UseQuickAcceptStateOptions): UseQuickAcceptStateResult {
  const [isArmed, setIsArmedState] = useState(false);
  const isArmedRef = useRef(false);
  const queryRef = useRef(query);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  const setArmed = useCallback((next: boolean) => {
    isArmedRef.current = next;
    setIsArmedState(next);
  }, []);

  const clearTimer = useCallback(() => {
    if (!timerRef.current) {
      return;
    }

    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const handleTextChange = useCallback(
    (text: string) => {
      clearTimer();

      const normalizedTrigger = triggerWord.toLowerCase().trim();
      const lastToken =
        text
          .trim()
          .split(/\s+/)
          .filter((token) => token.length > 0)
          .pop()
          ?.toLowerCase() ?? '';

      if (isArmedRef.current && normalizedTrigger.length > 0 && lastToken === normalizedTrigger) {
        void onAcceptTop();
        setArmed(false);
        queryRef.current = '';
        return '';
      }

      setArmed(false);

      if (text.trim().length > 0) {
        timerRef.current = setTimeout(() => {
          setArmed(true);
        }, armingDelayMs);
      }

      queryRef.current = text;
      return text;
    },
    [armingDelayMs, clearTimer, setArmed, onAcceptTop, triggerWord]
  );

  const handleSubmitEditing = useCallback(() => {
    if (queryRef.current.trim().length === 0) {
      return;
    }

    void onAcceptTop();
  }, [onAcceptTop]);

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  return {
    isArmed,
    handleTextChange,
    handleSubmitEditing,
  };
}
