import React, { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface HouseholdContextType {
  householdId: string | null;
  isLoading: boolean;
}

const HouseholdContext = createContext<HouseholdContextType>({
  householdId: null,
  isLoading: true,
});

export const HouseholdProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: householdId = null, isLoading } = useQuery({
    queryKey: ['household_id'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('household_id')
        .eq('id', session.user.id)
        .single();

      if (error) throw error;
      return data.household_id as string;
    },
    staleTime: Infinity,
  });

  return (
    <HouseholdContext.Provider value={{ householdId, isLoading }}>
      {children}
    </HouseholdContext.Provider>
  );
};

export const useHousehold = () => useContext(HouseholdContext);
