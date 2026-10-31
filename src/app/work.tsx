import React, { useMemo, useState } from 'react';
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
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import {
  useApp,
  type PayType,
  type TaxMode,
  type RateVersion,
  type Workplace,
  type PayoutItem,
} from '../context/AppContext';
import ScreenWrapper from '../components/ScreenWrapper';
import { getLocalDateString, getLocalMonthString } from '../utils/date';

type ModalType = 'none' | 'menu' | 'workplace' | 'editWorkplace' | 'payout' | 'rate';
type PayoutType = PayoutItem['paymentType'];

const MONTHS = [
  'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень',
];

const CURRENCIES = ['€', '$', '₴'];

const PAY_TYPES: { value: PayType; label: string; unit: string }[] = [
  { value: 'hourly', label: 'Погодинна', unit: 'годину' },
  { value: 'shift', label: 'За зміну', unit: 'зміну' },
  { value: 'monthly', label: 'Місячна', unit: 'місяць' },
];

const TAX_MODES: { value: TaxMode; label: string }[] = [
  { value: 'net', label: 'Чиста сума (net)' },
  { value: 'gross', label: 'До податків (gross)' },
  { value: 'none', label: 'Без податків' },
];

const PAYOUT_TYPES: { value: PayoutType; label: string }[] = [
  { value: 'salary', label: 'Зарплата' },
  { value: 'advance', label: 'Аванс' },
  { value: 'bonus', label: 'Бонус' },
  { value: 'compensation', label: 'Компенсація' },
  { value: 'other', label: 'Інше' },
];

function formatMoney(value: number, curr: string) {
  return `${(Number(value) || 0).toLocaleString('uk-UA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${curr}`;
}

function monthLabel(monthKey: string) {
  const [yearText, monthText] = monthKey.split('-');
  const monthIndex = Number(monthText) - 1;

  if (!yearText || monthIndex < 0 || monthIndex > 11) {
    return monthKey;
  }

  return `${MONTHS[monthIndex]} ${yearText}`;
}

function getCurrentRate(
  workplace: Workplace | undefined,
  date: string,
): RateVersion | undefined {
  if (
    !workplace ||
    !Array.isArray(workplace.rates) ||
    workplace.rates.length === 0
  ) {
    return undefined;
  }

  const validRates = workplace.rates.filter(
    (rate) =>
      rate &&
      typeof rate.startDate === 'string' &&
      Number.isFinite(Number(rate.rateValue)),
  );

  const applicable = validRates
    .filter((rate) => rate.startDate <= date)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  if (applicable.length > 0) {
    return applicable[0];
  }

  return [...validRates].sort((a, b) =>
    a.startDate.localeCompare(b.startDate),
  )[0];
}

function parseAmount(value: string) {
  return Number(value.trim().replace(',', '.'));
}

