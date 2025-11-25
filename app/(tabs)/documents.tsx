import { darkTheme, spacing } from '@/constants/theme';
import { useChatContext } from '@/contexts/ChatContext';
import { Document as AppDocument } from '@/types/chat';
import { formatBytes } from '@/utils/modelManager';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function DocumentsScreen() {
  const insets = useSafeAreaInsets();
  const { documents, uploadDocument, deleteDocument, isProcessingDocument } = useChatContext();
  const [storageUsed, setStorageUsed] = useState(0);

  useEffect(() => {
    calculateStorage();
  }, [documents]);

  const calculateStorage = () => {
    const total = documents.reduce((sum: number, doc: AppDocument) => sum + doc.size, 0);
    setStorageUsed(total);
  };

  const handleUpload = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await uploadDocument();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (error instanceof Error) {
        Alert.alert('Upload Failed', error.message);
      }
    }
  };

  const handleDelete = (docId: string, docName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      'Delete Document',
      `Are you sure you want to delete "${docName}"? This will also remove all associated embeddings.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDocument(docId);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Error', 'Failed to delete document');
            }
          },
        },
      ]
    );
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return 'document-text';
      case 'xlsx':
      case 'xls':
        return 'grid';
      case 'docx':
      case 'doc':
        return 'document';
      case 'txt':
        return 'document-text-outline';
      default:
        return 'document';
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <Animated.View
        entering={FadeInUp.duration(500)}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <View style={styles.headerGradient}>
          <View style={styles.headerContent}>
            <View style={styles.iconWrapper}>
              <Ionicons name="folder-open" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Documents</Text>
              <Text style={styles.storageText}>
                {documents.length} files • {formatBytes(storageUsed)}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={handleUpload}
            style={styles.uploadButton}
            activeOpacity={0.7}
            disabled={isProcessingDocument}
          >
            <Ionicons 
              name={isProcessingDocument ? "hourglass" : "add-circle"} 
              size={28} 
              color={darkTheme.colors.primary} 
            />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {documents.length === 0 ? (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons
                name="cloud-upload-outline"
                size={64}
                color={darkTheme.colors.primary}
              />
            </View>
            <Text style={styles.emptyTitle}>No documents yet</Text>
            <Text style={styles.emptyText}>
              Upload documents to chat with your AI about their content
            </Text>
            <Text style={styles.emptySubtext}>
              Currently supports: TXT files{'\n'}
              (PDF, Excel, Word coming soon)
            </Text>
            <TouchableOpacity
              onPress={handleUpload}
              style={styles.emptyButton}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={20} color="#FFF" />
              <Text style={styles.emptyButtonText}>Upload Document</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          documents.map((doc: AppDocument, index: number) => (
            <Animated.View
              key={doc.id}
              entering={FadeInDown.delay(index * 50).duration(400)}
              style={styles.documentCard}
            >
              <View style={styles.docHeader}>
                <View style={styles.docIconContainer}>
                  <Ionicons
                    name={getFileIcon(doc.type) as any}
                    size={24}
                    color={darkTheme.colors.primary}
                  />
                </View>
                <View style={styles.docInfo}>
                  <Text style={styles.docName} numberOfLines={1}>
                    {doc.name}
                  </Text>
                  <Text style={styles.docMeta}>
                    {formatBytes(doc.size)} • {doc.chunkCount} chunks • {formatDate(doc.uploadDate)}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleDelete(doc.id, doc.name)}
                  style={styles.deleteButton}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={20} color={darkTheme.colors.error} />
                </TouchableOpacity>
              </View>
            </Animated.View>
          ))
        )}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: darkTheme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: darkTheme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  headerTextContainer: {
    marginLeft: spacing.md,
    flex: 1,
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
  uploadButton: {
    padding: spacing.sm,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 120 : 100,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyIconContainer: {
    marginBottom: spacing.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: darkTheme.colors.onBackground,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: 11,
    color: darkTheme.colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  emptySubtext: {
    fontSize: 10,
    color: darkTheme.colors.onSurfaceVariant,
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: spacing.xl,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: darkTheme.colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 24,
    gap: spacing.sm,
    shadowColor: darkTheme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  documentCard: {
    backgroundColor: darkTheme.colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  docHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  docIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  docInfo: {
    flex: 1,
  },
  docName: {
    fontSize: 13,
    fontWeight: '600',
    color: darkTheme.colors.onBackground,
    marginBottom: 4,
  },
  docMeta: {
    fontSize: 10,
    color: darkTheme.colors.onSurfaceVariant,
  },
  deleteButton: {
    padding: spacing.sm,
  },
});
