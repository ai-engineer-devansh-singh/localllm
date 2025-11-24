import { darkTheme, spacing } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { FadeInDown } from 'react-native-reanimated';

interface ModelCardProps {
  name: string;
  size: string;
  isActive?: boolean;
  isDownloaded?: boolean;
  children?: React.ReactNode;
  index?: number;
}

export const ModelCard: React.FC<ModelCardProps> = ({
  name,
  size,
  isActive = false,
  isDownloaded = false,
  children,
  index = 0,
}) => {
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 100)
        .duration(400)
        .springify()}
      style={styles.card}
    >
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.modelName}>{name}</Text>
          {isActive && (
            <View style={styles.activeBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#FFF" />
              <Text style={styles.activeBadgeText}>Active</Text>
            </View>
          )}
        </View>
        {isDownloaded && !isActive && (
          <Ionicons
            name="checkmark-circle-outline"
            size={20}
            color={darkTheme.colors.activeBadge}
          />
        )}
      </View>

      <Text style={styles.size}>{size}</Text>

      {children && <View style={styles.content}>{children}</View>}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: darkTheme.colors.surface,
    borderRadius: 20,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
    shadowColor: darkTheme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modelName: {
    fontSize: 18,
    fontWeight: '700',
    color: darkTheme.colors.onBackground,
    marginRight: spacing.sm,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: darkTheme.colors.activeBadge,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
    shadowColor: darkTheme.colors.activeBadge,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  size: {
    fontSize: 14,
    color: darkTheme.colors.onSurfaceVariant,
    marginBottom: spacing.md,
    fontWeight: '500',
  },
  content: {
    marginTop: spacing.sm,
  },
});
