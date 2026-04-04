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
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: jest.fn().mockReturnValue({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
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
jest.mock('@/components/Settings', () => ({
  Settings: ({ visible }: { visible: boolean }) => {
    const { Text } = require('react-native');
    return visible ? <Text>Settings Modal Open</Text> : null;
  },
}));
jest.mock('@/components/SizesAndPackages', () => ({
  SizesAndPackages: ({ visible }: { visible: boolean }) => {
    const { Text } = require('react-native');
    return visible ? <Text>Sizes & Packages Modal Open</Text> : null;
  },
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

  it('shows General menu item (not Settings), above Sign Out', () => {
    mockUseHousehold.mockReturnValue({
      displayNameShort: 'JS',
      displayName: 'Jane Smith',
      avatarColor: '#123456',
    });

    render(<UserAvatar />);
    fireEvent.press(screen.getByTestId('avatar-button'));

    expect(screen.getByText('General')).toBeTruthy();
    expect(screen.queryByText('Settings')).toBeNull();
    const rendered = JSON.stringify(screen.toJSON());
    expect(rendered.indexOf('"General"')).toBeLessThan(rendered.indexOf('"Sign Out"'));
  });

  it('shows Sizes & Packages menu item', () => {
    mockUseHousehold.mockReturnValue({
      displayNameShort: 'JS',
      displayName: 'Jane Smith',
      avatarColor: '#123456',
    });

    render(<UserAvatar />);
    fireEvent.press(screen.getByTestId('avatar-button'));

    expect(screen.getByText('Sizes & Packages')).toBeTruthy();
  });

  it('opens settings modal when General is pressed', () => {
    mockUseHousehold.mockReturnValue({
      displayNameShort: 'JS',
      displayName: 'Jane Smith',
      avatarColor: '#123456',
    });

    render(<UserAvatar />);
    fireEvent.press(screen.getByTestId('avatar-button'));
    fireEvent.press(screen.getByText('General'));

    expect(screen.getByText('Settings Modal Open')).toBeTruthy();
  });

  it('opens SizesAndPackages when Sizes & Packages is pressed', () => {
    mockUseHousehold.mockReturnValue({
      displayNameShort: 'JS',
      displayName: 'Jane Smith',
      avatarColor: '#123456',
    });

    render(<UserAvatar />);
    fireEvent.press(screen.getByTestId('avatar-button'));
    fireEvent.press(screen.getByText('Sizes & Packages'));

    expect(screen.getByText('Sizes & Packages Modal Open')).toBeTruthy();
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
