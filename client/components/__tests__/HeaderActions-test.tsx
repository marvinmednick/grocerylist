import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { HeaderActions } from '../HeaderActions';
import { useUndo } from '@/api/undoContext';

jest.mock('@/api/undoContext');
jest.mock('@/components/UserAvatar', () => ({
  UserAvatar: () => {
    const { Text } = require('react-native');
    return <Text>Avatar Stub</Text>;
  },
}));

const mockUseUndo = useUndo as jest.Mock;

describe('HeaderActions', () => {
  const undoLastAction = jest.fn();
  const redoLastAction = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUndo.mockReturnValue({
      undoLastAction,
      redoLastAction,
      canUndo: true,
      canRedo: true,
      undoStack: [],
      redoStack: [],
    });
  });

  it('renders undo button', () => {
    render(<HeaderActions />);
    expect(screen.getByTestId('header-undo-button')).toBeTruthy();
  });

  it('renders redo button', () => {
    render(<HeaderActions />);
    expect(screen.getByTestId('header-redo-button')).toBeTruthy();
  });

  it('renders avatar', () => {
    render(<HeaderActions />);
    expect(screen.getByText('Avatar Stub')).toBeTruthy();
  });

  it('sets undo opacity to 0.3 when canUndo is false', () => {
    mockUseUndo.mockReturnValue({
      undoLastAction,
      redoLastAction,
      canUndo: false,
      canRedo: true,
      undoStack: [],
      redoStack: [],
    });

    render(<HeaderActions />);
    const style = StyleSheet.flatten(screen.getByTestId('header-undo-button').props.style);
    expect(style.opacity).toBe(0.3);
  });

  it('sets redo opacity to 0.3 when canRedo is false', () => {
    mockUseUndo.mockReturnValue({
      undoLastAction,
      redoLastAction,
      canUndo: true,
      canRedo: false,
      undoStack: [],
      redoStack: [],
    });

    render(<HeaderActions />);
    const style = StyleSheet.flatten(screen.getByTestId('header-redo-button').props.style);
    expect(style.opacity).toBe(0.3);
  });

  it('calls undoLastAction when undo is pressed', () => {
    render(<HeaderActions />);
    fireEvent.press(screen.getByTestId('header-undo-button'));
    expect(undoLastAction).toHaveBeenCalledTimes(1);
  });

  it('calls redoLastAction when redo is pressed', () => {
    render(<HeaderActions />);
    fireEvent.press(screen.getByTestId('header-redo-button'));
    expect(redoLastAction).toHaveBeenCalledTimes(1);
  });

  it('shows undo badge count when undo stack has items', () => {
    mockUseUndo.mockReturnValue({
      undoLastAction,
      redoLastAction,
      canUndo: true,
      canRedo: true,
      undoStack: [{}, {}],
      redoStack: [],
    });

    render(<HeaderActions />);
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('shows redo badge count when redo stack has items', () => {
    mockUseUndo.mockReturnValue({
      undoLastAction,
      redoLastAction,
      canUndo: true,
      canRedo: true,
      undoStack: [],
      redoStack: [{}],
    });

    render(<HeaderActions />);
    expect(screen.getByText('1')).toBeTruthy();
  });
});
