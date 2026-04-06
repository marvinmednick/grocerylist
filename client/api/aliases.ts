import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useHousehold } from '@/lib/household';
import { supabase } from '@/lib/supabase';

interface WordAliasRow {
  id: string;
  alias: string;
  canonical: string;
}

interface AbbreviationSuggestionRow {
  word: string;
  suggestion: string;
}

export const useWordAliases = () => {
  const { householdId } = useHousehold();

  return useQuery({
    queryKey: ['word_aliases', householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('word_aliases')
        .select('id, alias, canonical')
        .eq('household_id', householdId)
        .order('canonical');

      if (error) throw error;

      const aliasMap = new Map<string, string>();
      (data as WordAliasRow[]).forEach((row) => {
        aliasMap.set(row.alias, row.canonical);
      });
      return aliasMap;
    },
    enabled: Boolean(householdId),
    staleTime: 5 * 60 * 1000,
  });
};

export const useAbbreviationSuggestions = () => {
  return useQuery({
    queryKey: ['abbreviation_suggestions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('abbreviation_suggestions')
        .select('word, suggestion')
        .order('word');

      if (error) throw error;

      const suggestions = new Map<string, string[]>();
      (data as AbbreviationSuggestionRow[]).forEach((row) => {
        const existing = suggestions.get(row.word) ?? [];
        suggestions.set(row.word, [...existing, row.suggestion]);
      });
      return suggestions;
    },
    staleTime: Infinity,
  });
};

export const useCreateWordAlias = () => {
  const queryClient = useQueryClient();
  const { householdId, userId } = useHousehold();

  return useMutation({
    mutationFn: async ({ alias, canonical }: { alias: string; canonical: string }) => {
      if (!householdId) throw new Error('No household ID found');

      const { data, error } = await supabase
        .from('word_aliases')
        .insert({
          household_id: householdId,
          alias: alias.toLowerCase().trim(),
          canonical: canonical.toLowerCase().trim(),
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['word_aliases'] });
    },
  });
};

export const useUpdateWordAlias = () => {
  const queryClient = useQueryClient();
  const { householdId } = useHousehold();

  return useMutation({
    mutationFn: async ({ id, alias, canonical }: { id: string; alias: string; canonical: string }) => {
      if (!householdId) throw new Error('No household ID found');

      const { data, error } = await supabase
        .from('word_aliases')
        .update({
          alias: alias.toLowerCase().trim(),
          canonical: canonical.toLowerCase().trim(),
        })
        .eq('id', id)
        .eq('household_id', householdId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['word_aliases'] });
    },
  });
};

export const useDeleteWordAlias = () => {
  const queryClient = useQueryClient();
  const { householdId } = useHousehold();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!householdId) throw new Error('No household ID found');

      const { error } = await supabase
        .from('word_aliases')
        .delete()
        .eq('id', id)
        .eq('household_id', householdId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['word_aliases'] });
    },
  });
};
