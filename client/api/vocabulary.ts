import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useHousehold } from '@/lib/household';
import { supabase } from '@/lib/supabase';
import { DEFAULT_VOCABULARY } from '@/lib/vocabulary';

export type VocabularyType = 'units' | 'packages' | 'size_descriptors';

export interface VocabRow {
  id: string;
  canonical: string;
  aliases: string[];
}

export interface VocabularyData {
  units: VocabRow[];
  packages: VocabRow[];
  sizeDescriptors: VocabRow[];
}

export const useVocabulary = () => {
  const { householdId } = useHousehold();

  return useQuery({
    queryKey: ['vocabulary', householdId],
    queryFn: async () => {
      if (!householdId) throw new Error('No household ID found');

      const [unitsRes, packagesRes, sizeDescRes] = await Promise.all([
        supabase
          .from('units')
          .select('id, canonical, aliases')
          .eq('household_id', householdId)
          .order('canonical'),
        supabase
          .from('packages')
          .select('id, canonical, aliases')
          .eq('household_id', householdId)
          .order('canonical'),
        supabase
          .from('size_descriptors')
          .select('id, canonical, aliases')
          .eq('household_id', householdId)
          .order('canonical'),
      ]);

      if (unitsRes.error) throw unitsRes.error;
      if (packagesRes.error) throw packagesRes.error;
      if (sizeDescRes.error) throw sizeDescRes.error;

      return {
        units: unitsRes.data as VocabRow[],
        packages: packagesRes.data as VocabRow[],
        sizeDescriptors: sizeDescRes.data as VocabRow[],
      } satisfies VocabularyData;
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!householdId,
  });
};

export const useCreateVocabularyEntry = (type: VocabularyType) => {
  const queryClient = useQueryClient();
  const { householdId } = useHousehold();

  return useMutation({
    mutationFn: async ({ canonical, aliases }: { canonical: string; aliases: string[] }) => {
      if (!householdId) throw new Error('No household ID found');

      const { data, error } = await supabase
        .from(type)
        .insert({ household_id: householdId, canonical, aliases })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary'] });
    },
  });
};

export const useUpdateVocabularyEntry = (type: VocabularyType) => {
  const queryClient = useQueryClient();
  const { householdId } = useHousehold();

  return useMutation({
    mutationFn: async ({ id, canonical, aliases }: { id: string; canonical: string; aliases: string[] }) => {
      if (!householdId) throw new Error('No household ID found');

      const { data, error } = await supabase
        .from(type)
        .update({ canonical, aliases })
        .eq('id', id)
        .eq('household_id', householdId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary'] });
    },
  });
};

export const useDeleteVocabularyEntry = (type: VocabularyType) => {
  const queryClient = useQueryClient();
  const { householdId } = useHousehold();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!householdId) throw new Error('No household ID found');

      const { error } = await supabase
        .from(type)
        .delete()
        .eq('id', id)
        .eq('household_id', householdId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary'] });
    },
  });
};

export const useResetVocabularyToDefaults = (type: VocabularyType) => {
  const queryClient = useQueryClient();
  const { householdId } = useHousehold();

  return useMutation({
    mutationFn: async () => {
      if (!householdId) throw new Error('No household ID found');

      const seedKey = type === 'size_descriptors' ? 'sizeDescriptors' : type;
      const seedEntries = DEFAULT_VOCABULARY[seedKey as 'units' | 'packages' | 'sizeDescriptors'];

      const { error: deleteError } = await supabase
        .from(type)
        .delete()
        .eq('household_id', householdId);

      if (deleteError) throw deleteError;

      const { error: insertError } = await supabase
        .from(type)
        .insert(seedEntries.map((entry) => ({
          household_id: householdId,
          canonical: entry.canonical,
          aliases: entry.aliases,
        })));

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocabulary'] });
    },
  });
};
