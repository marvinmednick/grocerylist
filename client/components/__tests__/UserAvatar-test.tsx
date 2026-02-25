import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { UserAvatar } from '../UserAvatar';
import { useHousehold } from '@/lib/household';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

// Mock the hooks and supabase
jest.mock('@/lib/household');
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signOut: jest.fn(),
    },
  },
}));
jest.mock('@tanstack/react-query', () => {
  const original = jest.requireActual('@tanstack/react-query');
  return {
    ...original,
    useQueryClient: jest.fn(),
  };
});
jest.mock('expo-router', () => ({
  useRouter: jest.fn(),
}));

const mockUseHousehold = useHousehold as jest.Mock;
const mockUseQueryClient = useQueryClient as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

describe('UserAvatar', () => {
  const mockQueryClient = {
    clear: jest.fn(),
  };
  const mockRouter = {
    replace: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseQueryClient.mockReturnValue(mockQueryClient);
    mockUseRouter.mockReturnValue(mockRouter);
  });

  it('renders the first letter of displayNameShort', () => {
    mockUseHousehold.mockReturnValue({
      displayNameShort: 'JS',
      displayName: 'Jane Smith',
      avatarColor: '#123456',
    });

    render(<UserAvatar />);
    expect(screen.getByText('J')).toBeTruthy();
  });

  it('falls back to first letter of displayName when displayNameShort is null', () => {
    mockUseHousehold.mockReturnValue({
      displayNameShort: null,
      displayName: 'Jane Smith',
      avatarColor: '#123456',
    });

    render(<UserAvatar />);
    expect(screen.getByText('J')).toBeTruthy();
  });

  it('renders ? when both names are null', () => {
    mockUseHousehold.mockReturnValue({
      displayNameShort: null,
      displayName: null,
      avatarColor: '#123456',
    });

    render(<UserAvatar />);
    expect(screen.getByText('?')).toBeTruthy();
  });

  it('uses default color #2563eb when avatarColor is null', () => {
    mockUseHousehold.mockReturnValue({
      displayNameShort: 'JS',
      displayName: 'Jane Smith',
      avatarColor: null,
    });

    render(<UserAvatar />);
    const avatarButton = screen.getByTestId('avatar-button');
    const flat = StyleSheet.flatten(avatarButton.props.style);
    expect(flat.backgroundColor).toBe('#2563eb');
  });

  it('closes menu when backdrop is pressed', () => {
    mockUseHousehold.mockReturnValue({
      displayNameShort: 'JS',
      displayName: 'Jane Smith',
      avatarColor: '#123456',
    });

    render(<UserAvatar />);
    fireEvent.press(screen.getByTestId('avatar-button'));
    expect(screen.getByText('Sign Out')).toBeTruthy();

    fireEvent.press(screen.getByTestId('avatar-menu-backdrop'));
    expect(screen.queryByText('Sign Out')).toBeNull();
  });

  it('opens menu on press', () => {
    mockUseHousehold.mockReturnValue({
      displayNameShort: 'JS',
      displayName: 'Jane Smith',
      avatarColor: '#123456',
    });

    render(<UserAvatar />);
    fireEvent.press(screen.getByText('J'));
    
    expect(screen.getByText('Jane Smith')).toBeTruthy();
    expect(screen.getByText('Sign Out')).toBeTruthy();
  });

  it('calls signOut and clears query cache on Sign Out press', async () => {
    mockUseHousehold.mockReturnValue({
      displayNameShort: 'JS',
      displayName: 'Jane Smith',
      avatarColor: '#123456',
    });

    render(<UserAvatar />);
    fireEvent.press(screen.getByText('J'));
    fireEvent.press(screen.getByText('Sign Out'));

    await waitFor(() => {
      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(mockQueryClient.clear).toHaveBeenCalled();
      expect(mockRouter.replace).toHaveBeenCalledWith('/auth');
    });
  });
});
