import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { darkTheme } from '@/constants/theme';
import { ChatProvider } from '@/contexts/ChatContext';

export default function TabLayout() {
  return (
    <ChatProvider>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: darkTheme.colors.primary,
          tabBarInactiveTintColor: darkTheme.colors.onSurfaceVariant,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarBackground: TabBarBackground,
          tabBarStyle: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: darkTheme.colors.surface,
            borderTopWidth: 1,
            borderTopColor: 'rgba(139, 92, 246, 0.2)',
            paddingTop: 8,
            // paddingBottom: 8,
            paddingHorizontal: 16,
            elevation: 0,
            height: 70,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginTop: 2,
            marginBottom: 0,
          },
          tabBarIconStyle: {
            marginTop: 4,
          },
        }}
        initialRouteName="chat"
      >
        <Tabs.Screen
          name="chat"
          options={{
            title: 'Chat',
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons 
                name={focused ? "chatbubbles" : "chatbubbles-outline"} 
                size={size + 2} 
                color={color} 
              />
            ),
          }}
        />
        <Tabs.Screen
          name="models"
          options={{
            title: 'Models',
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons 
                name={focused ? "cube" : "cube-outline"} 
                size={size + 2} 
                color={color} 
              />
            ),
          }}
        />
        <Tabs.Screen
          name="_documents"
          options={{
            href: null,
          }}
        />

      </Tabs>
    </ChatProvider>
  );
}
