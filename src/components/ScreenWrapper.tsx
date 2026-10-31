import React from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  ViewStyle,
  View,
} from 'react-native';
import { useApp } from '../context/AppContext';

interface ScreenWrapperProps {
  children: React.ReactNode;
  style?: ViewStyle;
  withScroll?: boolean;
}

export default function ScreenWrapper({
  children,
  style,
  withScroll = true,
}: ScreenWrapperProps) {
  const { theme } = useApp();
  const isDark = theme === 'dark';

  const containerBg = isDark ? '#09090b' : '#f4f4f5'; // Темний або світлий фон

  const content = withScroll ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, style]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.container, { backgroundColor: containerBg }, style]}>{children}</View>
  );

  return (
    <View style={[styles.container, { backgroundColor: containerBg }]}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        {content}
      </TouchableWithoutFeedback>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 120,
  },
});