import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface UpdateProfilePayload {
  display_name: string;
  display_name_short: string;
  color: string;
}

export interface HouseholdMember {
  id: string;
  display_name: string;
  display_name_short: string;
  color: string;
}

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ display_name, display_name_short, color }: UpdateProfilePayload) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase
        .from('profiles')
        .update({ display_name, display_name_short, color })
        .eq('id', session.user.id);

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my_profile'] });
    },
  });
};

export const useHouseholdName = (householdId: string | null) => {
  return useQuery({
    queryKey: ['household_name', householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('households')
        .select('name')
        .eq('id', householdId!)
        .single();

      if (error) {
        throw error;
      }

      return data.name as string;
    },
    enabled: !!householdId,
  });
};

export const useHouseholdMembers = (householdId: string | null) => {
  return useQuery({
    queryKey: ['household_members', householdId],
    queryFn: async () => {
      if (!householdId) {
        return [];
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, display_name_short, color')
        .eq('household_id', householdId!);

      if (error) {
        throw error;
      }

      return (data ?? []) as HouseholdMember[];
    },
    enabled: !!householdId,
    staleTime: 5 * 60 * 1000,
  });
};

export const useHouseholdMemberColors = (householdId: string | null) => {
  return useQuery({
    queryKey: ['household_member_colors', householdId],
    queryFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session || !householdId) {
        return [];
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('color')
        .eq('household_id', householdId)
        .neq('id', session.user.id);

      if (error) {
        throw error;
      }

      return (data ?? []).map((profile) => profile.color).filter(Boolean) as string[];
    },
    enabled: !!householdId,
  });
};
