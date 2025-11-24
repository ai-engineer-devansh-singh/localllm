import { AnimatedMessage } from '@/components/ui/AnimatedMessage';
import { LoadingIndicator } from '@/components/ui/LoadingIndicator';
import { ThemedButton } from '@/components/ui/ThemedButton';
import { darkTheme, spacing } from '@/constants/theme';
import { useChatContext } from '@/contexts/ChatContext';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { messages, activeModel, isGenerating, sendMessage, stopGenerating, clearMessages } = useChatContext();
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    if (!activeModel) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert(
        'No Active Model',
        'Please download and activate a model in the Models tab first.',
        [
          {
            text: 'Go to Models',
            onPress: () => router.push('/(tabs)/models' as any),
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    const messageText = inputText.trim();
    setInputText('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await sendMessage(messageText);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', `Failed to send message: ${error}`);
    }
  };

  const handleClearChat = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Clear Chat', 'Are you sure you want to clear all messages?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          clearMessages();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  const renderEmptyState = () => (
    <Animated.View entering={FadeIn.duration(400)} style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ionicons
          name="chatbubbles-outline"
          size={64}
          color={darkTheme.colors.primary}
        />
      </View>
      <Text style={styles.emptyTitle}>Start a conversation</Text>
      <Text style={styles.emptyText}>
        {activeModel
          ? 'Type a message below to chat with your local AI'
          : 'Please activate a model in the Models tab first'}
      </Text>
      {!activeModel && (
        <ThemedButton
          title="Go to Models"
          onPress={() => router.push('/(tabs)/models' as any)}
          style={styles.emptyButton}
          icon={<Ionicons name="download-outline" size={18} color="#FFF" />}
        />
      )}
    </Animated.View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <View style={styles.innerContainer}>
      {/* Modern Gradient Header */}
      <Animated.View 
        entering={FadeIn.duration(500)}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
      >
        <View style={styles.headerGradient}>
          <View style={styles.headerContent}>
            <View style={styles.iconWrapper}>
              <Ionicons name="chatbox-ellipses" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>AI Chat</Text>
              {activeModel ? (
                <View style={styles.modelStatusContainer}>
                  <View style={styles.statusDot} />
                  <Text style={styles.modelName}>{activeModel.name}</Text>
                </View>
              ) : (
                <Text style={styles.noModel}>No model active</Text>
              )}
            </View>
          </View>
          {messages.length > 0 && (
            <TouchableOpacity
              onPress={handleClearChat}
              style={styles.clearButton}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={22} color={darkTheme.colors.error} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={({ item }) => <AnimatedMessage message={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.messagesContent,
          messages.length === 0 && styles.messagesContentEmpty,
        ]}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={isGenerating ? <LoadingIndicator /> : null}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
      />

      {/* Input */}
      <View style={[styles.inputContainer]}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder={activeModel ? 'Type a message...' : 'Activate a model first'}
            placeholderTextColor={darkTheme.colors.onSurfaceVariant}
            multiline
            maxLength={500}
            editable={!isGenerating && !!activeModel}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={handleSend}
            enablesReturnKeyAutomatically={true}
          />
        </View>
        {isGenerating ? (
          <TouchableOpacity
            style={styles.stopButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              stopGenerating();
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="stop-circle" size={24} color="#EF4444" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputText.trim() || !activeModel) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || !activeModel}
            activeOpacity={0.7}
          >
            <Ionicons
              name="send"
              size={20}
              color={(!inputText.trim() || !activeModel) 
                ? darkTheme.colors.onSurfaceVariant 
                : '#FFFFFF'}
            />
          </TouchableOpacity>
        )}
      </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkTheme.colors.background,
    marginBottom:90

  },
  innerContainer: {
    flex: 1,
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
    paddingVertical: spacing.lg,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
    fontSize: 24,
    fontWeight: '800',
    color: darkTheme.colors.onBackground,
    letterSpacing: 0.5,
  },
  modelStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: darkTheme.colors.activeBadge,
    marginRight: spacing.xs,
  },
  modelName: {
    fontSize: 12,
    color: darkTheme.colors.activeBadge,
    fontWeight: '600',
  },
  noModel: {
    fontSize: 12,
    color: darkTheme.colors.error,
    marginTop: 6,
    fontWeight: '500',
  },
  clearButton: {
    padding: spacing.md,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
  },
  messagesContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 100 : 80,
  },
  messagesContentEmpty: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  emptyIconContainer: {
    marginBottom: spacing.xl,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: darkTheme.colors.onBackground,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: darkTheme.colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  emptyButton: {
    marginTop: spacing.md,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    backgroundColor: darkTheme.colors.surface,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(139, 92, 246, 0.2)',
  },
  inputWrapper: {
    flex: 1,
 
    backgroundColor: darkTheme.colors.inputBackground,
    borderRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginRight: spacing.md,
    maxHeight: 100,
    borderWidth: 2,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  textInput: {
    fontSize: 16,
    color: darkTheme.colors.onBackground,
    lineHeight: 22,
  },
  sendButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: darkTheme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: darkTheme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  sendButtonDisabled: {
    backgroundColor: darkTheme.colors.surfaceVariant,
    shadowOpacity: 0,
  },
  stopButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#EF4444',
  },
});
