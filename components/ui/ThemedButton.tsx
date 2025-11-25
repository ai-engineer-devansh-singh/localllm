import { darkTheme, spacing } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { StyleSheet, TouchableOpacity, View, ViewStyle } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';

interface ThemedButtonProps {
  onPress: () => void;
  title?: string;
  icon?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export const ThemedButton: React.FC<ThemedButtonProps> = ({
  onPress,
  title,
  icon,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  fullWidth = false,
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const handlePress = () => {
    if (!disabled && !loading) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onPress();
    }
  };

  const getBackgroundColor = () => {
    if (disabled) return darkTheme.colors.surfaceVariant;
    switch (variant) {
      case 'primary':
        return darkTheme.colors.primary;
      case 'secondary':
        return darkTheme.colors.secondary;
      case 'danger':
        return darkTheme.colors.error;
      case 'ghost':
        return 'transparent';
      default:
        return darkTheme.colors.primary;
    }
  };

  const getTextColor = () => {
    if (disabled) return darkTheme.colors.onSurfaceVariant;
    if (variant === 'ghost') return darkTheme.colors.primary;
    return '#FFFFFF';
  };

  return (
    <AnimatedTouchable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      style={[
        styles.button,
        { backgroundColor: getBackgroundColor() },
        fullWidth && styles.fullWidth,
        variant === 'ghost' && styles.ghost,
        animatedStyle,
        style,
      ]}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          {title && (
            <Text
              style={[
                styles.text,
                { color: getTextColor() },
                disabled && styles.disabledText,
              ]}
            >
              {title}
            </Text>
          )}
        </>
      )}
    </AnimatedTouchable>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 28,
    minHeight: 52,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  fullWidth: {
    width: '100%',
  },
  ghost: {
    borderWidth: 2,
    borderColor: darkTheme.colors.primary,
    shadowOpacity: 0,
  },
  iconContainer: {
    marginRight: spacing.sm,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  disabledText: {
    opacity: 0.5,
  },
});
