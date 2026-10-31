
import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { AppProvider, useApp } from '../context/AppContext';

function TabLayoutContent() {
  const { theme, accentColor } = useApp();
  const isDark = theme === 'dark';
  const ACCENT = accentColor || '#38bdf8';

  useEffect(() => {
    async function checkForUpdates() {
      if (__DEV__ || !Updates.isEnabled) {
        return;
      }

      try {
        const update = await Updates.checkForUpdateAsync();

        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (error) {
        console.log('Помилка перевірки оновлень:', error);
      }
    }

    checkForUpdates();
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDark ? '#121216' : '#ffffff',
          borderTopColor: isDark ? ACCENT : '#e4e4e7',
        },
        tabBarActiveTintColor: ACCENT,
        tabBarInactiveTintColor: isDark ? '#71717a' : '#a1a1aa',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Головна',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={String(color)} />
          ),
        }}
      />

      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Календар',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar" size={size} color={String(color)} />
          ),
        }}
      />

      <Tabs.Screen
        name="work"
        options={{
          title: 'Робота',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="briefcase" size={size} color={String(color)} />
          ),
        }}
      />

      <Tabs.Screen
        name="notes"
        options={{
          title: 'Нотатки',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text" size={size} color={String(color)} />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: 'Налаштування',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={String(color)} />
          ),
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{ href: null }}
      />
    </Tabs>
  );
}

export default function RootLayout() {
  return (
    <AppProvider>
      <TabLayoutContent />
    </AppProvider>
  );
}
