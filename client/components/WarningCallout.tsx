import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, HelpCircle, Info, XCircle } from 'lucide-react-native';
import { getWarningText, type Warning } from '@/api/items';

interface WarningCalloutProps {
  warnings: Warning[];
}

export const WarningCallout: React.FC<WarningCalloutProps> = ({ warnings }) => {
  if (!warnings.length) {
    return null;
  }

  return (
    <View style={styles.container} testID="warning-callout">
      {warnings.map((warning, index) => (
        <View key={`${warning.type}-${index}`} style={styles.row}>
          {warning.type === 'avoided' ? (
            <AlertTriangle size={14} color="#f59e0b" />
          ) : warning.type === 'unavailable' ? (
            <XCircle size={14} color="#ef4444" />
          ) : warning.type === 'non_preferred' ? (
            <Info size={14} color="#6b7280" />
          ) : (
            <HelpCircle size={14} color="#6b7280" />
          )}
          <Text style={styles.text}>{getWarningText(warning)}</Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fffbeb',
    borderColor: '#fbbf24',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    flex: 1,
    fontSize: 12,
    color: '#92400e',
    lineHeight: 18,
  },
});