export default function WorkScreen() {
  const {
    currency,
    setCurrency,
    getMonthStats,
    workplaces,
    addWorkplace,
    updateWorkplace,
    updateWorkplaceRates,
    deleteWorkplace,
    payouts,
    addPayout,
    deletePayout,
    theme,
    accentColor,
  } = useApp();

  const isDark = theme === 'dark';
  const accent = accentColor || '#38bdf8';

  const colors = useMemo(
    () => ({
      text: isDark ? '#F8FAFC' : '#111827',
      muted: isDark ? '#9CA3AF' : '#6B7280',
      card: isDark ? '#121820' : '#FFFFFF',
      inner: isDark ? '#1A2430' : '#F3F6FA',
      border: isDark ? accent : '#E1E7EF',
      divider: isDark ? '#263241' : '#E5E7EB',
      page: isDark ? '#080B10' : '#F3F6FA',
    }),
    [isDark, accent],
  );

  const [activeModal, setActiveModal] = useState<ModalType>('none');
  const [monthKey, setMonthKey] = useState(getLocalMonthString());

  // Форма нового місця роботи
  const [wpName, setWpName] = useState('');
  const [wpPayType, setWpPayType] = useState<PayType>('hourly');
  const [wpRateValue, setWpRateValue] = useState('15');
  const [wpTaxMode, setWpTaxMode] = useState<TaxMode>('net');
  const [wpTaxPercent, setWpTaxPercent] = useState('0');
  const [wpBreakMinutes, setWpBreakMinutes] = useState('0');
  const [wpStartDate, setWpStartDate] = useState(getLocalDateString());
  const [wpStartTime, setWpStartTime] = useState('');
  const [wpEndTime, setWpEndTime] = useState('');

  // Форма редагування місця роботи
  const [editWpId, setEditWpId] = useState('');
  const [editWpName, setEditWpName] = useState('');
  const [editWpBreakMinutes, setEditWpBreakMinutes] = useState('30');
  const [editWpStartTime, setEditWpStartTime] = useState('');
  const [editWpEndTime, setEditWpEndTime] = useState('');

  // Форма історії ставок
  const [rateWpId, setRateWpId] = useState('');
  const [rateValue, setRateValue] = useState('15');
  const [ratePayType, setRatePayType] = useState<PayType>('hourly');
  const [rateTaxMode, setRateTaxMode] = useState<TaxMode>('net');
  const [rateTaxPercent, setRateTaxPercent] = useState('0');
  const [rateStartDate, setRateStartDate] = useState(getLocalDateString());

  // Форма виплати
  const [payoutWpId, setPayoutWpId] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutPeriod, setPayoutPeriod] = useState(getLocalMonthString());
  const [payoutType, setPayoutType] = useState<PayoutType>('salary');
  const [payoutNote, setPayoutNote] = useState('');
  const [payoutDate, setPayoutDate] = useState(getLocalDateString());

  const stats = getMonthStats(monthKey);

  const selectedMonthPayouts = useMemo(
    () =>
      (Array.isArray(payouts)
        ? payouts.filter((p) => p.period === monthKey)
        : []
      ).sort((a, b) => b.date.localeCompare(a.date)),
    [payouts, monthKey],
  );

  const closeModal = () => {
    Keyboard.dismiss();
    setActiveModal('none');
  };

  const resetWorkplaceForm = () => {
    setWpName('');
    setWpPayType('hourly');
    setWpRateValue('15');
    setWpTaxMode('net');
    setWpTaxPercent('0');
    setWpBreakMinutes('0');
    setWpStartDate(getLocalDateString());
    setWpStartTime('');
    setWpEndTime('');
  };

  const openPayoutModal = () => {
    setPayoutWpId(workplaces[0]?.id ?? '');
    setPayoutAmount('');
    setPayoutPeriod(monthKey);
    setPayoutType('salary');
    setPayoutNote('');
    setPayoutDate(getLocalDateString());
    setActiveModal('payout');
  };

  const openEditWorkplaceModal = (workplace: Workplace) => {
    setEditWpId(workplace.id);
    setEditWpName(workplace.name ?? '');
    setEditWpBreakMinutes(String(workplace.defaultBreakMinutes ?? 0),);
    setEditWpStartTime(workplace.defaultStartTime ?? '');
    setEditWpEndTime(workplace.defaultEndTime ?? '');
    setActiveModal('editWorkplace');
  };

  const handleSaveWorkplaceEdit = () => {
    const workplace = workplaces.find((item) => item.id === editWpId);
    const breakMinutes = Number(editWpBreakMinutes);

    if (!workplace) {
      Alert.alert('Помилка', 'Не вдалося знайти місце роботи.');
      return;
    }
    if (!editWpName.trim()) {
      Alert.alert('Помилка', 'Введіть назву місця роботи.');
      return;
    }
    if (!Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes > 1440) {
      Alert.alert('Помилка', 'Перерва має бути цілим числом від 0 до 1440 хвилин.');
      return;
    }
    const validTime = (value: string) => value === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
    if (!validTime(editWpStartTime) || !validTime(editWpEndTime)) {
      Alert.alert('Помилка', 'Час має бути у форматі ГГ:ХХ, наприклад 08:00.');
      return;
    }

    updateWorkplace(editWpId, {
      name: editWpName.trim(),
      defaultBreakMinutes: breakMinutes,
      defaultStartTime: editWpStartTime.trim() || undefined,
      defaultEndTime: editWpEndTime.trim() || undefined,
    });
    closeModal();
  };

  const openRateModal = (workplace: Workplace) => {
    const current = getCurrentRate(workplace, getLocalDateString());

    setRateWpId(workplace.id);
    setRateValue(String(current?.rateValue ?? 15));
    setRatePayType(current?.payType ?? 'hourly');
    setRateTaxMode(current?.taxMode ?? 'net');
    setRateTaxPercent(String(current?.taxPercent ?? 0));
    setRateStartDate(getLocalDateString());
    setActiveModal('rate');
  };

  const handleSaveWorkplace = () => {
    const rate = parseAmount(wpRateValue);
    const taxPercent = parseAmount(wpTaxPercent);
    const breakMinutes = Number(wpBreakMinutes);

    if (!wpName.trim()) {
      Alert.alert('Помилка', 'Введіть назву місця роботи.');
      return;
    }

    if (!Number.isFinite(rate) || rate < 0) {
      Alert.alert('Помилка', 'Ставка має бути коректним невід’ємним числом.');
      return;
    }

    if (
      !Number.isFinite(taxPercent) ||
      taxPercent < 0 ||
      taxPercent >= 100
    ) {
      Alert.alert('Помилка', 'Податок має бути від 0 до менш ніж 100%.');
      return;
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(wpStartDate) ||
      Number.isNaN(Date.parse(`${wpStartDate}T00:00:00`))
    ) {
      Alert.alert('Помилка', 'Дата початку має бути у форматі РРРР-ММ-ДД.');
      return;
    }

    if (
      !Number.isInteger(breakMinutes) ||
      breakMinutes < 0 ||
      breakMinutes > 1440
    ) {
      Alert.alert('Помилка', 'Перерва має бути цілим числом від 0 до 1440 хвилин.');
      return;
    }

    const validTime = (value: string) => value === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
    if ((wpPayType === 'shift' || wpPayType === 'monthly') &&
      (!validTime(wpStartTime) || !validTime(wpEndTime))) {
      Alert.alert('Помилка', 'Час має бути у форматі ГГ:ХХ, наприклад 08:00.');
      return;
    }

    addWorkplace({
      name: wpName.trim(),
      color: accent,
      defaultBreakMinutes: breakMinutes,
      defaultStartTime: wpPayType === 'hourly' ? undefined : (wpStartTime.trim() || undefined),
      defaultEndTime: wpPayType === 'hourly' ? undefined : (wpEndTime.trim() || undefined),
      rates: [
        {
          id: `${Date.now()}_rate`,
          startDate: wpStartDate,
          payType: wpPayType,
          rateValue: rate,
          currency,
          taxMode: wpTaxMode,
          taxPercent: wpTaxMode === 'none' ? 0 : taxPercent,
        },
      ],
    });

    resetWorkplaceForm();
    closeModal();
  };

  const handleSaveRate = () => {
    const rate = parseAmount(rateValue);
    const taxPercent = parseAmount(rateTaxPercent);
    const workplace = workplaces.find((wp) => wp.id === rateWpId);

    if (!workplace) {
      Alert.alert('Помилка', 'Не вдалося знайти місце роботи.');
      return;
    }

    if (!Number.isFinite(rate) || rate < 0) {
      Alert.alert('Помилка', 'Ставка має бути коректним невід’ємним числом.');
      return;
    }

    if (
      !Number.isFinite(taxPercent) ||
      taxPercent < 0 ||
      taxPercent >= 100
    ) {
      Alert.alert('Помилка', 'Податок має бути від 0 до менш ніж 100%.');
      return;
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(rateStartDate) ||
      Number.isNaN(Date.parse(`${rateStartDate}T00:00:00`))
    ) {
      Alert.alert('Помилка', 'Дата початку має бути у форматі РРРР-ММ-ДД.');
      return;
    }

    const newRate: RateVersion = {
      id: `${Date.now()}_rate`,
      startDate: rateStartDate,
      payType: ratePayType,
      rateValue: rate,
      currency,
      taxMode: rateTaxMode,
      taxPercent: rateTaxMode === 'none' ? 0 : taxPercent,
    };

    updateWorkplaceRates(rateWpId, newRate);
    closeModal();
  };

  const handleSavePayout = () => {
    const amount = parseAmount(payoutAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Помилка', 'Введіть суму виплати, більшу за нуль.');
      return;
    }

    if (!/^\d{4}-\d{2}$/.test(payoutPeriod)) {
      Alert.alert('Помилка', 'Звітний період має бути у форматі РРРР-ММ.');
      return;
    }

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(payoutDate) ||
      Number.isNaN(Date.parse(`${payoutDate}T00:00:00`))
    ) {
      Alert.alert('Помилка', 'Дата виплати має бути у форматі РРРР-ММ-ДД.');
      return;
    }

    if (
      workplaces.length > 0 &&
      !workplaces.some((wp) => wp.id === payoutWpId)
    ) {
      Alert.alert('Помилка', 'Оберіть місце роботи для виплати.');
      return;
    }

    addPayout({
      workplaceId: payoutWpId || workplaces[0]?.id || '',
      amount,
      currency,
      date: payoutDate,
      period: payoutPeriod,
      paymentType: payoutType,
      note: payoutNote.trim(),
    });

    closeModal();
  };

  const shiftMonth = (offset: number) => {
    const [year, month] = monthKey.split('-').map(Number);
    const next = new Date(year, month - 1 + offset, 1);
    setMonthKey(
      `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`,
    );
  };

  const askDeleteWorkplace = (workplace: Workplace) => {
    Alert.alert(
      'Видалити місце роботи?',
      `«${workplace.name}» буде видалено зі списку.`,
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Видалити',
          style: 'destructive',
          onPress: () => deleteWorkplace(workplace.id),
        },
      ],
    );
  };

  const askDeletePayout = (id: string) => {
    Alert.alert('Видалити виплату?', 'Цю дію не можна скасувати.', [
      { text: 'Скасувати', style: 'cancel' },
      { text: 'Видалити', style: 'destructive', onPress: () => deletePayout(id) },
    ]);
  };
    const renderChoiceRow = <T extends string>(
    items: { value: T; label: string }[],
    selected: T,
    onSelect: (value: T) => void,
  ) => (
    <View style={styles.choiceWrap}>
      {items.map((item) => (
        <TouchableOpacity
          key={item.value}
          style={[
            styles.choiceButton,
            { backgroundColor: colors.inner, borderColor: colors.border },
            selected === item.value && { backgroundColor: accent, borderColor: accent },
          ]}
          onPress={() => onSelect(item.value)}
        >
          <Text
            style={{
              color: selected === item.value ? '#071018' : colors.text,
              fontWeight: '600',
              fontSize: 12,
            }}
          >
            {item.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderField = (
    label: string,
    value: string,
    onChangeText: (value: string) => void,
    options: {
      placeholder?: string;
      keyboardType?: 'default' | 'numeric' | 'decimal-pad';
      helper?: string;
    } = {},
  ) => (
    <View style={styles.inputGroup}>
      <Text style={[styles.inputLabel, { color: colors.muted }]}>{label}</Text>
      <TextInput
        style={[
          styles.textInput,
          {
            backgroundColor: colors.inner,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
        placeholder={options.placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={options.keyboardType ?? 'default'}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
      />
      {!!options.helper && (
        <Text style={[styles.helperText, { color: colors.muted }]}>
          {options.helper}
        </Text>
      )}
    </View>
  );

  const renderModalButtons = (onSave: () => void) => (
    <View style={styles.modalButtonsRow}>
      <TouchableOpacity
        style={[styles.cancelBtn, { backgroundColor: colors.inner, borderColor: colors.border }]}
        onPress={closeModal}
      >
        <Text style={[styles.cancelBtnText, { color: colors.text }]}>Скасувати</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.saveBtn, { backgroundColor: accent }]} onPress={onSave}>
        <Text style={[styles.saveBtnText, { color: '#071018' }]}>Зберегти</Text>
      </TouchableOpacity>
    </View>
  );

  const renderWorkplace = (wp: Workplace) => {
    const currentRate = getCurrentRate(wp, getLocalDateString());
    const rateUnit =
      PAY_TYPES.find((item) => item.value === currentRate?.payType)?.unit ?? 'годину';

    return (
      <View
        key={wp.id}
        style={[styles.wpItem, { backgroundColor: colors.inner, borderColor: colors.border }]}
      >
        <View style={styles.wpInfo}>
          <View style={[styles.colorMarker, { backgroundColor: wp.color || accent }]} />
          <View style={styles.wpDetails}>
            <Text style={[styles.wpName, { color: colors.text }]}>{wp.name || 'Без назви'}</Text>
            <Text style={[styles.wpSubText, { color: colors.muted }]}>
              {currentRate
                ? `${formatMoney(currentRate.rateValue, currentRate.currency || currency)} / ${rateUnit}`
                : 'Ставку не задано'}
            </Text>
          </View>
        </View>

        <View style={styles.wpActions}>
          <TouchableOpacity
            style={[styles.smallAction, { borderColor: accent }]}
            onPress={() => openEditWorkplaceModal(wp)}
          >
            <Text style={[styles.smallActionText, { color: accent }]}>Редагувати</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.smallAction, { borderColor: accent }]}
            onPress={() => openRateModal(wp)}
          >
            <Text style={[styles.smallActionText, { color: accent }]}>Ставка</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => askDeleteWorkplace(wp)}>
            <Text style={styles.deleteIcon}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <ScreenWrapper>
      <ScrollView
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
      >
        {/* Заголовок */}
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrap}>
            <Text style={[styles.brandTitle, { color: colors.text }]}>TIX</Text>
            <Text style={styles.brandTagline}>ТВІЙ ЧАС ПІД КОНТРОЛЕМ</Text>
            <Text style={[styles.brandSubtitle, { color: colors.muted }]}>
              Робота та доходи · Облік змін, ставок і виплат
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.plusMainBtn, { backgroundColor: colors.inner, borderColor: accent }]}
            onPress={() => setActiveModal('menu')}
          >
            <Text style={[styles.plusMainBtnText, { color: accent }]}>＋</Text>
          </TouchableOpacity>
        </View>

        {/* Навігація по місяцях */}
        <View style={styles.monthNav}>
          <TouchableOpacity style={[styles.monthArrow, { borderColor: colors.border }]} onPress={() => shiftMonth(-1)}>
            <Text style={[styles.monthArrowText, { color: colors.text }]}>‹</Text>
          </TouchableOpacity>
          <Text style={[styles.monthTitle, { color: colors.text }]}>{monthLabel(monthKey)}</Text>
          <TouchableOpacity style={[styles.monthArrow, { borderColor: colors.border }]} onPress={() => shiftMonth(1)}>
            <Text style={[styles.monthArrowText, { color: colors.text }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Статистика */}
        <View style={[styles.mainStatsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.mainStatsLabel, { color: colors.muted }]}>Нараховано за місяць</Text>
          <Text style={[styles.mainStatsValue, { color: colors.text }]}>
            {formatMoney(stats.totalEarnings, currency)}
          </Text>
          <Text style={[styles.mainStatsSub, { color: colors.muted }]}>Сума виконаних змін за даними календаря</Text>

          <View style={[styles.mainStatsRow, { borderTopColor: colors.divider }]}>
            <View style={styles.statMiniBox}>
              <Text style={[styles.statMiniVal, { color: accent }]}>{Number(stats.totalHours || 0)} год</Text>
              <Text style={[styles.statMiniLabel, { color: colors.muted }]}>Відпрацьовано</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.statMiniBox}>
              <Text style={[styles.statMiniVal, { color: accent }]}>{stats.shiftCount}</Text>
              <Text style={[styles.statMiniLabel, { color: colors.muted }]}>Виконано змін</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.divider }]} />
            <View style={styles.statMiniBox}>
              <Text style={[styles.statMiniVal, { color: accent }]}>{stats.scheduledCount}</Text>
              <Text style={[styles.statMiniLabel, { color: colors.muted }]}>Заплановано</Text>
            </View>
          </View>
        </View>

        {/* Gross та податки */}
        <View style={styles.doubleRow}>
          <View style={[styles.subCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.subCardLabel, { color: colors.muted }]}>Нараховано до податків (Gross)</Text>
            <Text style={[styles.subCardValue, { color: colors.text }]}>{formatMoney(stats.grossEarnings, currency)}</Text>
            <Text style={[styles.subCardSub, { color: colors.muted }]}>До утримань</Text>
          </View>
          <View style={[styles.subCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.subCardLabel, { color: colors.muted }]}>Податки та утримання</Text>
            <Text style={[styles.subCardValue, { color: '#F97316' }]}>{formatMoney(stats.totalTax, currency)}</Text>
            <Text style={[styles.subCardSub, { color: colors.muted }]}>За виконані зміни</Text>
          </View>
        </View>

        {/* Різниця виплат та залишок */}
        <View style={styles.doubleRow}>
          <View style={[styles.subCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.subCardLabel, { color: colors.muted }]}>Різниця виплат</Text>
            <Text
              style={[
                styles.subCardValue,
                {
                  color: stats.paymentDifference < 0 ? '#EF4444' : stats.paymentDifference > 0 ? '#22C55E' : colors.text,
                },
              ]}
            >
              {formatMoney(stats.paymentDifference, currency)}
            </Text>
            <Text style={[styles.subCardSub, { color: colors.muted }]}>Виплати мінус нарахований Net</Text>
          </View>

          <View style={[styles.subCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.subCardLabel, { color: colors.muted }]}>Залишок до виплати</Text>
            <Text
              style={[
                styles.subCardValue,
                { color: stats.unpaidBalance > 0 ? '#F97316' : '#22C55E' },
              ]}
            >
              {formatMoney(stats.unpaidBalance, currency)}
            </Text>
            <Text style={[styles.subCardSub, { color: colors.muted }]}>Нараховано Net мінус виплати</Text>
          </View>
        </View>

        {/* Очікуваний дохід та отримані виплати */}
        <View style={styles.doubleRow}>
          <View style={[styles.subCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.subCardLabel, { color: colors.muted }]}>Очікуваний дохід</Text>
            <Text style={[styles.subCardValue, { color: accent }]}>{formatMoney(stats.expectedEarnings, currency)}</Text>
            <Text style={[styles.subCardSub, { color: colors.muted }]}>Заплановані зміни</Text>
          </View>
          <View style={[styles.subCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.subCardLabel, { color: colors.muted }]}>Отримано виплат</Text>
            <Text style={[styles.subCardValue, { color: '#22C55E' }]}>{formatMoney(stats.totalPayouts, currency)}</Text>
            <Text style={[styles.subCardSub, { color: colors.muted }]}>За місяць у валюті застосунку</Text>
          </View>
        </View>

        {/* Основна валюта */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Основна валюта</Text>
          <View style={styles.currencyRow}>
            {CURRENCIES.map((curr) => (
              <TouchableOpacity
                key={curr}
                style={[
                  styles.currBtn,
                  { backgroundColor: colors.inner, borderColor: colors.border },
                  currency === curr && { backgroundColor: accent, borderColor: accent },
                ]}
                onPress={() => setCurrency(curr)}
              >
                <Text style={{ color: currency === curr ? '#071018' : colors.text, fontWeight: '700', fontSize: 15 }}>
                  {curr}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Місця роботи та ставки */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Місця роботи та ставки</Text>
            <TouchableOpacity
              style={[styles.addWpBtn, { backgroundColor: colors.inner, borderColor: accent }]}
              onPress={() => setActiveModal('workplace')}
            >
              <Text style={[styles.addWpBtnText, { color: accent }]}>+ Додати</Text>
            </TouchableOpacity>
          </View>
          {workplaces.length > 0 ? (
            <View style={styles.workplacesList}>{workplaces.map(renderWorkplace)}</View>
          ) : (
            <Text style={[styles.emptyText, { color: colors.muted }]}>Місць роботи ще немає.</Text>
          )}
        </View>

        {/* Фактичні виплати */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Фактичні виплати</Text>
            <TouchableOpacity
              style={[styles.addWpBtn, { backgroundColor: colors.inner, borderColor: accent }]}
              onPress={openPayoutModal}
            >
              <Text style={[styles.addWpBtnText, { color: accent }]}>+ Записати</Text>
            </TouchableOpacity>
          </View>
          {selectedMonthPayouts.length > 0 ? (
            <View style={styles.workplacesList}>
              {selectedMonthPayouts.map((payout) => {
                const wp = workplaces.find((item) => item.id === payout.workplaceId);
                return (
                  <View key={payout.id} style={[styles.wpItem, { backgroundColor: colors.inner, borderColor: colors.border }]}>
                    <View style={styles.payoutInfo}>
                      <Text style={[styles.wpName, { color: colors.text }]}>
                        {formatMoney(payout.amount, payout.currency)}
                      </Text>
                      <Text style={[styles.wpSubText, { color: colors.muted }]}>
                        {wp?.name ?? 'Місце роботи'} · {payout.date}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => askDeletePayout(payout.id)}>
                      <Text style={styles.deleteIcon}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: colors.muted }]}>За цей місяць виплат немає.</Text>
          )}
        </View>
      </ScrollView>
            {/* Швидкі дії */}
      <Modal visible={activeModal === 'menu'} transparent animationType="fade" onRequestClose={closeModal}>
        <TouchableWithoutFeedback onPress={closeModal}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.menuSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>Швидкі дії</Text>
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: colors.divider }]}
                  onPress={() => { setActiveModal('workplace'); }}
                >
                  <Text style={[styles.menuItemText, { color: colors.text }]}>💼 Додати місце роботи</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, { borderBottomColor: colors.divider }]}
                  onPress={() => { openPayoutModal(); }}
                >
                  <Text style={[styles.menuItemText, { color: colors.text }]}>💵 Записати виплату</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Модалка: Місце роботи */}
      <Modal visible={activeModal === 'workplace'} transparent animationType="slide" onRequestClose={closeModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalInner}>
              <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.dragHandle} />
                <Text style={[styles.sheetTitle, { color: colors.text }]}>Нове місце роботи</Text>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {renderField('Назва компанії', wpName, setWpName, { placeholder: 'Наприклад: Основна робота' })}
                  {renderField('Ставка', wpRateValue, setWpRateValue, { keyboardType: 'decimal-pad' })}
                  <Text style={[styles.inputLabel, { color: colors.muted }]}>Тип оплати</Text>
                  {renderChoiceRow(PAY_TYPES, wpPayType, setWpPayType)}
                  {(wpPayType === 'shift' || wpPayType === 'monthly') && (
                    <>
                      {renderField('Час початку (необов’язково)', wpStartTime, setWpStartTime, { placeholder: 'Наприклад: 08:00' })}
                      {renderField('Час завершення (необов’язково)', wpEndTime, setWpEndTime, { placeholder: 'Наприклад: 16:30' })}
                    </>
                  )}
                  <Text style={[styles.inputLabel, { color: colors.muted }]}>
                    Режим податку
                  </Text>

                  {renderChoiceRow(TAX_MODES, wpTaxMode, setWpTaxMode)}

                  {wpTaxMode !== 'none' &&
                    renderField(
                      'Відсоток податку (%)',
                      wpTaxPercent,
                      setWpTaxPercent,
                      {
                        keyboardType: 'decimal-pad',
                        placeholder: 'Наприклад: 20',
                      },
                    )}

                  {renderModalButtons(handleSaveWorkplace)}
                </ScrollView>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Модалка: Нова версія ставки */}
      <Modal visible={activeModal === 'rate'} transparent animationType="slide" onRequestClose={closeModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalInner}>
              <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.dragHandle} />
                <Text style={[styles.sheetTitle, { color: colors.text }]}>Змінити ставку</Text>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {renderField('Нова ставка', rateValue, setRateValue, { keyboardType: 'decimal-pad' })}
                  <Text style={[styles.inputLabel, { color: colors.muted }]}>Тип оплати</Text>
                  {renderChoiceRow(PAY_TYPES, ratePayType, setRatePayType)}
                  <Text style={[styles.inputLabel, { color: colors.muted }]}>Режим податку</Text>
                  {renderChoiceRow(TAX_MODES, rateTaxMode, setRateTaxMode)}
                  {rateTaxMode !== 'none' && renderField('Відсоток податку (%)', rateTaxPercent, setRateTaxPercent, { keyboardType: 'decimal-pad' })}
                  {renderField('Дата початку дії (РРРР-ММ-ДД)', rateStartDate, setRateStartDate, { placeholder: getLocalDateString(), helper: 'Попередні ставки залишаться в історії.' })}
                  {renderModalButtons(handleSaveRate)}
                </ScrollView>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Модалка: Редагування місця роботи */}
      <Modal visible={activeModal === 'editWorkplace'} transparent animationType="slide" onRequestClose={closeModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalInner}>
              <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.dragHandle} />
                <Text style={[styles.sheetTitle, { color: colors.text }]}>Редагувати місце роботи</Text>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {renderField('Назва компанії', editWpName, setEditWpName, { placeholder: 'Назва місця роботи' })}
                  {renderField('Перерва за замовчуванням (хвилини)', editWpBreakMinutes, setEditWpBreakMinutes, { keyboardType: 'numeric', placeholder: '30' })}
                  {renderField('Час початку (необов’язково)', editWpStartTime, setEditWpStartTime, { placeholder: 'Наприклад: 08:00', helper: 'Залиш порожнім, якщо час не фіксований.' })}
                  {renderField('Час завершення (необов’язково)', editWpEndTime, setEditWpEndTime, { placeholder: 'Наприклад: 16:30', helper: 'Залиш порожнім, якщо час не фіксований.' })}
                  {renderModalButtons(handleSaveWorkplaceEdit)}
                </ScrollView>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Модалка: Виплата */}
      <Modal visible={activeModal === 'payout'} transparent animationType="slide" onRequestClose={closeModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalInner}>
              <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.dragHandle} />
                <Text style={[styles.sheetTitle, { color: colors.text }]}>Записати виплату</Text>
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {renderField('Сума виплати', payoutAmount, setPayoutAmount, { keyboardType: 'decimal-pad', placeholder: '1000' })}
                  {renderField('Звітний період (РРРР-ММ)', payoutPeriod, setPayoutPeriod)}
                  {renderField('Дата виплати (РРРР-ММ-ДД)', payoutDate, setPayoutDate)}
                  <Text style={[styles.inputLabel, { color: colors.muted }]}>Тип платежу</Text>
                  {renderChoiceRow(PAYOUT_TYPES, payoutType, setPayoutType)}
                  {renderModalButtons(handleSavePayout)}
                </ScrollView>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 40, gap: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerTextWrap: { flex: 1 },
  brandTitle: { fontSize: 32, fontWeight: '900', letterSpacing: 2 },
  brandTagline: { color: '#667780', fontSize: 9, letterSpacing: 1.5, marginTop: 2 },
  brandSubtitle: { fontSize: 13, marginTop: 4 },
  plusMainBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  plusMainBtnText: { fontSize: 24, fontWeight: 'bold' },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginVertical: 4 },
  monthArrow: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  monthArrowText: { fontSize: 20, fontWeight: 'bold' },
  monthTitle: { fontSize: 16, fontWeight: 'bold' },
  mainStatsCard: { borderRadius: 20, padding: 20, borderWidth: 1 },
  mainStatsLabel: { fontSize: 13, marginBottom: 4 },
  mainStatsValue: { fontSize: 32, fontWeight: 'bold', marginBottom: 2 },
  mainStatsSub: { fontSize: 12, marginBottom: 16 },
  mainStatsRow: { flexDirection: 'row', borderTopWidth: 1, paddingTop: 14 },
  statMiniBox: { flex: 1, alignItems: 'center' },
  statMiniVal: { fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  statMiniLabel: { fontSize: 11 },
  statDivider: { width: 1 },
  doubleRow: { flexDirection: 'row', gap: 12 },
  subCard: { flex: 1, borderRadius: 16, padding: 16, borderWidth: 1, gap: 4 },
  subCardLabel: { fontSize: 12 },
  subCardValue: { fontSize: 20, fontWeight: 'bold' },
  subCardSub: { fontSize: 11 },
  card: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  currencyRow: { flexDirection: 'row', gap: 10 },
  currBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, borderWidth: 1 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  addWpBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1 },
  addWpBtnText: { fontSize: 12, fontWeight: '600' },
  workplacesList: { gap: 10, marginTop: 4 },
  wpItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1 },
  wpInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  colorMarker: { width: 12, height: 12, borderRadius: 6 },
  wpDetails: { flex: 1 },
  wpName: { fontSize: 15, fontWeight: 'bold', marginBottom: 2 },
  wpSubText: { fontSize: 12 },
  wpActions: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' },
  smallAction: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  smallActionText: { fontSize: 12, fontWeight: '600' },
  deleteIcon: { fontSize: 16, padding: 4 },
  emptyText: { fontSize: 13, textAlign: 'center', paddingVertical: 8 },
  payoutInfo: { flex: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalInner: { flex: 1, justifyContent: 'flex-end', width: '100%' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, borderWidth: 1, maxHeight: '85%' },
  menuSheet: { borderRadius: 20, padding: 20, margin: 20, borderWidth: 1, gap: 12 },
  menuItem: { paddingVertical: 12, borderBottomWidth: 1 },
  menuItemText: { fontSize: 16, fontWeight: '500' },
  dragHandle: { width: 40, height: 4, backgroundColor: '#374151', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 12, marginBottom: 6 },
  textInput: { borderRadius: 12, padding: 14, fontSize: 15, borderWidth: 1 },
  helperText: { fontSize: 11, marginTop: 4 },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  choiceButton: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
  modalButtonsRow: { flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 20 },
  cancelBtn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1 },
  cancelBtnText: { fontWeight: 'bold', fontSize: 15 },
  saveBtn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { fontWeight: 'bold', fontSize: 15 },
});