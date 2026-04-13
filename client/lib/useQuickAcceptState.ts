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
  const prevTextRef = useRef(query);
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

  const debugLog = useCallback((event: string, details: Record<string, unknown>) => {
    if (!__DEV__) {
      return;
    }
    console.log(`[QuickAccept] ${event} ${JSON.stringify(details)}`);
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
      const isArmedBefore = isArmedRef.current;
      const matchedTrigger = normalizedTrigger.length > 0 && lastToken === normalizedTrigger;
      const isPrefixOfTrigger =
        normalizedTrigger.length > 0 &&
        lastToken.length > 0 &&
        normalizedTrigger.startsWith(lastToken);

      debugLog('text_change', {
        prevText: prevTextRef.current,
        text,
        isArmedBefore,
        triggerWord: normalizedTrigger,
        lastToken,
        matchedTrigger,
      });

      if (isArmedBefore && matchedTrigger) {
        void onAcceptTop();
        debugLog('accept_trigger_word', { text, lastToken });
        setArmed(false);
        queryRef.current = '';
        prevTextRef.current = '';
        return '';
      }

      if (isArmedBefore && isPrefixOfTrigger) {
        debugLog('stay_armed_prefix', { text, lastToken, triggerWord: normalizedTrigger });
        queryRef.current = text;
        prevTextRef.current = text;
        return text;
      }

      setArmed(false);
      debugLog('disarm_and_rearm_path', { text, textIsNonEmpty: text.trim().length > 0 });

      if (text.trim().length > 0) {
        const textAtSchedule = text;
        timerRef.current = setTimeout(() => {
          debugLog('armed_after_delay', { textAtSchedule, armingDelayMs });
          setArmed(true);
        }, armingDelayMs);
      }

      queryRef.current = text;
      prevTextRef.current = text;
      return text;
    },
    [armingDelayMs, clearTimer, debugLog, setArmed, onAcceptTop, triggerWord]
  );

  const handleSubmitEditing = useCallback(() => {
    if (queryRef.current.trim().length === 0) {
      debugLog('submit_noop_empty_query', {});
      return;
    }

    debugLog('submit_accept', { query: queryRef.current });
    void onAcceptTop();
  }, [debugLog, onAcceptTop]);

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
