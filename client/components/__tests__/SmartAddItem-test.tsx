import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { SmartAddItem } from '../SmartAddItem';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UndoProvider } from '../../api/undoContext';

describe('SmartAddItem', () => {
  let queryClient: QueryClient;

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
        },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('renders the search input', () => {
    render(<SmartAddItem />, { wrapper });

    expect(screen.getByPlaceholderText('Add item...')).toBeTruthy();
  });
});
