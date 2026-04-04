import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SizesAndPackages } from '@/components/SizesAndPackages';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: jest.fn().mockReturnValue({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/components/VocabularyManagement', () => ({
  VocabularyManagement: ({ type, onBack, onClose }: { type: string; onBack: () => void; onClose: () => void }) => {
    const { View, Text, TouchableOpacity } = require('react-native');
    const titleMap: Record<string, string> = {
      units: 'Units',
      packages: 'Packages',
      size_descriptors: 'Sizes',
    };

    return (
      <View>
        <Text>{titleMap[type]}</Text>
        <TouchableOpacity testID="mock-vocab-back" onPress={onBack}>
          <Text>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="mock-vocab-close" onPress={onClose}>
          <Text>Close</Text>
        </TouchableOpacity>
      </View>
    );
  },
}));

describe('SizesAndPackages', () => {
  it('renders the menu with three nav rows', () => {
    render(<SizesAndPackages visible onClose={jest.fn()} />);

    expect(screen.getByTestId('vocab-nav-units')).toBeTruthy();
    expect(screen.getByTestId('vocab-nav-packages')).toBeTruthy();
    expect(screen.getByTestId('vocab-nav-sizes')).toBeTruthy();
  });

  it('renders Units title and back button after tapping Units row', () => {
    render(<SizesAndPackages visible onClose={jest.fn()} />);

    fireEvent.press(screen.getByTestId('vocab-nav-units'));

    expect(screen.getByText('Units')).toBeTruthy();
    expect(screen.getByTestId('mock-vocab-back')).toBeTruthy();
  });

  it('renders Packages title after tapping Packages row', () => {
    render(<SizesAndPackages visible onClose={jest.fn()} />);

    fireEvent.press(screen.getByTestId('vocab-nav-packages'));

    expect(screen.getByText('Packages')).toBeTruthy();
  });

  it('renders Sizes title after tapping Sizes row', () => {
    render(<SizesAndPackages visible onClose={jest.fn()} />);

    fireEvent.press(screen.getByTestId('vocab-nav-sizes'));

    expect(screen.getByText('Sizes')).toBeTruthy();
  });

  it('returns to menu when back button is pressed', () => {
    render(<SizesAndPackages visible onClose={jest.fn()} />);

    fireEvent.press(screen.getByTestId('vocab-nav-units'));
    fireEvent.press(screen.getByTestId('mock-vocab-back'));

    expect(screen.getByTestId('vocab-nav-units')).toBeTruthy();
    expect(screen.getByTestId('vocab-nav-packages')).toBeTruthy();
    expect(screen.getByTestId('vocab-nav-sizes')).toBeTruthy();
  });

  it('calls onClose when X is pressed from menu screen', () => {
    const onClose = jest.fn();
    render(<SizesAndPackages visible onClose={onClose} />);

    fireEvent.press(screen.getByTestId('sizes-packages-close'));

    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when X is pressed from management screen', () => {
    const onClose = jest.fn();
    render(<SizesAndPackages visible onClose={onClose} />);

    fireEvent.press(screen.getByTestId('vocab-nav-units'));
    fireEvent.press(screen.getByTestId('mock-vocab-close'));

    expect(onClose).toHaveBeenCalled();
  });
});
