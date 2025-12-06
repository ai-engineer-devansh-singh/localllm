import { darkTheme } from '@/constants/theme';
import { useChatContext } from '@/contexts/ChatContext';
import { Message } from '@/types/chat';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { messages, sendMessage, activeModel, isGenerating, clearMessages, webSearchEnabled, isSearching, toggleWebSearch } = useChatContext();
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const handleSend = async () => {
    if (!inputText.trim() || !activeModel || isGenerating) return;

    const messageToSend = inputText.trim();
    setInputText('');
    
    try {
      await sendMessage(messageToSend);
      // Scroll to bottom after sending
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    
    return (
      <View
        style={[
          styles.messageContainer,
          isUser ? styles.userMessage : styles.aiMessage,
        ]}
      >
        <Text
          style={[
            styles.messageText,
            isUser ? styles.userMessageText : styles.aiMessageText,
          ]}
        >
          {item.content}
        </Text>
        
        {/* Show sources if available */}
        {!isUser && item.sources && item.sources.length > 0 && (
          <View style={styles.sourcesContainer}>
            <Text style={styles.sourcesTitle}>🔍 Sources:</Text>
            {item.sources.map((source, index) => (
              <TouchableOpacity
                key={index}
                style={styles.sourceItem}
                onPress={() => {
                  // Could open in browser
                  console.log('Open URL:', source.url);
                }}
              >
                <Ionicons name="link" size={14} color={darkTheme.colors.primary} />
                <Text style={styles.sourceText} numberOfLines={1}>
                  {source.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderEmptyState = () => {
    if (!activeModel) {
      return (
        <View style={styles.emptyStateContainer}>
          <Ionicons name="chatbubbles-outline" size={80} color={darkTheme.colors.primary} />
          <Text style={styles.emptyStateTitle}>Start a conversation</Text>
          <Text style={styles.emptyStateSubtitle}>
            Please activate a model in the Models tab first
          </Text>
          <TouchableOpacity
            style={styles.goToModelsButton}
            onPress={() => router.push('/models')}
          >
            <Ionicons name="cube" size={20} color="#fff" style={styles.buttonIcon} />
            <Text style={styles.buttonText}>Go to Models</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyStateContainer}>
        <Ionicons name="chatbubbles-outline" size={80} color={darkTheme.colors.primary} />
        <Text style={styles.emptyStateTitle}>No messages yet</Text>
        <Text style={styles.emptyStateSubtitle}>
          Start chatting with {activeModel.name}
        </Text>
      </View>
    );
  };

  const renderHeader = () => {
    if (messages.length === 0) return null;

    return (
      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.clearButton}
          onPress={clearMessages}
          disabled={isGenerating}
        >
          <Ionicons name="trash-outline" size={18} color={darkTheme.colors.error} />
          <Text style={styles.clearButtonText}>Clear Chat</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Calculate dynamic padding for bottom to account for tab bar
  // Tab bar height is 70px (includes padding), add safe area bottom inset
  const TAB_BAR_HEIGHT = 70;
  const bottomPadding = insets.bottom + TAB_BAR_HEIGHT;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      {/* Header with model info */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            paddingLeft: insets.left + 20,
            paddingRight: insets.right + 20,
          },
        ]}
      >
        <View style={styles.headerContent}>
          <Ionicons name="chatbubbles" size={24} color={darkTheme.colors.primary} />
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>AI Chat</Text>
            {activeModel ? (
              <Text style={styles.headerSubtitle}>{activeModel.name}</Text>
            ) : (
              <Text style={styles.headerSubtitleInactive}>No model active</Text>
            )}
          </View>
        </View>
      </View>

      {/* Messages List */}
      <View style={styles.messagesContainer}>
        {messages.length === 0 ? (
          renderEmptyState()
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.messagesList,
              { paddingTop: 16, paddingBottom: 16 },
            ]}
            ListFooterComponent={renderHeader}
            showsVerticalScrollIndicator={false}
            windowSize={10}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />
        )}
      </View>

      {/* Input Footer */}
      <View
        style={[
          styles.inputContainer,
          {
            paddingBottom: bottomPadding + 8,
            paddingLeft: insets.left + 16,
            paddingRight: insets.right + 16,
          },
        ]}
      >
        {/* Web Search Toggle */}
        <View style={styles.searchToggleContainer}>
          <TouchableOpacity
            style={[
              styles.searchToggle,
              webSearchEnabled && styles.searchToggleActive,
            ]}
            onPress={toggleWebSearch}
          >
            <Ionicons
              name={webSearchEnabled ? "globe" : "globe-outline"}
              size={16}
              color={webSearchEnabled ? "#fff" : darkTheme.colors.onSurfaceVariant}
            />
            <Text
              style={[
                styles.searchToggleText,
                webSearchEnabled && styles.searchToggleTextActive,
              ]}
            >
              Web Search {isSearching && '...'}
            </Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder={
              activeModel
                ? 'Type your message...'
                : 'Activate a model first'
            }
            placeholderTextColor={darkTheme.colors.onSurfaceVariant}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={2000}
            editable={!!activeModel && !isGenerating}
            scrollEnabled={false}
          />
          
          {isGenerating ? (
            <View style={styles.sendButton}>
              <ActivityIndicator size="small" color={darkTheme.colors.primary} />
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!inputText.trim() || !activeModel) && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={!inputText.trim() || !activeModel || isGenerating}
            >
              <Ionicons
                name="send"
                size={22}
                color={
                  inputText.trim() && activeModel
                    ? darkTheme.colors.primary
                    : darkTheme.colors.onSurfaceVariant
                }
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
  },
  header: {
    backgroundColor: darkTheme.colors.surface,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139, 92, 246, 0.2)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: darkTheme.colors.onSurface,
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 10,
    color: darkTheme.colors.primary,
    fontWeight: '500',
  },
  headerSubtitleInactive: {
    fontSize: 10,
    color: darkTheme.colors.error,
    fontWeight: '500',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  headerContainer: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  clearButtonText: {
    color: darkTheme.colors.error,
    fontSize: 11,
    fontWeight: '600',
  },
  messageContainer: {
    maxWidth: '80%',
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: darkTheme.colors.primary,
    borderBottomRightRadius: 4,
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: darkTheme.colors.surfaceVariant,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 12,
    lineHeight: 18,
  },
  userMessageText: {
    color: '#FFFFFF',
  },
  aiMessageText: {
    color: darkTheme.colors.onSurface,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: darkTheme.colors.onSurface,
    marginTop: 20,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 12,
    color: darkTheme.colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 18,
  },
  goToModelsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: darkTheme.colors.primary,
    borderRadius: 12,
    elevation: 2,
    shadowColor: darkTheme.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  buttonIcon: {
    marginRight: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  inputContainer: {
    paddingTop: 12,
    backgroundColor: darkTheme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: 'rgba(139, 92, 246, 0.2)',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: darkTheme.colors.surfaceVariant,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: darkTheme.colors.onSurface,
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  searchToggleContainer: {
    marginBottom: 8,
  },
  searchToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: darkTheme.colors.surfaceVariant,
    alignSelf: 'flex-start',
  },
  searchToggleActive: {
    backgroundColor: darkTheme.colors.primary,
  },
  searchToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: darkTheme.colors.onSurfaceVariant,
  },
  searchToggleTextActive: {
    color: '#FFFFFF',
  },
  sourcesContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(139, 92, 246, 0.1)',
  },
  sourcesTitle: {
    fontSize: 10,
    fontWeight: '600',
    color: darkTheme.colors.onSurfaceVariant,
    marginBottom: 4,
  },
  sourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  sourceText: {
    fontSize: 9,
    color: darkTheme.colors.primary,
    flex: 1,
  },
});
