import { AnimatedProgressBar } from '@/components/ui/AnimatedProgressBar';
import { ModelCard } from '@/components/ui/ModelCard';
import { ThemedButton } from '@/components/ui/ThemedButton';
import { darkTheme, spacing } from '@/constants/theme';
import { useChatContext } from '@/contexts/ChatContext';
import { DownloadProgress, EmbeddingModel, Model } from '@/types/chat';
import {
    EMBEDDING_MODELS,
    deleteEmbeddingModel,
    downloadEmbeddingModel,
    getDownloadedEmbeddingModels,
} from '@/utils/embeddingManager';
import {
    AVAILABLE_MODELS,
    cancelDownload,
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
  const { downloadedModels, activeModel, refreshModels, checkEmbeddingModel } = useChatContext();
  const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [storageUsed, setStorageUsed] = useState<number>(0);

  // Embedding models state
  const [downloadedEmbeddingModels, setDownloadedEmbeddingModels] = useState<EmbeddingModel[]>([]);
  const [downloadingEmbedding, setDownloadingEmbedding] = useState<string | null>(null);
  const [embeddingDownloadProgress, setEmbeddingDownloadProgress] = useState<number>(0);

  useEffect(() => {
    loadStorageInfo();
    refreshEmbeddingModels();
  }, [downloadedModels]);

  const loadStorageInfo = async () => {
    const used = await getStorageUsed();
    setStorageUsed(used);
  };

  const refreshEmbeddingModels = async () => {
    const models = await getDownloadedEmbeddingModels();
    setDownloadedEmbeddingModels(models);
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
      // Ignore if cancelled (we can check error message or type if needed, but for now just log)
      console.error('Download error:', error);
      if (error instanceof Error && error.message.includes('interrupted')) {
         // Cancelled
         return;
      }
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', `Failed to download ${model.name}: ${error}`);
    } finally {
      setDownloadingModel(null);
      setDownloadProgress(null);
    }
  };

  const handleCancelDownload = async (modelId: string) => {
    try {
      await cancelDownload(modelId);
      setDownloadingModel(null);
      setDownloadProgress(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      console.error('Error cancelling download:', error);
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

  const handleDownloadEmbedding = async (model: EmbeddingModel) => {
    try {
      setDownloadingEmbedding(model.id);
      setEmbeddingDownloadProgress(0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      await downloadEmbeddingModel(model, (progress) => {
        setEmbeddingDownloadProgress(progress);
      });

      await refreshEmbeddingModels();
      await checkEmbeddingModel();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', `${model.name} downloaded successfully`);
    } catch (error) {
      console.error('Embedding download error:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', `Failed to download ${model.name}: ${error}`);
    } finally {
      setDownloadingEmbedding(null);
      setEmbeddingDownloadProgress(0);
    }
  };

  const handleDeleteEmbedding = async (modelId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this embedding model?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEmbeddingModel(modelId);
              await refreshEmbeddingModels();
              await checkEmbeddingModel();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert('Success', 'Embedding model deleted successfully');
            } catch (error) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', `Failed to delete embedding model: ${error}`);
            }
          },
        },
      ]
    );
  };

  const isDownloaded = (modelId: string) => {
    return downloadedModels.some((m) => m.id === modelId);
  };

  const isActive = (modelId: string) => {
    return activeModel?.id === modelId;
  };

  const isEmbeddingDownloaded = (modelId: string) => {
    return downloadedEmbeddingModels.some((m) => m.id === modelId);
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
        <Text style={styles.sectionTitle}>Chat Models</Text>
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
              description={model.description}
              category={model.category}
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
                    title="Cancel Download"
                    onPress={() => handleCancelDownload(model.id)}
                    variant="danger"
                    icon={<Ionicons name="close-circle-outline" size={18} color="#FFF" />}
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

        <View style={styles.divider} />
        
        <Text style={styles.sectionTitle}>Embedding Models</Text>
        <Text style={styles.sectionSubtitle}>
          Required for document processing and RAG features
        </Text>

        {EMBEDDING_MODELS.map((model, index) => {
          const downloaded = isEmbeddingDownloaded(model.id);
          const downloading = downloadingEmbedding === model.id;

          return (
            <ModelCard
              key={model.id}
              name={model.name}
              size={formatBytes(model.size)}
              isActive={false} // Embedding models are auto-selected
              isDownloaded={downloaded}
              description="High-performance text embedding model for semantic search"
              category={['embedding', 'semantic-search']}
              index={index + AVAILABLE_MODELS.length}
            >
              {downloading && (
                <Animated.View
                  entering={FadeInUp.duration(300)}
                  style={styles.downloadingContainer}
                >
                  <AnimatedProgressBar
                    progress={embeddingDownloadProgress}
                    showPercentage
                  />
                  <Text style={[styles.downloadText, { marginTop: 4 }]}>
                    Downloading...
                  </Text>
                </Animated.View>
              )}

              <View style={styles.actions}>
                {!downloaded && !downloading && (
                  <ThemedButton
                    title="Download"
                    onPress={() => handleDownloadEmbedding(model)}
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
                {downloaded && (
                  <ThemedButton
                    title="Delete"
                    onPress={() => handleDeleteEmbedding(model.id)}
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
    paddingVertical: spacing.sm,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    fontSize: 16,
    fontWeight: '800',
    color: darkTheme.colors.onBackground,
    letterSpacing: 0.5,
  },
  storageText: {
    fontSize: 10,
    color: darkTheme.colors.onSurfaceVariant,
    marginTop: 4,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 120 : 100,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: darkTheme.colors.onBackground,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: darkTheme.colors.onSurfaceVariant,
    marginBottom: spacing.lg,
    marginTop: -spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    marginVertical: spacing.xl,
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
    fontSize: 10,
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
