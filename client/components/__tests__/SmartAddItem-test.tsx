import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { SmartAddItem } from '../SmartAddItem';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('SmartAddItem', () => {
  it('renders the search input', () => {
    render(<SmartAddItem />, { wrapper });
    
    expect(screen.getByPlaceholderText('Add item...')).toBeTruthy();
  });
});
