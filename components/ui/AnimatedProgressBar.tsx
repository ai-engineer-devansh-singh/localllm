import { darkTheme, spacing } from '@/constants/theme';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';

interface AnimatedProgressBarProps {
  progress: number; // 0 to 1
  label?: string;
  showPercentage?: boolean;
}

export const AnimatedProgressBar: React.FC<AnimatedProgressBarProps> = ({
  progress,
  label,
  showPercentage = true,
}) => {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withSpring(progress, {
      damping: 15,
      stiffness: 100,
    });
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%`,
  }));

  return (
    <View style={styles.container}>
      {(label || showPercentage) && (
        <View style={styles.header}>
          {label && <Text style={styles.label}>{label}</Text>}
          {showPercentage && (
            <Text style={styles.percentage}>{Math.round(progress * 100)}%</Text>
          )}
        </View>
      )}
      <View style={styles.track}>
        <Animated.View style={[styles.fill, animatedStyle]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: 14,
    color: darkTheme.colors.onBackground,
    fontWeight: '600',
  },
  percentage: {
    fontSize: 15,
    color: darkTheme.colors.downloadProgress,
    fontWeight: '700',
  },
  track: {
    height: 10,
    backgroundColor: darkTheme.colors.surfaceVariant,
    borderRadius: 10,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: darkTheme.colors.downloadProgress,
    borderRadius: 10,
    shadowColor: darkTheme.colors.downloadProgress,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
});
