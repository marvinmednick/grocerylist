import { act, renderHook } from '@testing-library/react-native';
import { useQuickAcceptState } from '../useQuickAcceptState';

describe('useQuickAcceptState', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('starts idle', () => {
    const { result } = renderHook(() =>
      useQuickAcceptState({
        triggerWord: 'enter',
        armingDelayMs: 1500,
        query: '',
        onAcceptTop: jest.fn(),
      })
    );

    expect(result.current.isArmed).toBe(false);
  });

  it('arms after delay', () => {
    const { result } = renderHook(() =>
      useQuickAcceptState({
        triggerWord: 'enter',
        armingDelayMs: 1500,
        query: '',
        onAcceptTop: jest.fn(),
      })
    );

    act(() => {
      result.current.handleTextChange('milk');
      jest.advanceTimersByTime(1500);
    });

    expect(result.current.isArmed).toBe(true);
  });

  it('timer resets on each input change', () => {
    const { result } = renderHook(() =>
      useQuickAcceptState({
        triggerWord: 'enter',
        armingDelayMs: 1000,
        query: '',
        onAcceptTop: jest.fn(),
      })
    );

    act(() => {
      result.current.handleTextChange('m');
      jest.advanceTimersByTime(700);
      result.current.handleTextChange('mi');
      jest.advanceTimersByTime(700);
    });

    expect(result.current.isArmed).toBe(false);

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(result.current.isArmed).toBe(true);
  });

  it('disarms on new input after armed', () => {
    const { result } = renderHook(() =>
      useQuickAcceptState({
        triggerWord: 'enter',
        armingDelayMs: 1000,
        query: '',
        onAcceptTop: jest.fn(),
      })
    );

    act(() => {
      result.current.handleTextChange('milk');
      jest.advanceTimersByTime(1000);
    });

    expect(result.current.isArmed).toBe(true);

    act(() => {
      result.current.handleTextChange('milky');
    });

    expect(result.current.isArmed).toBe(false);
  });

  it('submit calls accept when query non-empty', () => {
    const onAcceptTop = jest.fn();
    const { result, rerender } = renderHook(
      ({ query }) =>
        useQuickAcceptState({
          triggerWord: 'enter',
          armingDelayMs: 1000,
          query,
          onAcceptTop,
        }),
      { initialProps: { query: '' } }
    );

    rerender({ query: 'milk' });

    act(() => {
      result.current.handleSubmitEditing();
    });

    expect(onAcceptTop).toHaveBeenCalledTimes(1);
  });

  it('submit no-op when query empty', () => {
    const onAcceptTop = jest.fn();
    const { result } = renderHook(() =>
      useQuickAcceptState({
        triggerWord: 'enter',
        armingDelayMs: 1000,
        query: '   ',
        onAcceptTop,
      })
    );

    act(() => {
      result.current.handleSubmitEditing();
    });

    expect(onAcceptTop).not.toHaveBeenCalled();
  });

  it('armed trigger-word last token calls accept', () => {
    const onAcceptTop = jest.fn();
    const { result } = renderHook(() =>
      useQuickAcceptState({
        triggerWord: 'enter',
        armingDelayMs: 1000,
        query: '',
        onAcceptTop,
      })
    );

    act(() => {
      result.current.handleTextChange('milk');
      jest.advanceTimersByTime(1000);
      result.current.handleTextChange('milk enter');
    });

    expect(onAcceptTop).toHaveBeenCalledTimes(1);
  });

  it('armed trigger detection returns empty string', () => {
    const { result } = renderHook(() =>
      useQuickAcceptState({
        triggerWord: 'enter',
        armingDelayMs: 1000,
        query: '',
        onAcceptTop: jest.fn(),
      })
    );

    let output = 'not-empty';
    act(() => {
      result.current.handleTextChange('milk');
      jest.advanceTimersByTime(1000);
      output = result.current.handleTextChange('milk enter');
    });

    expect(output).toBe('');
  });

  it('trigger not detected while idle', () => {
    const onAcceptTop = jest.fn();
    const { result } = renderHook(() =>
      useQuickAcceptState({
        triggerWord: 'enter',
        armingDelayMs: 1000,
        query: '',
        onAcceptTop,
      })
    );

    act(() => {
      result.current.handleTextChange('milk enter');
    });

    expect(onAcceptTop).not.toHaveBeenCalled();
  });

  it('trigger match is case-insensitive', () => {
    const onAcceptTop = jest.fn();
    const { result } = renderHook(() =>
      useQuickAcceptState({
        triggerWord: 'EnTeR',
        armingDelayMs: 1000,
        query: '',
        onAcceptTop,
      })
    );

    act(() => {
      result.current.handleTextChange('milk');
      jest.advanceTimersByTime(1000);
      result.current.handleTextChange('milk ENTER');
    });

    expect(onAcceptTop).toHaveBeenCalledTimes(1);
  });

  it('substring last token does not match trigger', () => {
    const onAcceptTop = jest.fn();
    const { result } = renderHook(() =>
      useQuickAcceptState({
        triggerWord: 'enter',
        armingDelayMs: 1000,
        query: '',
        onAcceptTop,
      })
    );

    act(() => {
      result.current.handleTextChange('milk');
      jest.advanceTimersByTime(1000);
      result.current.handleTextChange('milk entering');
    });

    expect(onAcceptTop).not.toHaveBeenCalled();
  });

  it('stays armed when last token is a prefix of trigger word', () => {
    const { result } = renderHook(() =>
      useQuickAcceptState({
        triggerWord: 'popcorn',
        armingDelayMs: 1000,
        query: '',
        onAcceptTop: jest.fn(),
      })
    );

    act(() => {
      result.current.handleTextChange('milk');
      jest.advanceTimersByTime(1000);
    });

    expect(result.current.isArmed).toBe(true);

    act(() => {
      result.current.handleTextChange('milk pop');
    });

    expect(result.current.isArmed).toBe(true);
  });

  it('accepts trigger after prefix partial arrives (streaming dictation)', () => {
    const onAcceptTop = jest.fn();
    const { result } = renderHook(() =>
      useQuickAcceptState({
        triggerWord: 'popcorn',
        armingDelayMs: 1000,
        query: '',
        onAcceptTop,
      })
    );

    let output = 'not-empty';
    act(() => {
      result.current.handleTextChange('milk');
      jest.advanceTimersByTime(1000);
      result.current.handleTextChange('milk pop');
      output = result.current.handleTextChange('milk popcorn');
    });

    expect(onAcceptTop).toHaveBeenCalledTimes(1);
    expect(output).toBe('');
  });

  it('disarms after prefix when non-prefix text follows', () => {
    const onAcceptTop = jest.fn();
    const { result } = renderHook(() =>
      useQuickAcceptState({
        triggerWord: 'popcorn',
        armingDelayMs: 1000,
        query: '',
        onAcceptTop,
      })
    );

    act(() => {
      result.current.handleTextChange('milk');
      jest.advanceTimersByTime(1000);
      result.current.handleTextChange('milk pop');
    });

    expect(result.current.isArmed).toBe(true);

    act(() => {
      result.current.handleTextChange('milk popular');
    });

    expect(result.current.isArmed).toBe(false);
    expect(onAcceptTop).not.toHaveBeenCalled();
  });

  it('handles leading newlines in streaming dictation', () => {
    const onAcceptTop = jest.fn();
    const { result } = renderHook(() =>
      useQuickAcceptState({
        triggerWord: 'popcorn',
        armingDelayMs: 1000,
        query: '',
        onAcceptTop,
      })
    );

    act(() => {
      result.current.handleTextChange('milk');
      jest.advanceTimersByTime(1000);
      result.current.handleTextChange('milk \npopcorn');
    });

    expect(onAcceptTop).toHaveBeenCalledTimes(1);
  });

  it('prefix check is case-insensitive', () => {
    const onAcceptTop = jest.fn();
    const { result } = renderHook(() =>
      useQuickAcceptState({
        triggerWord: 'Popcorn',
        armingDelayMs: 1000,
        query: '',
        onAcceptTop,
      })
    );

    act(() => {
      result.current.handleTextChange('milk');
      jest.advanceTimersByTime(1000);
      result.current.handleTextChange('milk Pop');
    });

    expect(result.current.isArmed).toBe(true);

    act(() => {
      result.current.handleTextChange('milk POPCORN');
    });

    expect(onAcceptTop).toHaveBeenCalledTimes(1);
  });

  it('single-character prefix keeps armed', () => {
    const onAcceptTop = jest.fn();
    const { result } = renderHook(() =>
      useQuickAcceptState({
        triggerWord: 'done',
        armingDelayMs: 1000,
        query: '',
        onAcceptTop,
      })
    );

    act(() => {
      result.current.handleTextChange('milk');
      jest.advanceTimersByTime(1000);
      result.current.handleTextChange('milk d');
    });

    expect(result.current.isArmed).toBe(true);
    expect(onAcceptTop).not.toHaveBeenCalled();
  });

  it('does not stay armed for prefix when not already armed', () => {
    const onAcceptTop = jest.fn();
    const { result } = renderHook(() =>
      useQuickAcceptState({
        triggerWord: 'popcorn',
        armingDelayMs: 1000,
        query: '',
        onAcceptTop,
      })
    );

    act(() => {
      result.current.handleTextChange('milk pop');
    });

    expect(result.current.isArmed).toBe(false);
    expect(onAcceptTop).not.toHaveBeenCalled();
  });

  it('empty text does not start timer', () => {
    const { result } = renderHook(() =>
      useQuickAcceptState({
        triggerWord: 'enter',
        armingDelayMs: 1000,
        query: '',
        onAcceptTop: jest.fn(),
      })
    );

    act(() => {
      result.current.handleTextChange('');
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.isArmed).toBe(false);
  });

  it('unmount clears timer safely', () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const { result, unmount } = renderHook(() =>
      useQuickAcceptState({
        triggerWord: 'enter',
        armingDelayMs: 1000,
        query: '',
        onAcceptTop: jest.fn(),
      })
    );

    act(() => {
      result.current.handleTextChange('milk');
    });

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});
