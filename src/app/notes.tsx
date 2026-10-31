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
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useApp, type NoteItem } from '../context/AppContext';
import ScreenWrapper from '../components/ScreenWrapper';
import { getLocalDateString } from '../utils/date';

const CATEGORIES = ['Всі', 'Особисті', 'Робочі', 'Ідеї', 'Інше'];

export default function NotesScreen() {
  const {
    notes,
    addNote,
    updateNote,
    deleteNote,
    togglePinNote,
    theme,
    accentColor,
  } = useApp();

  const isDark = theme === 'dark';
  const ACCENT = accentColor || '#38bdf8';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Всі');

  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [selectedNote, setSelectedNote] = useState<NoteItem | null>(null);

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('Особисті');

  const textColor = isDark ? '#ffffff' : '#09090b';
  const subTextColor = isDark ? '#a1a1aa' : '#71717a';
  const cardBg = isDark ? '#121216' : '#ffffff';
  const cardBorder = isDark ? ACCENT : '#e4e4e7';
  const innerCardBg = isDark ? '#18181b' : '#f4f4f5';

  const openCreateModal = () => {
    setEditingNoteId(null);
    setTitle('');
    setBody('');
    setCategory('Особисті');
    setFormModalVisible(true);
  };

  const openEditModal = (note: NoteItem) => {
    setViewModalVisible(false);
    setEditingNoteId(note.id);
    setTitle(note.title);
    setBody(note.body);
    setCategory(note.tags[0] || 'Особисті');
    setFormModalVisible(true);
  };

  const openViewModal = (note: NoteItem) => {
    setSelectedNote(note);
    setViewModalVisible(true);
  };

  const handleSaveNote = () => {
    if (!title.trim() && !body.trim()) return;

    if (editingNoteId) {
      updateNote(editingNoteId, {
        title: title.trim() || 'Без назви',
        body: body.trim(),
        tags: [category],
      });
    } else {
      addNote({
        title: title.trim() || 'Без назви',
        body: body.trim(),
        tags: [category],
        pinned: false,
        linkedDate: getLocalDateString(),
      });
    }

    setTitle('');
    setBody('');
    setEditingNoteId(null);
    setFormModalVisible(false);
    Keyboard.dismiss();
  };

  const handleDelete = (id: string) => {
    deleteNote(id);
    setViewModalVisible(false);
    setSelectedNote(null);
  };

  const filteredNotes = notes.filter((note) => {
    const query = searchQuery.toLowerCase();

    const matchesSearch =
      note.title.toLowerCase().includes(query) ||
      note.body.toLowerCase().includes(query);

    const matchesCategory =
      selectedCategory === 'Всі' ||
      note.tags.includes(selectedCategory);

    return matchesSearch && matchesCategory;
  });

  return (
    <ScreenWrapper>
      {/* Єдиний заголовок бренду */}
      <View style={styles.brandHeader}>
        <Text style={[styles.brandTitle, { color: textColor }]}>
          TIX
        </Text>
        <Text style={styles.brandTagline}>
          ТВІЙ ЧАС ПІД КОНТРОЛЕМ
        </Text>
        <Text style={[styles.pageSubtitle, { color: subTextColor }]}>
          Особисті записи, робочі думки та ідеї
        </Text>
      </View>

      <View
        style={[
          styles.searchBox,
          { backgroundColor: cardBg, borderColor: cardBorder },
        ]}
      >
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={[styles.searchInput, { color: textColor }]}
          placeholder="Пошук нотаток..."
          placeholderTextColor="#71717a"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat;

          return (
            <TouchableOpacity
              key={cat}
              style={[
                styles.filterChip,
                { backgroundColor: cardBg, borderColor: cardBorder },
                isActive && {
                  backgroundColor: ACCENT,
                  borderColor: ACCENT,
                },
              ]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: subTextColor },
                  isActive && styles.filterTextActive,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.notesList}>
        {filteredNotes.length > 0 ? (
          filteredNotes.map((note) => (
            <TouchableOpacity
              key={note.id}
              activeOpacity={0.8}
              onPress={() => openViewModal(note)}
              style={[
                styles.noteCard,
                { backgroundColor: cardBg, borderColor: cardBorder },
              ]}
            >
              <View style={styles.noteCardHeader}>
                <View style={styles.noteTitleRow}>
                  {note.pinned && (
                    <Text style={styles.pinIcon}>📌</Text>
                  )}
                  <Text
                    style={[styles.noteTitle, { color: textColor }]}
                  >
                    {note.title}
                  </Text>
                </View>

                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={
                    note.pinned
                      ? 'Відкріпити нотатку'
                      : 'Закріпити нотатку'
                  }
                  onPress={(event) => {
                    event.stopPropagation();
                    togglePinNote(note.id);
                  }}
                >
                  <Text style={styles.actionIcon}>
                    {note.pinned ? '⭐' : '☆'}
                  </Text>
                </TouchableOpacity>
              </View>

              {note.body ? (
                <Text
                  style={[styles.noteBody, { color: subTextColor }]}
                  numberOfLines={2}
                >
                  {note.body}
                </Text>
              ) : null}

              <View
                style={[
                  styles.noteFooter,
                  {
                    borderTopColor: isDark
                      ? '#1e1e24'
                      : '#f4f4f5',
                  },
                ]}
              >
                <Text style={styles.noteDate}>
                  {note.linkedDate} · {note.tags[0] || 'Загальні'}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: cardBg, borderColor: cardBorder },
            ]}
          >
            <Text style={styles.emptyText}>
              Немає нотаток за цим запитом
            </Text>
          </View>
        )}
      </View>

      {/* Вікно перегляду нотатки */}
      <Modal
        visible={viewModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setViewModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setViewModalVisible(false)}
        >
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.modalSheet,
                { backgroundColor: cardBg, borderColor: cardBorder },
              ]}
            >
              <View style={styles.dragHandle} />

              <View style={styles.viewTopRow}>
                <View style={styles.viewHeaderRow}>
                  <Text
                    style={[
                      styles.viewCategoryTag,
                      { color: ACCENT, backgroundColor: innerCardBg },
                    ]}
                  >
                    {selectedNote?.tags[0] || 'Загальні'}
                  </Text>

                  <Text
                    style={[styles.viewDateText, { color: subTextColor }]}
                  >
                    {selectedNote?.linkedDate}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.closeIconBtn,
                    { backgroundColor: innerCardBg },
                  ]}
                  onPress={() => setViewModalVisible(false)}
                >
                  <Text style={[styles.closeIconText, { color: textColor }]}>
                    ✕
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 16 }}
              >
                <Text style={[styles.viewTitle, { color: textColor }]}>
                  {selectedNote?.title}
                </Text>

                <Text style={[styles.viewBody, { color: textColor }]}>
                  {selectedNote?.body || 'Текст нотатки відсутній'}
                </Text>
              </ScrollView>

              <View
                style={[
                  styles.viewActionsRow,
                  {
                    borderTopColor: isDark
                      ? '#1e1e24'
                      : '#f4f4f5',
                  },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.actionButtonOutline,
                    { backgroundColor: innerCardBg, borderColor: cardBorder },
                  ]}
                  onPress={() =>
                    selectedNote && handleDelete(selectedNote.id)
                  }
                >
                  <Text style={styles.deleteButtonText}>
                    🗑️ Видалити
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionButtonFilled,
                    { backgroundColor: ACCENT },
                  ]}
                  onPress={() =>
                    selectedNote && openEditModal(selectedNote)
                  }
                >
                  <Text
                    style={[
                      styles.editButtonText,
                      { color: isDark ? '#071012' : '#ffffff' },
                    ]}
                  >
                    ✎ Редагувати
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* Вікно створення та редагування */}
      <Modal
        visible={formModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFormModalVisible(false)}
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
                  { backgroundColor: cardBg, borderColor: cardBorder },
                ]}
              >
                <View style={styles.dragHandle} />

                <Text style={[styles.sheetTitle, { color: textColor }]}>
                  {editingNoteId ? 'Редагувати нотатку' : 'Нова нотатка'}
                </Text>

                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Заголовок</Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        {
                          backgroundColor: innerCardBg,
                          color: textColor,
                          borderColor: cardBorder,
                        },
                      ]}
                      placeholder="Наприклад: Ідеї для проєкту"
                      placeholderTextColor="#71717a"
                      value={title}
                      onChangeText={setTitle}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Категорія</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8 }}
                    >
                      {['Особисті', 'Робочі', 'Ідеї', 'Інше'].map((cat) => (
                        <TouchableOpacity
                          key={cat}
                          style={[
                            styles.modalCatChip,
                            {
                              backgroundColor: innerCardBg,
                              borderColor: cardBorder,
                            },
                            category === cat && {
                              backgroundColor: ACCENT,
                              borderColor: ACCENT,
                            },
                          ]}
                          onPress={() => setCategory(cat)}
                        >
                          <Text
                            style={[
                              styles.modalCatText,
                              { color: subTextColor },
                              category === cat && styles.modalCatTextActive,
                            ]}
                          >
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Текст нотатки</Text>
                    <TextInput
                      style={[
                        styles.textInput,
                        styles.textArea,
                        {
                          backgroundColor: innerCardBg,
                          color: textColor,
                          borderColor: cardBorder,
                        },
                      ]}
                      placeholder="Введіть текст..."
                      placeholderTextColor="#71717a"
                      multiline
                      value={body}
                      onChangeText={setBody}
                      textAlignVertical="top"
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
                        setFormModalVisible(false);
                        Keyboard.dismiss();
                      }}
                    >
                      <Text style={[styles.cancelBtnText, { color: textColor }]}>
                        Скасувати
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.saveBtn, { backgroundColor: ACCENT }]}
                      onPress={handleSaveNote}
                    >
                      <Text style={styles.saveBtnText}>
                        ✓ Зберегти
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Кнопка створення нотатки */}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Створити нову нотатку"
        style={[
          styles.floatingAddButton,
          { backgroundColor: ACCENT },
        ]}
        onPress={openCreateModal}
      >
        <Text style={styles.floatingAddButtonText}>＋</Text>
      </TouchableOpacity>
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

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    marginBottom: 14,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 46,
    fontSize: 15,
  },

  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 20,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#09090b',
    fontWeight: 'bold',
  },

  notesList: {
    gap: 12,
    paddingBottom: 80,
  },
  noteCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 8,
  },
  noteCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noteTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  pinIcon: {
    fontSize: 14,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  actionIcon: {
    fontSize: 18,
    padding: 4,
  },
  noteBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  noteFooter: {
    borderTopWidth: 1,
    paddingTop: 8,
    marginTop: 4,
  },
  noteDate: {
    color: '#71717a',
    fontSize: 11,
  },

  emptyCard: {
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
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
    maxHeight: '85%',
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

  viewTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  viewCategoryTag: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  viewDateText: {
    fontSize: 12,
  },
  closeIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIconText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  viewTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  viewBody: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
  viewActionsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  actionButtonOutline: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  deleteButtonText: {
    color: '#f87171',
    fontWeight: 'bold',
    fontSize: 15,
  },
  actionButtonFilled: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  editButtonText: {
    fontWeight: 'bold',
    fontSize: 15,
  },

  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#9ca3af',
    fontSize: 12,
    marginBottom: 6,
  },
  textInput: {
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
  },
  textArea: {
    height: 140,
    textAlignVertical: 'top',
  },

  modalCatChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  modalCatText: {
    fontSize: 13,
    fontWeight: '500',
  },
  modalCatTextActive: {
    color: '#09090b',
    fontWeight: 'bold',
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
    color: '#09090b',
    fontWeight: 'bold',
    fontSize: 15,
  },

  floatingAddButton: {
    position: 'absolute',
    right: 18,
    bottom: 24,
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  floatingAddButtonText: {
    color: '#09090b',
    fontSize: 30,
    fontWeight: 'bold',
    marginTop: -2,
  },
});