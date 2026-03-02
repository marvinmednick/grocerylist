import React, { createContext, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface HouseholdContextType {
  householdId: string | null;
  userId: string | null;
  displayName: string | null;
  displayNameShort: string | null;
  avatarColor: string | null;
  isLoading: boolean;
}

const HouseholdContext = createContext<HouseholdContextType>({
  householdId: null,
  userId: null,
  displayName: null,
  displayNameShort: null,
  avatarColor: null,
  isLoading: true,
});

export const HouseholdProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: profile = null, isLoading } = useQuery({
    queryKey: ['my_profile'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('household_id, display_name, display_name_short, color')
        .eq('id', session.user.id)
        .single();

      if (error) throw error;
      return { ...data, userId: session.user.id };
    },
    staleTime: Infinity,
  });

  return (
    <HouseholdContext.Provider
      value={{
        householdId: profile?.household_id ?? null,
        userId: profile?.userId ?? null,
        displayName: profile?.display_name ?? null,
        displayNameShort: profile?.display_name_short ?? null,
        avatarColor: profile?.color ?? null,
        isLoading,
      }}
    >
      {children}
    </HouseholdContext.Provider>
  );
};

export const useHousehold = () => useContext(HouseholdContext);
