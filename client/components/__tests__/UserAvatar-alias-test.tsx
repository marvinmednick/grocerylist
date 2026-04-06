import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { UserAvatar } from '@/components/UserAvatar';
import { useHousehold } from '@/lib/household';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

jest.mock('@/lib/household');
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  return { ...actual, useQueryClient: jest.fn() };
});
jest.mock('expo-router', () => ({ useRouter: jest.fn() }));
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { signOut: jest.fn() } },
}));
jest.mock('@/components/Settings', () => ({
  Settings: ({ visible }: { visible: boolean }) => {
    const { Text } = require('react-native');
    return visible ? <Text>Settings Modal</Text> : null;
  },
}));
jest.mock('@/components/SizesAndPackages', () => ({
  SizesAndPackages: ({ visible }: { visible: boolean }) => {
    const { Text } = require('react-native');
    return visible ? <Text>Sizes Modal</Text> : null;
  },
}));
jest.mock('@/components/Abbreviations', () => ({
  Abbreviations: ({ visible }: { visible: boolean }) => {
    const { Text } = require('react-native');
    return visible ? <Text>Abbreviations Modal</Text> : null;
  },
}));

const mockUseHousehold = useHousehold as jest.Mock;
const mockUseQueryClient = useQueryClient as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

describe('UserAvatar abbreviations entry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseHousehold.mockReturnValue({
      displayName: 'Jane Smith',
      displayNameShort: 'JS',
      avatarColor: '#2563eb',
    });
    mockUseQueryClient.mockReturnValue({ clear: jest.fn() });
    mockUseRouter.mockReturnValue({ replace: jest.fn() });
  });

  it('shows Abbreviations in menu and in expected order', () => {
    render(<UserAvatar />);
    fireEvent.press(screen.getByTestId('avatar-button'));

    expect(screen.getByText('Abbreviations')).toBeTruthy();
    const rendered = JSON.stringify(screen.toJSON());
    expect(rendered.indexOf('"General"')).toBeLessThan(rendered.indexOf('"Sizes & Packages"'));
    expect(rendered.indexOf('"Sizes & Packages"')).toBeLessThan(rendered.indexOf('"Abbreviations"'));
    expect(rendered.indexOf('"Abbreviations"')).toBeLessThan(rendered.indexOf('"Sign Out"'));
  });

  it('opens Abbreviations modal when menu entry is pressed', () => {
    render(<UserAvatar />);
    fireEvent.press(screen.getByTestId('avatar-button'));
    fireEvent.press(screen.getByText('Abbreviations'));

    expect(screen.getByText('Abbreviations Modal')).toBeTruthy();
  });
});
