import { darkTheme, spacing } from '@/constants/theme';
import { Message } from '@/types/chat';
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, {
  FadeInUp,
  FadeOutDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

interface AnimatedMessageProps {
  message: Message;
}

export const AnimatedMessage: React.FC<AnimatedMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const cursorOpacity = useSharedValue(1);

  useEffect(() => {
    if (message.isStreaming) {
      // Animate cursor blinking while streaming
      cursorOpacity.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 500 }),
          withTiming(1, { duration: 500 })
        ),
        -1, // infinite repeat
        true
      );
    } else {
      cursorOpacity.value = 0; // Hide cursor when done
    }
  }, [message.isStreaming, cursorOpacity]);

  const animatedBubbleStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: withSequence(
            withSpring(0.95, { damping: 15 }),
            withSpring(1, { damping: 15 })
          ),
        },
      ],
    };
  });

  const cursorStyle = useAnimatedStyle(() => {
    return {
      opacity: cursorOpacity.value,
    };
  });

  return (
    <Animated.View
      entering={FadeInUp.duration(400).springify().damping(15)}
      exiting={FadeOutDown.duration(200)}
      style={[
        styles.container,
        isUser ? styles.userContainer : styles.aiContainer,
      ]}
    >
      <Animated.View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.aiBubble,
          animatedBubbleStyle,
        ]}
      >
        <Text
          style={[
            styles.messageText,
            isUser ? styles.userText : styles.aiText,
          ]}
        >
          {message.content}
          {message.isStreaming && (
            <Animated.Text style={[styles.cursor, cursorStyle]}>
              ▊
            </Animated.Text>
          )}
        </Text>
        <Text style={styles.timestamp}>
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
    maxWidth: '85%',
  },
  userContainer: {
    alignSelf: 'flex-end',
  },
  aiContainer: {
    alignSelf: 'flex-start',
  },
  bubble: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userBubble: {
    backgroundColor: darkTheme.colors.userBubble,
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: darkTheme.colors.aiBubble,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: spacing.xs,
  },
  userText: {
    color: '#FFFFFF',
  },
  aiText: {
    color: darkTheme.colors.onBackground,
  },
  timestamp: {
    fontSize: 11,
    color: darkTheme.colors.timestamp,
    opacity: 0.8,
    fontWeight: '500',
  },
  cursor: {
    fontSize: 16,
    color: darkTheme.colors.primary,
    fontWeight: 'bold',
  },
});
