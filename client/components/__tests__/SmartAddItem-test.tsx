import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { act } from 'react-test-renderer';
import { SmartAddItem } from '../SmartAddItem';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UndoProvider } from '../../api/undoContext';

describe('SmartAddItem', () => {
  let queryClient: QueryClient;
  let unmountComponent: (() => void) | undefined;

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <UndoProvider>{children}</UndoProvider>
    </QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: Infinity,
        },
      },
    });
  });

  afterEach(async () => {
    if (unmountComponent) {
      unmountComponent();
      unmountComponent = undefined;
    }

    await act(async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
    });
  });

  it('renders the search input', async () => {
    const { unmount } = render(<SmartAddItem />, { wrapper });
    unmountComponent = unmount;

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Add item...')).toBeTruthy();
    });
  });
});
