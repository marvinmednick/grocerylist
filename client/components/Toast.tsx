import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

interface ToastProps {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  duration?: number;
  variant?: 'default' | 'warning';
}

export const Toast: React.FC<ToastProps> = ({
  message,
  visible,
  onDismiss,
  duration,
  variant = 'default',
}) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const effectiveDuration = duration ?? (variant === 'warning' ? 4000 : 3000);
  const containerStyle = variant === 'warning' ? styles.warningContainer : styles.container;
  const textStyle = variant === 'warning' ? styles.warningText : styles.text;

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => onDismiss());
      }, effectiveDuration);

      return () => clearTimeout(timer);
    } else {
      opacity.setValue(0);
    }
  }, [visible, effectiveDuration, onDismiss, opacity]);

  if (!visible) return null;

  return (
    <Animated.View testID="toast-container" style={[containerStyle, { opacity }]}>
      <Text style={textStyle}>{message}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: '#1f2937',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  text: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  warningContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fbbf24',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  warningText: {
    color: '#92400e',
    fontSize: 14,
    fontWeight: '600',
  },
});
