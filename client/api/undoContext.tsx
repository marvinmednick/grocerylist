import React, { createContext, useContext, useState, useCallback } from 'react';

export interface UndoableAction {
  label: string;
  undo: () => Promise<void>;
}

interface UndoContextType {
  undoStack: UndoableAction[];
  pushAction: (action: UndoableAction) => void;
  undoLastAction: () => Promise<void>;
  canUndo: boolean;
}

const UndoContext = createContext<UndoContextType | undefined>(undefined);

export const UndoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [stack, setStack] = useState<UndoableAction[]>([]);

  const pushAction = useCallback((action: UndoableAction) => {
    setStack((prev) => {
      const newStack = [action, ...prev];
      return newStack.slice(0, 100); // Keep last 100 actions
    });
  }, []);

  const undoLastAction = useCallback(async () => {
    const [lastAction, ...remaining] = stack;
    if (!lastAction) return;

    try {
      await lastAction.undo();
      setStack(remaining);
    } catch (error) {
      console.error('Failed to undo action:', error);
      // Optional: show error toast
    }
  }, [stack]);

  return (
    <UndoContext.Provider value={{ 
      undoStack: stack, 
      pushAction, 
      undoLastAction, 
      canUndo: stack.length > 0 
    }}>
      {children}
    </UndoContext.Provider>
  );
};

export const useUndo = () => {
  const context = useContext(UndoContext);
  if (!context) throw new Error('useUndo must be used within an UndoProvider');
  return context;
};
