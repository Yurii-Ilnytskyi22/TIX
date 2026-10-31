import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useApp } from '../context/AppContext';
import ScreenWrapper from '../components/ScreenWrapper';

const ACCENT_COLORS = [
  '#38bdf8',
  '#facc15',
  '#fb923c',
  '#4ade80',
  '#a3e635',
  '#c084fc',
  '#f472b6',
  '#b90707',
  '#596cfd',
  '#fd59ea',
  '#8501f0',
  '#7b5e39',
];

export default function SettingsScreen() {
  const {
    userName,
    setUserName,
    theme,
    setTheme,
    accentColor,
    setAccentColor,
  } = useApp();

  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [tempName, setTempName] = useState(userName);

  const handleSaveName = () => {
    if (!tempName.trim()) return;

    setUserName(tempName.trim());
    setNameModalVisible(false);
    Keyboard.dismiss();
  };

  const isDark = theme === 'dark';
  const ACCENT = accentColor || '#38bdf8';

  const textColor = isDark ? '#ffffff' : '#09090b';
  const subTextColor = isDark ? '#a1a1aa' : '#71717a';
  const cardBg = isDark ? '#121216' : '#ffffff';
  const cardBorder = isDark ? ACCENT : '#e4e4e7';
  const innerCardBg = isDark ? '#18181b' : '#f4f4f5';

  return (
    <ScreenWrapper>
      <View style={styles.brandHeader}>
        <Text style={[styles.brandTitle, { color: textColor }]}>
          TIX
        </Text>
        <Text style={styles.brandTagline}>
          ТВІЙ ЧАС ПІД КОНТРОЛЕМ
        </Text>
        <Text style={[styles.pageSubtitle, { color: subTextColor }]}>
          Персоналізація та параметри застосунку
        </Text>
      </View>

      {/* Профіль користувача */}
      <TouchableOpacity
        style={[
          styles.profileCard,
          { backgroundColor: cardBg, borderColor: cardBorder },
        ]}
        onPress={() => {
          setTempName(userName);
          setNameModalVisible(true);
        }}
      >
        <View
          style={[
            styles.avatarCircle,
            { backgroundColor: innerCardBg },
          ]}
        >
          <Text style={styles.avatarText}>👤</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[styles.profileLabel, { color: subTextColor }]}>
            Ім'я користувача
          </Text>
          <Text style={[styles.profileName, { color: textColor }]}>
            {userName}
          </Text>
          <Text style={[styles.profileSub, { color: subTextColor }]}>
            user@tix.app
          </Text>
        </View>

        <Text style={[styles.arrowIcon, { color: subTextColor }]}>›</Text>
      </TouchableOpacity>

      {/* Оформлення */}
      <View
        style={[
          styles.card,
          { backgroundColor: cardBg, borderColor: cardBorder },
        ]}
      >
        <Text style={[styles.cardTitle, { color: textColor }]}>
          Оформлення
        </Text>

        {/* Вибір теми */}
        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: subTextColor }]}>
            Тема
          </Text>

          <View
            style={[
              styles.themeToggleRow,
              { backgroundColor: innerCardBg },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.themeBtn,
                isDark && { backgroundColor: ACCENT },
              ]}
              onPress={() => setTheme('dark')}
            >
              <Text
                style={[
                  styles.themeBtnText,
                  { color: isDark ? '#09090b' : subTextColor },
                  isDark && { fontWeight: 'bold' },
                ]}
              >
                Темна
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.themeBtn,
                !isDark && { backgroundColor: ACCENT },
              ]}
              onPress={() => setTheme('light')}
            >
              <Text
                style={[
                  styles.themeBtnText,
                  { color: !isDark ? '#09090b' : subTextColor },
                  !isDark && { fontWeight: 'bold' },
                ]}
              >
                Світла
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Вибір акцентного кольору */}
        <View style={styles.settingColumn}>
          <Text style={[styles.settingLabel, { color: subTextColor }]}>
            Акцентний колір
          </Text>

          <View style={styles.colorsRow}>
            {ACCENT_COLORS.map((color) => {
              const isSelected = accentColor === color;

              return (
                <TouchableOpacity
                  key={color}
                  accessibilityRole="button"
                  accessibilityLabel={`Вибрати колір ${color}`}
                  accessibilityState={{ selected: isSelected }}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: color },
                    isSelected && [
                      styles.selectedColorCircle,
                      { borderColor: textColor },
                    ],
                  ]}
                  onPress={() => setAccentColor(color)}
                />
              );
            })}
          </View>
        </View>
      </View>

      {/* Модальне вікно зміни імені */}
      <Modal
        visible={nameModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setNameModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalInner}>
              <View
                style={[
                  styles.modalSheet,
                  {
                    backgroundColor: cardBg,
                    borderColor: cardBorder,
                  },
                ]}
              >
                <View style={styles.dragHandle} />

                <Text style={[styles.sheetTitle, { color: textColor }]}>
                  Змінити ім'я
                </Text>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: subTextColor }]}>
                    Ваше ім'я
                  </Text>

                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: innerCardBg,
                        color: textColor,
                        borderColor: cardBorder,
                      },
                    ]}
                    value={tempName}
                    onChangeText={setTempName}
                    placeholder="Введіть ім'я"
                    placeholderTextColor={subTextColor}
                    returnKeyType="done"
                    onSubmitEditing={handleSaveName}
                  />
                </View>

                <View style={styles.modalButtonsRow}>
                  <TouchableOpacity
                    style={[
                      styles.cancelBtn,
                      {
                        backgroundColor: innerCardBg,
                        borderColor: cardBorder,
                      },
                    ]}
                    onPress={() => {
                      setNameModalVisible(false);
                      Keyboard.dismiss();
                    }}
                  >
                    <Text
                      style={[
                        styles.cancelBtnText,
                        { color: textColor },
                      ]}
                    >
                      Скасувати
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.saveBtn,
                      { backgroundColor: ACCENT },
                    ]}
                    onPress={handleSaveName}
                  >
                    <Text style={[styles.saveBtnText, { color: isDark ? '#09090b' : '#ffffff' }]}>
                      ✓ Зберегти
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  brandHeader: {
    marginBottom: 20,
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 2,
  },
  brandTagline: {
    color: '#667780',
    fontSize: 9,
    letterSpacing: 1.5,
    marginTop: 2,
  },
  pageSubtitle: {
    fontSize: 13,
    marginTop: 8,
  },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
    gap: 14,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 22,
  },
  profileLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  profileName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  profileSub: {
    fontSize: 12,
    marginTop: 2,
  },
  arrowIcon: {
    fontSize: 22,
    fontWeight: 'bold',
  },

  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
    gap: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingColumn: {
    gap: 8,
  },
  settingLabel: {
    fontSize: 14,
  },
  themeToggleRow: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
  },
  themeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  themeBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  colorsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  colorCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    opacity: 0.7,
  },
  selectedColorCircle: {
    opacity: 1,
    borderWidth: 2,
    transform: [{ scale: 1.1 }],
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalInner: {
    flex: 1,
    justifyContent: 'flex-end',
    width: '100%',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    borderWidth: 1,
    maxHeight: '80%',
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#374151',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    marginBottom: 6,
  },
  textInput: {
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 20,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelBtnText: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  saveBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: {
    fontWeight: 'bold',
    fontSize: 15,
  },
});