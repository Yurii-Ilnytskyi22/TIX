import DateTimePicker from '@react-native-community/datetimepicker';
import { calculateHourlyShiftPay } from '../utils/payroll';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  useApp,
  type CalendarItem,
} from '../context/AppContext';
import {
  getLocalDateString,
  parseLocalDate,
} from '../utils/date';
import ScreenWrapper from '../components/ScreenWrapper';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

const MONTHS = [
  'Січень', 'Лютий', 'Березень', 'Квітень',
  'Травень', 'Червень', 'Липень', 'Серпень',
  'Вересень', 'Жовтень', 'Листопад', 'Грудень',
];

type EntryType = 'shift' | 'event';

function timeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());

  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
}

function formatTime(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;

  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export default function CalendarScreen() {
  const {
    entries,
    addEntry,
    updateEntry,
    deleteEntry,
    currency,
    workplaces,
    accentColor,
    theme,
  } = useApp();

  const isDark = theme === 'dark';

  // Динамічні кольори та акцент
  const ACCENT = accentColor || '#38BDF8';
  const BG = isDark ? '#09090b' : '#f4f4f5';
  const PANEL = isDark ? '#121216' : '#ffffff';
  const BORDER = isDark ? ACCENT : '#e4e4e7'; // Рамки тепер використовують акцентний колір у темній темі
  const TEXT_COLOR = isDark ? '#ffffff' : '#09090b';
  const SUB_TEXT = isDark ? '#a1a1aa' : '#71717a';
  const INNER_BG = isDark ? '#18181b' : '#f4f4f5';

  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [clock, setClock] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [entryType, setEntryType] = useState<EntryType>('shift');
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('16:30');
  const [breakMinutes, setBreakMinutes] = useState('0');
  const [rate, setRate] = useState('15');
  const [reminder, setReminder] = useState('Без нагадування');
  const [error, setError] = useState('');
  const [selectedWorkplaceId, setSelectedWorkplaceId] = useState(
  workplaces[0]?.id ?? '',
);

const [showStartPicker, setShowStartPicker] = useState(false);
const [showEndPicker, setShowEndPicker] = useState(false);
  useEffect(() => {
    const updateClock = () => {
      setClock(
        new Date().toLocaleTimeString('uk-UA', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      );
    };

    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  const days = useMemo(() => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();

    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const firstOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

    const monthLength = new Date(year, month + 1, 0).getDate();
    const previousMonthLength = new Date(year, month, 0).getDate();

    const result: {
      day: number;
      date: string;
      inMonth: boolean;
    }[] = [];

    for (let i = firstOffset - 1; i >= 0; i--) {
      result.push({
        day: previousMonthLength - i,
        date: '',
        inMonth: false,
      });
    }

    for (let day = 1; day <= monthLength; day++) {
      const monthStr = String(month + 1).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      result.push({
        day,
        date: `${year}-${monthStr}-${dayStr}`,
        inMonth: true,
      });
    }

    let nextDay = 1;
    while (result.length < 42) {
      result.push({
        day: nextDay++,
        date: '',
        inMonth: false,
      });
    }

    return result;
  }, [monthDate]);

  const selectedItems = useMemo(
    () =>
      [...(entries[selectedDate] || [])].sort((a, b) =>
        (a.time || '').localeCompare(b.time || ''),
      ),
    [entries, selectedDate],
  );

const getRateVersionForDate = (
  workplaceId?: string,
  date: string = selectedDate,
) => {
  const workplace =
    workplaces.find((item) => item.id === workplaceId) ??
    workplaces[0];

  if (!workplace) return undefined;

  const rates = Array.isArray(workplace.rates)
    ? workplace.rates.filter(
        (item) =>
          item != null &&
          typeof item.startDate === 'string' &&
          Number.isFinite(Number(item.rateValue)),
      )
    : [];

  return (
    rates
      .filter((item) => item.startDate <= date)
      .sort((a, b) => b.startDate.localeCompare(a.startDate))[0] ??
    [...rates].sort((a, b) =>
      a.startDate.localeCompare(b.startDate),
    )[0]
  );
};

const getRateForDate = (
  workplaceId?: string,
  date: string = selectedDate,
): number => {
  return Number(
    getRateVersionForDate(workplaceId, date)?.rateValue ?? 15,
  );
};

const selectedRateVersion = getRateVersionForDate(
  selectedWorkplaceId,
);

const selectedPayType = selectedRateVersion?.payType ?? 'hourly';
const isHourly = selectedPayType === 'hourly';
const isMonthly = selectedPayType === 'monthly';

  const clearForm = () => {
  const workplace = workplaces[0];

  setEditingId(null);
  setEntryType('shift');
  setSelectedWorkplaceId(workplace?.id ?? '');
  setTitle(workplace?.name ?? '');
  setStartTime('08:00');
  setEndTime('20:00');
  setBreakMinutes(
    String(workplace?.defaultBreakMinutes ?? 0),
  );
  setRate(String(getRateForDate(workplace?.id)));
  setReminder('Без нагадування');
  setError('');
  setShowStartPicker(false);
  setShowEndPicker(false);
};

  const openAdd = () => {
    clearForm();
    setModalVisible(true);
  };

const openEdit = (item: CalendarItem) => {
  setShowStartPicker(false);
  setShowEndPicker(false);

  setEditingId(item.id);
  setEntryType(item.type);
  setTitle(item.title);
  setStartTime(item.time || '08:00');
  setEndTime(item.endTime || '20:00');

  if (item.type === 'shift') {
    setSelectedWorkplaceId(item.workplaceId);
    setBreakMinutes(String(item.breakTime ?? '0'));
    setRate(String(item.rateUsed ?? 0));
  } else {
    setSelectedWorkplaceId(workplaces[0]?.id ?? '');
    setBreakMinutes('0');
    setRate(String(getRateForDate()));
  }

  setReminder(item.reminder || 'Без нагадування');
  setError('');
  setModalVisible(true);
};

  const closeModal = () => {
    Keyboard.dismiss();
    setModalVisible(false);
    clearForm();
  };

  const changeMonth = (delta: number) => {
    setMonthDate(
      (previous) =>
        new Date(
          previous.getFullYear(),
          previous.getMonth() + delta,
          1,
        ),
    );
  };

  const save = () => {
    Keyboard.dismiss();

    const cleanTitle = title.trim();
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);
    const breakValue = Number(breakMinutes);
    const rateValue = Number(rate.replace(',', '.'));
    const existingItem = selectedItems.find((item) => item.id === editingId);

    if (!cleanTitle) {
      setError(entryType === 'shift' ? 'Вкажи назву роботи.' : 'Вкажи назву події.');
      return;
    }
    if (existingItem && existingItem.type !== entryType) {
      setError('Не можна змінити тип уже створеного запису. Створи окремий запис потрібного типу.');
      return;
    }

    const needsTime = entryType === 'event' || (entryType === 'shift' && isHourly);
    if (needsTime && (start === null || end === null)) {
      setError('Вибери коректний час початку та завершення.');
      return;
    }
    if (needsTime && start === end) {
      setError('Час початку й завершення мають відрізнятися.');
      return;
    }
    if (entryType === 'shift' && !selectedWorkplaceId) {
      setError('Спочатку додай та обери місце роботи.');
      return;
    }
    if (entryType === 'shift' && (!Number.isFinite(rateValue) || rateValue < 0)) {
      setError('Вкажи коректну невід’ємну ставку.');
      return;
    }
    if (entryType === 'shift' && isHourly && (!Number.isInteger(breakValue) || breakValue < 0 || breakValue > 1440)) {
      setError('Перерва має бути цілим числом від 0 до 1440 хвилин.');
      return;
    }

    const safeStart = start ?? 480;
    const safeEnd = end ?? 960;
    let durationMinutes = safeEnd - safeStart;
    if (durationMinutes < 0) durationMinutes += 1440;
    const calculatedPaidMinutes = durationMinutes - (entryType === 'shift' && isHourly ? breakValue : 0);
    if (entryType === 'shift' && isHourly && calculatedPaidMinutes <= 0) {
      setError('Перерва має бути коротшою за тривалість зміни.');
      return;
    }

    const commonFields = {
      date: selectedDate,
      time: formatTime(safeStart),
      endTime: formatTime(safeEnd),
      reminder,
    };

    if (entryType === 'shift') {
      const workplace = workplaces.find((item) => item.id === selectedWorkplaceId);
      if (!workplace) {
        setError('Обране місце роботи не знайдено.');
        return;
      }

      const applicableRate = getRateVersionForDate(selectedWorkplaceId, selectedDate);
      const payType = applicableRate?.payType ?? 'hourly';
      const taxMode = applicableRate?.taxMode ?? 'none';
      const taxPercent = taxMode === 'none' ? 0 : Number(applicableRate?.taxPercent ?? 0);
      if (!Number.isFinite(taxPercent) || taxPercent < 0 || taxPercent >= 100) {
        setError('Податок має бути від 0 до 99,99%. Перевір налаштування ставки.');
        return;
      }

      // Для місячної зарплати нараховуємо денну частку лише один раз
      // на місце роботи за календарний день (крім скасованих змін).
      if (payType === 'monthly') {
        const duplicate = (entries[selectedDate] ?? []).some((item) =>
          item.type === 'shift' && item.id !== editingId &&
          item.workplaceId === selectedWorkplaceId && item.status !== 'cancelled'
        );
        if (duplicate) {
          setError('Для місячної оплати вже є зміна на цю дату для цього місця роботи.');
          return;
        }
      }

      let baseAmount = rateValue;
      let hours = 0;
      let paidMinutes = 0;
      let grossEarnings = 0;
      let taxAmount = 0;
      let netEarnings = 0;

      if (payType === 'hourly') {
        const calculation = calculateHourlyShiftPay({
          hours: durationMinutes / 60,
          breakMinutes: breakValue,
          rate: rateValue,
          taxMode,
          taxPercent,
        });
        hours = calculation.paidHours;
        paidMinutes = calculatedPaidMinutes;
        grossEarnings = calculation.gross;
        taxAmount = calculation.tax;
        netEarnings = calculation.net;
      } else {
        if (payType === 'monthly') {
          const [year, month] = selectedDate.split('-').map(Number);
          const daysInMonth = new Date(year, month, 0).getDate();
          let workingDays = 0;
          for (let day = 1; day <= daysInMonth; day++) {
            const weekday = new Date(year, month - 1, day).getDay();
            if (weekday >= 1 && weekday <= 5) workingDays++;
          }
          if (workingDays === 0) {
            setError('Не вдалося визначити робочі дні цього місяця.');
            return;
          }
          baseAmount = rateValue / workingDays;
        }

        if (taxMode === 'gross') {
          grossEarnings = baseAmount;
          taxAmount = baseAmount * taxPercent / 100;
          netEarnings = grossEarnings - taxAmount;
        } else if (taxMode === 'net') {
          netEarnings = baseAmount;
          grossEarnings = taxPercent === 0 ? baseAmount : baseAmount / (1 - taxPercent / 100);
          taxAmount = grossEarnings - netEarnings;
        } else {
          grossEarnings = baseAmount;
          netEarnings = baseAmount;
        }
      }

      grossEarnings = Math.round((grossEarnings + Number.EPSILON) * 100) / 100;
      taxAmount = Math.round((taxAmount + Number.EPSILON) * 100) / 100;
      netEarnings = Math.round((netEarnings + Number.EPSILON) * 100) / 100;

      const previousShift = existingItem?.type === 'shift' ? existingItem : undefined;
      const status = previousShift?.status ??
        (selectedDate < getLocalDateString() ? 'completed' : 'scheduled');

      const shift = {
        ...commonFields,
        type: 'shift' as const,
        title: workplace.name,
        workplaceId: workplace.id,
        hours,
        breakTime: payType === 'hourly' ? String(breakValue) : '0',
        rateUsed: rateValue,
        earnings: netEarnings,
        grossEarnings,
        taxAmount,
        netEarnings,
        taxPercentUsed: taxPercent,
        taxModeUsed: taxMode,
        paidMinutes,
        status,
        ...(previousShift?.actualHours !== undefined ? { actualHours: previousShift.actualHours } : {}),
        ...(previousShift?.note ? { note: previousShift.note } : {}),
      };

      if (editingId) updateEntry(selectedDate, editingId, shift);
      else addEntry(selectedDate, shift);
    } else {
      const previousEvent = existingItem?.type === 'event' ? existingItem : undefined;
      const event = {
        ...commonFields,
        type: 'event' as const,
        title: cleanTitle,
        ...(previousEvent?.description ? { description: previousEvent.description } : {}),
      };
      if (editingId) updateEntry(selectedDate, editingId, event);
      else addEntry(selectedDate, event);
    }

    setModalVisible(false);
    clearForm();
  };

  const confirmDelete = (item: CalendarItem) => {
    Alert.alert(
      'Видалити запис?',
      `Запис «${item.title}» буде видалено з календаря.`,
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Видалити',
          style: 'destructive',
          onPress: () => deleteEntry(selectedDate, item.id),
        },
      ],
    );
  };

  const selectedDateLabel = parseLocalDate(selectedDate).toLocaleDateString(
    'uk-UA',
    {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    },
  );

  const durationStart = timeToMinutes(startTime) ?? 0;
  const durationEnd = timeToMinutes(endTime) ?? 0;

  let previewMinutes = durationEnd - durationStart;
  if (previewMinutes < 0) {
    previewMinutes += 1440;
  }

  if (entryType === 'shift') {
    previewMinutes = Math.max(
      0,
      previewMinutes - (Number(breakMinutes) || 0),
    );
  }

  const previewHours = Math.floor(previewMinutes / 60);
  const previewRemainder = previewMinutes % 60;

  return (
    <ScreenWrapper>
      <View style={styles.topBar}>
        <View>
          <Text style={[styles.logo, { color: TEXT_COLOR }]}>TIX</Text>
          <Text style={styles.kicker}>ТВІЙ ЧАС ПІД КОНТРОЛЕМ</Text>
        </View>
        <Text style={[styles.clock, { color: TEXT_COLOR }]}>{clock || '00:00'}</Text>
      </View>

      <View style={[styles.calendarCard, { backgroundColor: PANEL, borderColor: BORDER }]}>
        <View style={styles.monthRow}>
          <View>
            <Text style={[styles.monthName, { color: TEXT_COLOR }]}>
              {MONTHS[monthDate.getMonth()]}
            </Text>
            <Text style={[styles.year, { color: SUB_TEXT }]}>{monthDate.getFullYear()}</Text>
          </View>

          <View style={styles.monthControls}>
            <TouchableOpacity
              accessibilityLabel="Попередній місяць"
              style={[styles.arrow, { backgroundColor: INNER_BG, borderColor: BORDER }]}
              onPress={() => changeMonth(-1)}
            >
              <Text style={[styles.arrowText, { color: ACCENT }]}>‹</Text>
            </TouchableOpacity>

            <TouchableOpacity
              accessibilityLabel="Наступний місяць"
              style={[styles.arrow, { backgroundColor: INNER_BG, borderColor: BORDER }]}
              onPress={() => changeMonth(1)}
            >
              <Text style={[styles.arrowText, { color: ACCENT }]}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.weekRow}>
          {WEEKDAYS.map((day) => (
            <Text key={day} style={[styles.weekday, { color: SUB_TEXT }]}>
              {day}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {days.map((day, index) => {
            const selected = day.date === selectedDate;
            const dayItems = day.date ? entries[day.date] || [] : [];
            const hasShift = dayItems.some((item) => item.type === 'shift');
            const hasEvent = dayItems.some((item) => item.type === 'event');
            const isToday = day.date === getLocalDateString();

            return (
              <TouchableOpacity
                key={`${day.date || 'empty'}-${index}`}
                disabled={!day.inMonth}
                onPress={() => {
                  if (day.date) {
                    setSelectedDate(day.date);
                  }
                }}
                style={styles.dayCell}
              >
                <View
                  style={[
                    styles.dayBubble,
                    isToday && { borderWidth: 1, borderColor: ACCENT },
                    selected && { backgroundColor: ACCENT, borderColor: ACCENT },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      { color: TEXT_COLOR },
                      !day.inMonth && { color: isDark ? '#39454b' : '#d4d4d8' },
                      selected && { color: isDark ? '#071018' : '#ffffff', fontWeight: '800' },
                    ]}
                  >
                    {day.day}
                  </Text>
                </View>

                <View style={styles.dots}>
                  {hasShift && (
                    <View
                      style={[styles.dot, { backgroundColor: ACCENT }]}
                    />
                  )}
                  {hasEvent && (
                    <View
                      style={[styles.dot, { backgroundColor: '#62df9b' }]}
                    />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.legend, { borderTopColor: BORDER }]}>
          <View style={[styles.dot, { backgroundColor: ACCENT }]} />
          <Text style={[styles.legendText, { color: SUB_TEXT }]}>Зміна</Text>

          <View style={[styles.dot, { backgroundColor: '#62df9b' }]} />
          <Text style={[styles.legendText, { color: SUB_TEXT }]}>Подія</Text>
        </View>
      </View>

      <View style={styles.dayHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionEyebrow}>ОБРАНИЙ ДЕНЬ</Text>
          <Text style={[styles.selectedDate, { color: TEXT_COLOR }]}>{selectedDateLabel}</Text>
        </View>

        <TouchableOpacity style={[styles.addButton, { backgroundColor: INNER_BG, borderColor: ACCENT }]} onPress={openAdd}>
          <Text style={[styles.addButtonText, { color: ACCENT }]}>＋ Додати</Text>
        </TouchableOpacity>
      </View>

      {selectedItems.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: PANEL, borderColor: BORDER }]}>
          <Text style={[styles.emptyIcon, { color: ACCENT }]}>＋</Text>
          <Text style={[styles.emptyTitle, { color: TEXT_COLOR }]}>Поки нічого не заплановано</Text>
          <Text style={[styles.emptyText, { color: SUB_TEXT }]}>
            Додай робочу зміну або подію на цей день.
          </Text>
          <TouchableOpacity onPress={openAdd}>
            <Text style={[styles.emptyAction, { color: ACCENT }]}>Створити запис →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        selectedItems.map((item) => (
          <View key={item.id} style={[styles.entryCard, { backgroundColor: PANEL, borderColor: BORDER }]}>
            <View
              style={[
                styles.entryStripe,
                {
                  backgroundColor:
                    item.type === 'shift' ? ACCENT : '#62df9b',
                },
              ]}
            />

            <View style={styles.entryBody}>
              <View style={styles.entryTop}>
                <Text style={styles.entryKind}>
                  {item.type === 'shift' ? 'РОБОЧА ЗМІНА' : 'ПОДІЯ'}
                </Text>
                <Text style={[styles.entryTime, { color: ACCENT }]}>
                  {item.time} – {item.endTime || '—'}
                </Text>
              </View>

              <Text style={[styles.entryTitle, { color: TEXT_COLOR }]}>{item.title}</Text>

              {item.type === 'shift' ? (
                <>
                  <Text style={[styles.entryDetail, { color: SUB_TEXT }]}>
                    {item.hours} год ·{' '}
                    {item.status === 'completed'
                      ? 'Виконана'
                      : item.status === 'cancelled'
                      ? 'Скасована'
                      : 'Запланована'}
                  </Text>
                  <View style={{ marginTop: 8, gap: 4 }}>
  <Text style={[styles.entryDetail, { color: SUB_TEXT }]}>
    До податку: {Number(item.grossEarnings ?? item.earnings ?? 0).toFixed(2)} {currency}
  </Text>

  <Text style={[styles.entryDetail, { color: SUB_TEXT }]}>
    Податок ({Number(item.taxPercentUsed ?? 0)}%): {Number(item.taxAmount ?? 0).toFixed(2)} {currency}
  </Text>

  <Text style={styles.earnings}>
    На руки: {Number(item.netEarnings ?? item.earnings ?? 0).toFixed(2)} {currency}
  </Text>
</View>
                </>
              ) : null}

              {item.type === 'event' && item.description ? (
                <Text style={[styles.entryDetail, { color: SUB_TEXT }]}>{item.description}</Text>
              ) : null}

              {item.reminder && item.reminder !== 'Без нагадування' ? (
                <Text style={[styles.entryDetail, { color: SUB_TEXT }]}>
                  ◷ Нагадування: {item.reminder}
                </Text>
              ) : null}

              <View style={[styles.entryActions, { borderTopColor: BORDER }]}>
                <TouchableOpacity
                  onPress={() => openEdit(item)}
                  style={styles.smallAction}
                >
                  <Text style={[styles.editText, { color: ACCENT }]}>✎ Редагувати</Text>
                </TouchableOpacity>

                {item.type === 'shift' && item.status !== 'completed' ? (
                  <TouchableOpacity
                    style={styles.smallAction}
                    onPress={() =>
                      updateEntry(selectedDate, item.id, {
                        status: 'completed',
                      })
                    }
                  >
                    <Text style={[styles.editText, { color: ACCENT }]}>✓ Виконано</Text>
                  </TouchableOpacity>
                ) : null}

                {item.type === 'shift' && item.status !== 'cancelled' ? (
                  <TouchableOpacity
                    style={styles.smallAction}
                    onPress={() =>
                      Alert.alert(
                        'Скасувати зміну?',
                        'Запис залишиться в календарі зі статусом «Скасована».',
                        [
                          { text: 'Назад', style: 'cancel' },
                          {
                            text: 'Скасувати зміну',
                            style: 'destructive',
                            onPress: () =>
                              updateEntry(selectedDate, item.id, {
                                status: 'cancelled',
                              }),
                          },
                        ],
                      )
                    }
                  >
                    <Text style={styles.deleteText}>Скасувати зміну</Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  onPress={() => confirmDelete(item)}
                  style={styles.smallAction}
                >
                  <Text style={styles.deleteText}>Видалити</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={[styles.sheet, { backgroundColor: PANEL, borderColor: BORDER }]}>
            <View style={styles.sheetHandle} />

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.sheetHeading}>
                <View>
                  <Text style={[styles.sheetTitle, { color: TEXT_COLOR }]}>
                    {editingId ? 'Редагувати запис' : 'Новий запис'}
                  </Text>
                  <Text style={[styles.sheetSubtitle, { color: SUB_TEXT }]}>
                    {parseLocalDate(selectedDate).toLocaleDateString('uk-UA', {
                      day: 'numeric',
                      month: 'long',
                    })}
                  </Text>
                </View>

                <TouchableOpacity onPress={closeModal}>
                  <Text style={[styles.close, { color: SUB_TEXT }]}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.typeSwitch, { backgroundColor: INNER_BG }]}>
                <TouchableOpacity
                  onPress={() => {
                    setEntryType('shift');
                    const workplace = workplaces.find(
                      (item) => item.id === selectedWorkplaceId,
                    ) ?? workplaces[0];

                    setTitle(workplace?.name ?? '');
                    setError('');
                  }}
                  style={[
                    styles.typeOption,
                    entryType === 'shift' && [styles.typeSelected, { backgroundColor: isDark ? '#173438' : '#e0f2fe', borderColor: ACCENT }],
                  ]}
                >
                  <Text
                    style={[
                      styles.typeText,
                      { color: SUB_TEXT },
                      entryType === 'shift' && { color: ACCENT },
                    ]}
                  >
                    💼 Зміна
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                  setEntryType('event');
                  setTitle('');
                  setError('');
                  }}
                  style={[
                    styles.typeOption,
                    entryType === 'event' && [styles.typeSelected, { backgroundColor: isDark ? '#173438' : '#e0f2fe', borderColor: ACCENT }],
                  ]}
                >
                  <Text
                    style={[
                      styles.typeText,
                      { color: SUB_TEXT },
                      entryType === 'event' && { color: ACCENT },
                    ]}
                  >
                    ◷ Подія
                  </Text>
                </TouchableOpacity>
              </View>

{entryType === 'shift' && (
  <>
    <Text style={styles.inputLabel}>МІСЦЕ РОБОТИ</Text>

    {workplaces.length === 0 ? (
      <Text style={styles.error}>
        Спочатку додай місце роботи в налаштуваннях.
      </Text>
    ) : (
      <View style={styles.reminders}>
        {workplaces.map((workplace) => {
          const active = selectedWorkplaceId === workplace.id;

          return (
            <TouchableOpacity
              key={workplace.id}
              onPress={() => {
                setSelectedWorkplaceId(workplace.id);
                setTitle(workplace.name);
                setRate(
                  String(getRateForDate(workplace.id)),
                );
                setBreakMinutes(
                  String(workplace.defaultBreakMinutes ?? 30),
                );
                setError('');
              }}
              style={[
                styles.reminderChip,
                {
                  backgroundColor: INNER_BG,
                  borderColor: active ? ACCENT : BORDER,
                },
                active && {
                  backgroundColor: isDark ? '#173438' : '#e0f2fe',
                },
              ]}
            >
              <Text
                style={{
                  color: active ? ACCENT : TEXT_COLOR,
                  fontWeight: active ? '800' : '500',
                }}
              >
                {workplace.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    )}

    <Text style={[styles.fieldHint, { color: SUB_TEXT }]}>
      Тип оплати: {
        selectedPayType === 'hourly'
          ? 'погодинна'
          : selectedPayType === 'shift'
          ? 'за зміну'
          : 'місячна'
      }
    </Text>
  </>
)}

              <Text style={styles.inputLabel}>
                {entryType === 'shift' ? 'НАЗВА РОБОТИ' : 'НАЗВА ПОДІЇ'}
              </Text>

              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={
                  entryType === 'shift'
                    ? 'Наприклад, Основна робота'
                    : 'Наприклад, Зустріч'
                }
                placeholderTextColor="#697780"
                style={[styles.input, { backgroundColor: INNER_BG, borderColor: BORDER, color: TEXT_COLOR }]}
              />

              {(entryType === 'event' || isHourly) && (
  <>
    <Text style={styles.inputLabel}>ЧАС</Text>

    <View style={styles.twoColumns}>
      <View style={styles.half}>
        <Text style={[styles.fieldHint, { color: SUB_TEXT }]}>
          Початок
        </Text>

        <TouchableOpacity
          onPress={() => {
            setShowStartPicker(true);
            setShowEndPicker(false);
          }}
          style={[
            styles.input,
            {
              backgroundColor: INNER_BG,
              borderColor: BORDER,
              justifyContent: 'center',
            },
          ]}
        >
          <Text style={{ color: TEXT_COLOR, fontSize: 15 }}>
            {startTime}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.half}>
        <Text style={[styles.fieldHint, { color: SUB_TEXT }]}>
          Завершення
        </Text>

        <TouchableOpacity
          onPress={() => {
            setShowEndPicker(true);
            setShowStartPicker(false);
          }}
          style={[
            styles.input,
            {
              backgroundColor: INNER_BG,
              borderColor: BORDER,
              justifyContent: 'center',
            },
          ]}
        >
          <Text style={{ color: TEXT_COLOR, fontSize: 15 }}>
            {endTime}
          </Text>
        </TouchableOpacity>
      </View>
    </View>

    {showStartPicker && (
  <DateTimePicker
    value={(() => {
      const date = new Date();
      const [hours, minutes] = startTime.split(':').map(Number);
      date.setHours(hours, minutes, 0, 0);
      return date;
    })()}
    mode="time"
    display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
    themeVariant={theme === 'dark' ? 'dark' : 'light'}
    textColor={theme === 'dark' ? '#ffffff' : '#09090b'}
    onValueChange={(event, date) => {
      if (Platform.OS !== 'ios') {
        setShowStartPicker(false);
      }

      if (date) {
        setStartTime(
          `${String(date.getHours()).padStart(2, '0')}:${String(
            date.getMinutes(),
          ).padStart(2, '0')}`,
        );
      }
    }}
  />
)}

{showEndPicker && (
  <DateTimePicker
    value={(() => {
      const date = new Date();
      const [hours, minutes] = endTime.split(':').map(Number);
      date.setHours(hours, minutes, 0, 0);
      return date;
    })()}
    mode="time"
    display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
    themeVariant={theme === 'dark' ? 'dark' : 'light'}
    textColor={theme === 'dark' ? '#ffffff' : '#09090b'}
    onValueChange={(event, date) => {
      if (Platform.OS !== 'ios') {
        setShowEndPicker(false);
      }

      if (date) {
        setEndTime(
          `${String(date.getHours()).padStart(2, '0')}:${String(
            date.getMinutes(),
          ).padStart(2, '0')}`,
        );
      }
    }}
  />
)}
    {showEndPicker && (
<DateTimePicker
  value={(() => {
    const date = new Date();
    const [hours, minutes] = endTime.split(':').map(Number);
    date.setHours(hours, minutes, 0, 0);
    return date;
  })()}
  mode="time"
  display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
  themeVariant={theme === 'dark' ? 'dark' : 'light'}
  textColor={theme === 'dark' ? '#ffffff' : '#09090b'}
  onValueChange={(event, date) => {
    if (Platform.OS !== 'ios') {
      setShowEndPicker(false);
    }

    if (date) {
      setEndTime(
        `${String(date.getHours()).padStart(2, '0')}:${String(
          date.getMinutes(),
        ).padStart(2, '0')}`,
      );
    }
  }}
/>
)}
  </>
)}

              {entryType === 'shift' && (
  <>
    <Text style={styles.inputLabel}>ОПЛАТА</Text>

    <View style={styles.half}>
      <Text style={[styles.fieldHint, { color: SUB_TEXT }]}>
        {isHourly
          ? `Ставка за годину (${selectedRateVersion?.currency ?? currency})`
          : isMonthly
          ? `Зарплата за місяць (${selectedRateVersion?.currency ?? currency})`
          : `Ставка за зміну (${selectedRateVersion?.currency ?? currency})`}
      </Text>

      <TextInput
        value={rate}
        onChangeText={setRate}
        placeholder={isHourly ? '15' : isMonthly ? '2000' : '20'}
        placeholderTextColor="#697780"
        keyboardType="decimal-pad"
        style={[
          styles.input,
          {
            backgroundColor: INNER_BG,
            borderColor: BORDER,
            color: TEXT_COLOR,
          },
        ]}
      />
    </View>

    {isHourly && (
      <View style={styles.half}>
        <Text style={[styles.fieldHint, { color: SUB_TEXT }]}>
          Перерва (хв)
        </Text>
        <TextInput
          value={breakMinutes}
          onChangeText={setBreakMinutes}
          placeholder="30"
          placeholderTextColor="#697780"
          keyboardType="number-pad"
          style={[
            styles.input,
            {
              backgroundColor: INNER_BG,
              borderColor: BORDER,
              color: TEXT_COLOR,
            },
          ]}
        />
      </View>
    )}

    <Text style={styles.rateHint}>
      {isHourly
        ? 'Оплата залежить від відпрацьованого часу та перерви.'
        : isMonthly
        ? 'Місячна зарплата розподіляється між робочими днями місяця.'
        : 'Ця сума нараховується за одну зміну незалежно від її тривалості.'}
    </Text>
  </>
)}

              <Text style={styles.inputLabel}>НАГАДУВАННЯ</Text>

              <View style={styles.reminders}>
                {[
                  'Без нагадування',
                  'За 10 хв',
                  'За 30 хв',
                  'За 1 год',
                ].map((value) => (
                  <TouchableOpacity
                    key={value}
                    onPress={() => setReminder(value)}
                    style={[
                      styles.reminderChip,
                      { backgroundColor: INNER_BG, borderColor: BORDER },
                      reminder === value && { backgroundColor: isDark ? '#173438' : '#e0f2fe', borderColor: ACCENT },
                    ]}
                  >
                    <Text
                      style={[
                        styles.reminderText,
                        { color: SUB_TEXT },
                        reminder === value && { color: ACCENT, fontWeight: '600' },
                      ]}
                    >
                      {value}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.durationPreview, { color: SUB_TEXT }]}>
                ⏱ Оплачувана тривалість: {previewHours} год{' '}
                {previewRemainder > 0 ? `${previewRemainder} хв` : ''}
              </Text>

              <Text style={[styles.reminderNote, { color: SUB_TEXT }]}>
                Вибір нагадування зберігається в записі. Системні сповіщення
                потребують окремого налаштування.
              </Text>

              {!!error && <Text style={styles.error}>{error}</Text>}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.cancelButton, { backgroundColor: INNER_BG, borderColor: BORDER }]}
                  onPress={closeModal}
                >
                  <Text style={[styles.cancelText, { color: TEXT_COLOR }]}>Скасувати</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.saveButton, { backgroundColor: ACCENT }]} onPress={save}>
                  <Text style={[styles.saveText, { color: isDark ? '#071012' : '#ffffff' }]}>Зберегти запис</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  logo: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 2,
  },
  kicker: {
    color: '#667780',
    fontSize: 9,
    letterSpacing: 1.5,
    marginTop: 2,
  },
  clock: {
    fontSize: 25,
    fontWeight: '800',
  },
  calendarCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    marginBottom: 24,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  monthName: {
    fontSize: 22,
    fontWeight: '800',
  },
  year: {
    fontSize: 13,
    marginTop: 2,
  },
  monthControls: {
    flexDirection: 'row',
    gap: 8,
  },
  arrow: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  arrowText: {
    fontSize: 28,
    lineHeight: 30,
  },
  weekRow: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 4,
  },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    paddingVertical: 6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 48,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 3,
  },
  dayBubble: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: {
    height: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    marginTop: 1,
  },
  dayNumber: {
    fontSize: 13,
    fontWeight: '600',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    paddingTop: 13,
    marginTop: 8,
  },
  legendText: {
    fontSize: 11,
    marginRight: 10,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  sectionEyebrow: {
    color: '#6f8189',
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: '800',
    marginBottom: 5,
  },
  selectedDate: {
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  addButton: {
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
  emptyCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 20,
    padding: 24,
    marginTop: 4,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  emptyTitle: {
    fontWeight: '800',
    fontSize: 15,
  },
  emptyText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 7,
    lineHeight: 18,
  },
  emptyAction: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 14,
  },
  entryCard: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderRadius: 17,
    marginBottom: 10,
  },
  entryStripe: {
    width: 4,
  },
  entryBody: {
    flex: 1,
    padding: 14,
  },
  entryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  entryKind: {
    color: '#7f9198',
    fontSize: 9,
    letterSpacing: 1.1,
    fontWeight: '800',
  },
  entryTime: {
    fontSize: 12,
    fontWeight: '800',
  },
  entryTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 8,
  },
  entryDetail: {
    fontSize: 12,
    marginTop: 5,
  },
  earnings: {
    color: '#62df9b',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 7,
  },
  entryActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 13,
    borderTopWidth: 1,
    paddingTop: 10,
  },
  smallAction: {
    paddingVertical: 3,
  },
  editText: {
    fontSize: 12,
    fontWeight: '700',
  },
  deleteText: {
    color: '#ff7d89',
    fontSize: 12,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.68)',
  },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    borderTopWidth: 1,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 3,
    backgroundColor: '#44545a',
    marginBottom: 18,
  },
  sheetHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '900',
  },
  sheetSubtitle: {
    fontSize: 12,
    marginTop: 4,
    textTransform: 'capitalize',
  },
  close: {
    fontSize: 22,
    padding: 6,
  },
  typeSwitch: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
    marginBottom: 20,
  },
  typeOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 11,
  },
  typeSelected: {
    borderWidth: 1,
  },
  typeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  inputLabel: {
    color: '#7f9198',
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '800',
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 16,
  },
  twoColumns: {
    flexDirection: 'row',
    gap: 12,
  },
  half: {
    flex: 1,
  },
  fieldHint: {
    fontSize: 11,
    marginBottom: 7,
  },
  rateHint: {
    color: '#778991',
    fontSize: 11,
    lineHeight: 17,
    marginTop: -8,
    marginBottom: 16,
  },
  reminders: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 16,
  },
  reminderChip: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderWidth: 1,
  },
  reminderText: {
    fontSize: 11,
    fontWeight: '600',
  },
  durationPreview: {
    textAlign: 'center',
    fontSize: 13,
    marginBottom: 12,
  },
  reminderNote: {
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 12,
  },
  error: {
    color: '#ff7d89',
    fontSize: 12,
    marginBottom: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 13,
    borderWidth: 1,
  },
  cancelText: {
    fontWeight: '800',
  },
  saveButton: {
    flex: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 13,
  },
  saveText: {
    fontWeight: '900',
  },
});