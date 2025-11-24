import { AnimatedProgressBar } from '@/components/ui/AnimatedProgressBar';
import { ModelCard } from '@/components/ui/ModelCard';
import { ThemedButton } from '@/components/ui/ThemedButton';
import { darkTheme, spacing } from '@/constants/theme';
import { useChatContext } from '@/contexts/ChatContext';
import { DownloadProgress, Model } from '@/types/chat';
import {
  AVAILABLE_MODELS,
  deleteModel,
  downloadModel,
  formatBytes,
  getStorageUsed,
  setActiveModel,
} from '@/utils/modelManager';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ModelsScreen() {
  const insets = useSafeAreaInsets();
  const { downloadedModels, activeModel, refreshModels } = useChatContext();
  const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [storageUsed, setStorageUsed] = useState<number>(0);

  useEffect(() => {
    loadStorageInfo();
  }, [downloadedModels]);

  const loadStorageInfo = async () => {
    const used = await getStorageUsed();
    setStorageUsed(used);
  };

  const handleDownload = async (model: Model) => {
    try {
      setDownloadingModel(model.id);
      setDownloadProgress({
        modelId: model.id,
        progress: 0,
        totalBytes: model.size,
        downloadedBytes: 0,
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      await downloadModel(model, (progress) => {
        console.log('Progress update:', progress);
        setDownloadProgress(progress);
      });

      await refreshModels();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', `${model.name} downloaded successfully`);
    } catch (error) {
      console.error('Download error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', `Failed to download ${model.name}: ${error}`);
    } finally {
      setDownloadingModel(null);
      setDownloadProgress(null);
    }
  };

  const handleDelete = async (modelId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this model?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteModel(modelId);
              await refreshModels();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', 'Model deleted successfully');
            } catch (error) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', `Failed to delete model: ${error}`);
            }
          },
        },
      ]
    );
  };

  const handleActivate = async (model: Model) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await setActiveModel(model);
      await refreshModels();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', `${model.name} is now active`);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', `Failed to activate model: ${error}`);
    }
  };

  const isDownloaded = (modelId: string) => {
    return downloadedModels.some((m) => m.id === modelId);
  };

  const isActive = (modelId: string) => {
    return activeModel?.id === modelId;
  };

  return (
    <View style={styles.container}>
      {/* Modern Gradient Header */}
      <Animated.View 
        entering={FadeInUp.duration(500)}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <View style={styles.headerGradient}>
          <View style={styles.headerContent}>
            <View style={styles.iconWrapper}>
              <Ionicons name="cube" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Models</Text>
              <Text style={styles.storageText}>
                Storage: {formatBytes(storageUsed)}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {AVAILABLE_MODELS.map((model, index) => {
          const downloaded = isDownloaded(model.id);
          const active = isActive(model.id);
          const downloading = downloadingModel === model.id;

          return (
            <ModelCard
              key={model.id}
              name={model.name}
              size={formatBytes(model.size)}
              isActive={active}
              isDownloaded={downloaded}
              index={index}
            >
              {downloading && downloadProgress && (
                <Animated.View
                  entering={FadeInUp.duration(300)}
                  style={styles.downloadingContainer}
                >
                  <AnimatedProgressBar
                    progress={downloadProgress.progress}
                    showPercentage
                  />
                  <View style={styles.downloadDetails}>
                    <Text style={styles.downloadText}>
                      {formatBytes(downloadProgress.downloadedBytes)} of{' '}
                      {formatBytes(downloadProgress.totalBytes)}
                    </Text>
                    <Text style={styles.downloadText}>
                      Remaining: {formatBytes(downloadProgress.totalBytes - downloadProgress.downloadedBytes)}
                    </Text>
                  </View>
                </Animated.View>
              )}

              <View style={styles.actions}>
                {!downloaded && !downloading && (
                  <ThemedButton
                    title="Download"
                    onPress={() => handleDownload(model)}
                    icon={<Ionicons name="download-outline" size={18} color="#FFF" />}
                    fullWidth
                  />
                )}
                {downloading && (
                  <ThemedButton
                    title="Downloading..."
                    onPress={() => {}}
                    disabled
                    loading
                    fullWidth
                  />
                )}
                {downloaded && !active && (
                  <View style={styles.actionRow}>
                    <ThemedButton
                      title="Activate"
                      onPress={() => {
                        const downloadedModel = downloadedModels.find(
                          (m) => m.id === model.id
                        );
                        if (downloadedModel) {
                          handleActivate(downloadedModel);
                        }
                      }}
                      icon={<Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />}
                      style={styles.activateButton}
                    />
                    <ThemedButton
                      title="Delete"
                      onPress={() => handleDelete(model.id)}
                      variant="danger"
                      icon={<Ionicons name="trash-outline" size={18} color="#FFF" />}
                      style={styles.deleteButton}
                    />
                  </View>
                )}
                {downloaded && active && (
                  <ThemedButton
                    title="Delete"
                    onPress={() => handleDelete(model.id)}
                    variant="danger"
                    icon={<Ionicons name="trash-outline" size={18} color="#FFF" />}
                    fullWidth
                  />
                )}
              </View>
            </ModelCard>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkTheme.colors.background,
  },
  header: {
    backgroundColor: darkTheme.colors.surface,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: darkTheme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  headerGradient: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: darkTheme.colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: darkTheme.colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  headerTextContainer: {
    marginLeft: spacing.md,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: darkTheme.colors.onBackground,
    letterSpacing: 0.5,
  },
  storageText: {
    fontSize: 13,
    color: darkTheme.colors.onSurfaceVariant,
    marginTop: 4,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? 110 : 90,
  },
  downloadingContainer: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  downloadDetails: {
    marginTop: spacing.sm,
    gap: 4,
  },
  downloadText: {
    fontSize: 12,
    color: darkTheme.colors.onSurfaceVariant,
  },
  actions: {
    marginTop: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  activateButton: {
    flex: 1,
  },
  deleteButton: {
    flex: 1,
  },
});
