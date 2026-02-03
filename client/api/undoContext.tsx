import React, { createContext, useContext, useState, useCallback } from 'react';

export interface UndoableAction {
  label: string;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

interface UndoContextType {
  undoStack: UndoableAction[];
  redoStack: UndoableAction[];
  pushAction: (action: UndoableAction) => void;
  undoLastAction: () => Promise<void>;
  redoLastAction: () => Promise<void>;
  canUndo: boolean;
  canRedo: boolean;
}

const UndoContext = createContext<UndoContextType | undefined>(undefined);

export const UndoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [undoStack, setUndoStack] = useState<UndoableAction[]>([]);
  const [redoStack, setRedoStack] = useState<UndoableAction[]>([]);

  const pushAction = useCallback((action: UndoableAction) => {
    setUndoStack((prev) => {
      const newStack = [action, ...prev];
      return newStack.slice(0, 100);
    });
    setRedoStack([]); // Clear redo stack on new action
  }, []);

  const undoLastAction = useCallback(async () => {
    if (undoStack.length === 0) return;
    
    const [action, ...remainingUndo] = undoStack;
    try {
      await action.undo();
      setUndoStack(remainingUndo);
      setRedoStack(prev => [action, ...prev]);
    } catch (error) {
      console.error('Failed to undo action:', error);
    }
  }, [undoStack]);

  const redoLastAction = useCallback(async () => {
    if (redoStack.length === 0) return;

    const [action, ...remainingRedo] = redoStack;
    try {
      await action.redo();
      setRedoStack(remainingRedo);
      setUndoStack(prev => [action, ...prev]);
    } catch (error) {
      console.error('Failed to redo action:', error);
    }
  }, [redoStack]);

  return (
    <UndoContext.Provider value={{ 
      undoStack, 
      redoStack,
      pushAction, 
      undoLastAction, 
      redoLastAction,
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0
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