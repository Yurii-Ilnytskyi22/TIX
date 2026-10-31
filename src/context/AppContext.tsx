
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocalDateString, getLocalMonthString } from '../utils/date';
import {
  scheduleEntryNotification,
  cancelEntryNotification,
} from '../utils/notifications';

// ---------------- ТИПИ ТА ІНТЕРФЕЙСИ ----------------

export type PayType = 'hourly' | 'shift' | 'monthly';
export type TaxMode = 'net' | 'gross' | 'none';

export interface RateVersion {
  id: string;
  startDate: string;
  payType: PayType;
  rateValue: number;
  currency: string;
  taxMode: TaxMode;
  taxPercent: number;
}

export interface Workplace {
  id: string;
  name: string;
  color: string;
  defaultBreakMinutes: number;
  defaultStartTime?: string;
  defaultEndTime?: string;
  rates: RateVersion[];
}

export interface ShiftEntry {
  id: string;
  type: 'shift';
  workplaceId: string;
  title: string;
  date: string;
  time: string;
  endTime: string;
  hours: number;
  breakTime: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  actualHours?: number;
  earnings: number;
  rateUsed: number;
  reminder?: string;
  note?: string;
  grossEarnings?: number;
  taxAmount?: number;
  netEarnings?: number;
  taxPercentUsed?: number;
  taxModeUsed?: TaxMode;
  paidMinutes?: number;
  notificationId?: string;
}

export interface EventEntry {
  id: string;
  type: 'event';
  title: string;
  date: string;
  time: string;
  endTime?: string;
  reminder?: string;
  description?: string;
  notificationId?: string;
}

export type CalendarItem = ShiftEntry | EventEntry;

type NewCalendarItem =
  | Omit<ShiftEntry, 'id'>
  | Omit<EventEntry, 'id'>;

export interface PayoutItem {
  id: string;
  workplaceId: string;
  amount: number;
  currency: string;
  date: string;
  period: string;
  paymentType: 'salary' | 'advance' | 'bonus' | 'compensation' | 'other';
  note?: string;
}

export interface NoteItem {
  id: string;
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
  linkedDate?: string;
  createdAt: string;
  updatedAt: string;
}

interface AppContextType {
  entries: Record<string, CalendarItem[]>;

  addEntry: (date: string, item: NewCalendarItem) => void;
  updateEntry: (
    date: string,
    id: string,
    updated: Partial<CalendarItem>,
  ) => void;
  deleteEntry: (date: string, id: string) => void;
  getTodayEvents: () => CalendarItem[];

  getMonthStats: (yearMonth?: string) => {
    totalEarnings: number;
    grossEarnings: number;
    totalTax: number;
    totalHours: number;
    shiftCount: number;
    scheduledCount: number;
    expectedEarnings: number;
    totalPayouts: number;
    paymentDifference: number;
    unpaidBalance: number;
  };

  workplaces: Workplace[];
  addWorkplace: (wp: Omit<Workplace, 'id'>) => void;
  updateWorkplace: (
    wpId: string,
    updated: Partial<Omit<Workplace, 'id' | 'rates'>>,
  ) => void;
  updateWorkplaceRates: (wpId: string, newRate: RateVersion) => void;
  deleteWorkplace: (id: string) => void;

  payouts: PayoutItem[];
  addPayout: (payout: Omit<PayoutItem, 'id'>) => void;
  deletePayout: (id: string) => void;

  notes: NoteItem[];
  addNote: (
    note: Omit<NoteItem, 'id' | 'createdAt' | 'updatedAt'>,
  ) => void;
  updateNote: (id: string, updated: Partial<NoteItem>) => void;
  deleteNote: (id: string) => void;
  togglePinNote: (id: string) => void;

  currency: string;
  setCurrency: (curr: string) => void;

  userName: string;
  setUserName: (name: string) => void;

  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;

  accentColor: string;
  setAccentColor: (color: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [entries, setEntries] = useState<Record<string, CalendarItem[]>>({});
  const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
  const [payouts, setPayouts] = useState<PayoutItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);

  const [currency, setCurrencyState] = useState<string>('€');
  const [userName, setUserNameState] = useState<string>('Друже');
  const [theme, setThemeState] = useState<'dark' | 'light'>('dark');
  const [accentColor, setAccentColorState] = useState<string>('#38bdf8');

  // Завантаження збережених даних при старті
  useEffect(() => {
    const loadData = async () => {
      try {
        const [
          savedEntries,
          savedWorkplaces,
          savedPayouts,
          savedNotes,
          savedCurrency,
          savedUserName,
          savedTheme,
          savedAccentColor,
        ] = await Promise.all([
          AsyncStorage.getItem('tix_calendar_entries'),
          AsyncStorage.getItem('tix_workplaces'),
          AsyncStorage.getItem('tix_payouts'),
          AsyncStorage.getItem('tix_notes'),
          AsyncStorage.getItem('tix_currency'),
          AsyncStorage.getItem('tix_username'),
          AsyncStorage.getItem('tix_theme'),
          AsyncStorage.getItem('tix_accent_color'),
        ]);

        if (savedEntries) {
          setEntries(JSON.parse(savedEntries));
        }

        // Старе значення перерви 30 хвилин змінюємо на 0.
        if (savedWorkplaces) {
          const parsedWorkplaces: unknown = JSON.parse(savedWorkplaces);

          if (Array.isArray(parsedWorkplaces)) {
            const normalizedWorkplaces: Workplace[] =
              parsedWorkplaces.map((workplace: Workplace) => ({
                ...workplace,
                defaultBreakMinutes:
                  workplace.defaultBreakMinutes === 30
                    ? 0
                    : workplace.defaultBreakMinutes ?? 0,
              }));

            setWorkplaces(normalizedWorkplaces);
          } else {
            setWorkplaces([]);
          }
        }

        if (savedPayouts) {
          setPayouts(JSON.parse(savedPayouts));
        }

        if (savedNotes) {
          setNotes(JSON.parse(savedNotes));
        }

        if (savedCurrency) {
          setCurrencyState(savedCurrency);
        }

        if (savedUserName) {
          setUserNameState(savedUserName);
        }

        if (savedTheme === 'dark' || savedTheme === 'light') {
          setThemeState(savedTheme);
        }

        if (savedAccentColor) {
          setAccentColorState(savedAccentColor);
        }
      } catch (error) {
        console.error('Помилка завантаження даних TIX:', error);
      }
    };

    loadData();
  }, []);

  // ---------------- ЗБЕРЕЖЕННЯ ДАНИХ ----------------

  const saveEntries = async (
    newEntries: Record<string, CalendarItem[]>,
  ) => {
    setEntries(newEntries);

    try {
      await AsyncStorage.setItem(
        'tix_calendar_entries',
        JSON.stringify(newEntries),
      );
    } catch (error) {
      console.error('Не вдалося зберегти календар:', error);
    }
  };

  const saveWorkplaces = async (newWorkplaces: Workplace[]) => {
    setWorkplaces(newWorkplaces);

    try {
      await AsyncStorage.setItem(
        'tix_workplaces',
        JSON.stringify(newWorkplaces),
      );
    } catch (error) {
      console.error('Не вдалося зберегти місця роботи:', error);
    }
  };

  const savePayouts = async (newPayouts: PayoutItem[]) => {
    setPayouts(newPayouts);

    try {
      await AsyncStorage.setItem(
        'tix_payouts',
        JSON.stringify(newPayouts),
      );
    } catch (error) {
      console.error('Не вдалося зберегти виплати:', error);
    }
  };

  const saveNotes = async (newNotes: NoteItem[]) => {
    setNotes(newNotes);

    try {
      await AsyncStorage.setItem(
        'tix_notes',
        JSON.stringify(newNotes),
      );
    } catch (error) {
      console.error('Не вдалося зберегти нотатки:', error);
    }
  };

  const setCurrency = async (curr: string) => {
    setCurrencyState(curr);

    try {
      await AsyncStorage.setItem('tix_currency', curr);
    } catch (error) {
      console.error('Не вдалося зберегти валюту:', error);
    }
  };

  const setUserName = async (name: string) => {
    setUserNameState(name);

    try {
      await AsyncStorage.setItem('tix_username', name);
    } catch (error) {
      console.error("Не вдалося зберегти ім'я:", error);
    }
  };

  const setTheme = async (newTheme: 'dark' | 'light') => {
    setThemeState(newTheme);

    try {
      await AsyncStorage.setItem('tix_theme', newTheme);
    } catch (error) {
      console.error('Не вдалося зберегти тему:', error);
    }
  };

  const setAccentColor = async (color: string) => {
    setAccentColorState(color);

    try {
      await AsyncStorage.setItem('tix_accent_color', color);
    } catch (error) {
      console.error('Не вдалося зберегти колір:', error);
    }
  };

  // ---------------- КАЛЕНДАР ----------------

  const addEntry = (date: string, item: NewCalendarItem) => {
    const newItem = {
      ...item,
      id: Date.now().toString(),
    } as CalendarItem;

    const updated = {
      ...entries,
      [date]: [...(entries[date] || []), newItem],
    };

    void saveEntries(updated);

    void (async () => {
      const notificationId = await scheduleEntryNotification(newItem);

      if (!notificationId) return;

      const updatedItems = (updated[date] || []).map((entry) =>
        entry.id === newItem.id
          ? { ...entry, notificationId }
          : entry,
      );

      await saveEntries({
        ...updated,
        [date]: updatedItems,
      });
    })();
  };

  const updateEntry = (
    date: string,
    id: string,
    updatedFields: Partial<CalendarItem>,
  ) => {
    const dayItems = entries[date] || [];
    const oldItem = dayItems.find((item) => item.id === id);

    if (!oldItem) return;

    void (async () => {
      await cancelEntryNotification(oldItem.notificationId);

      const updatedItems = dayItems.map((item) => {
        if (item.id !== id) return item;

        return {
          ...item,
          ...updatedFields,
          type: item.type,
        } as CalendarItem;
      });

      const updatedItem = updatedItems.find((item) => item.id === id)!;
      const notificationId =
        await scheduleEntryNotification(updatedItem);

      const finalItems = updatedItems.map((item) =>
        item.id === id
          ? { ...item, notificationId }
          : item,
      );

      await saveEntries({
        ...entries,
        [date]: finalItems,
      });
    })();
  };

  const deleteEntry = (date: string, id: string) => {
    const item = (entries[date] || []).find(
      (entry) => entry.id === id,
    );

    if (item?.notificationId) {
      void cancelEntryNotification(item.notificationId);
    }

    const updated = {
      ...entries,
      [date]: (entries[date] || []).filter(
        (entry) => entry.id !== id,
      ),
    };

    void saveEntries(updated);
  };

  const getTodayEvents = (): CalendarItem[] => {
    const today = getLocalDateString();
    const todayItems = entries[today] || [];

    return [...todayItems].sort((a, b) =>
      (a.time || '').localeCompare(b.time || ''),
    );
  };

  // ---------------- СТАТИСТИКА ----------------

  const getMonthStats = (customMonth?: string) => {
    const currentMonth =
      customMonth || getLocalMonthString(new Date());

    let totalEarnings = 0;
    let grossEarnings = 0;
    let totalTax = 0;
    let expectedEarnings = 0;
    let totalHours = 0;
    let shiftCount = 0;
    let scheduledCount = 0;

    Object.entries(entries).forEach(([date, items]) => {
      if (!date.startsWith(currentMonth)) {
        return;
      }

      (items || []).forEach((item) => {
        if (item.type !== 'shift') {
          return;
        }

        if (item.status === 'completed') {
          totalHours +=
            Number(item.actualHours ?? item.hours) || 0;

          // Сумісність зі старими записами.
          const net =
            Number(item.netEarnings ?? item.earnings) || 0;

          const gross =
            Number(item.grossEarnings ?? item.earnings) || 0;

          const tax =
            Number(
              item.taxAmount ?? Math.max(0, gross - net),
            ) || 0;

          totalEarnings += net;
          grossEarnings += gross;
          totalTax += tax;
          shiftCount += 1;
        } else if (item.status === 'scheduled') {
          expectedEarnings +=
            Number(item.netEarnings ?? item.earnings) || 0;

          scheduledCount += 1;
        }
      });
    });

    // Враховуємо виплати за вибраний місяць
    // у валюті, встановленій у застосунку.
    let totalPayouts = 0;

    payouts.forEach((payout) => {
      if (
        payout.period === currentMonth &&
        payout.currency === currency
      ) {
        const amount = Number(payout.amount);

        if (Number.isFinite(amount) && amount >= 0) {
          totalPayouts += amount;
        }
      }
    });

    const roundMoney = (value: number) =>
      Math.round((value + Number.EPSILON) * 100) / 100;

    totalEarnings = roundMoney(totalEarnings);
    grossEarnings = roundMoney(grossEarnings);
    totalTax = roundMoney(totalTax);
    expectedEarnings = roundMoney(expectedEarnings);
    totalPayouts = roundMoney(totalPayouts);
    totalHours = roundMoney(totalHours);

    // Додатне значення: отримано більше за нарахований Net.
    // Від'ємне значення: отримано менше за нарахований Net.
    const paymentDifference = roundMoney(
      totalPayouts - totalEarnings,
    );

    // Сума, яку ще потрібно отримати.
    const unpaidBalance = roundMoney(
      Math.max(0, totalEarnings - totalPayouts),
    );

    return {
      totalEarnings,
      grossEarnings,
      totalTax,
      totalHours,
      shiftCount,
      scheduledCount,
      expectedEarnings,
      totalPayouts,
      paymentDifference,
      unpaidBalance,
    };
  };

  // ---------------- МІСЦЯ РОБОТИ ----------------

  const addWorkplace = (workplace: Omit<Workplace, 'id'>) => {
    const newWorkplace: Workplace = {
      ...workplace,
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    };

    void saveWorkplaces([...workplaces, newWorkplace]);
  };

  const updateWorkplace = (
    workplaceId: string,
    updatedFields: Partial<Omit<Workplace, 'id' | 'rates'>>,
  ) => {
    const updated = workplaces.map((workplace) => {
      if (workplace.id !== workplaceId) {
        return workplace;
      }

      return {
        ...workplace,
        ...updatedFields,
      };
    });

    void saveWorkplaces(updated);
  };

  const updateWorkplaceRates = (
    workplaceId: string,
    newRate: RateVersion,
  ) => {
    const updated = workplaces.map((workplace) => {
      if (workplace.id !== workplaceId) {
        return workplace;
      }

      const existingRates = Array.isArray(workplace.rates)
        ? workplace.rates
        : [];

      return {
        ...workplace,
        rates: [newRate, ...existingRates],
      };
    });

    void saveWorkplaces(updated);
  };

  // Можна видалити будь-яке місце роботи, зокрема останнє.
  // Записи календаря та історія виплат автоматично не видаляються.
  const deleteWorkplace = (id: string) => {
    void saveWorkplaces(
      workplaces.filter((workplace) => workplace.id !== id),
    );
  };

  // ---------------- ВИПЛАТИ ----------------

  const addPayout = (payout: Omit<PayoutItem, 'id'>) => {
    const newPayout: PayoutItem = {
      ...payout,
      id: Date.now().toString(),
    };

    void savePayouts([newPayout, ...payouts]);
  };

  const deletePayout = (id: string) => {
    void savePayouts(
      payouts.filter((payout) => payout.id !== id),
    );
  };

  // ---------------- НОТАТКИ ----------------

  const addNote = (
    noteData: Omit<NoteItem, 'id' | 'createdAt' | 'updatedAt'>,
  ) => {
    const nowIso = new Date().toISOString();

    const newNote: NoteItem = {
      ...noteData,
      id: Date.now().toString(),
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    void saveNotes([newNote, ...notes]);
  };

  const updateNote = (id: string, updated: Partial<NoteItem>) => {
    const updatedNotes = notes.map((note) => {
      if (note.id !== id) {
        return note;
      }

      return {
        ...note,
        ...updated,
        updatedAt: new Date().toISOString(),
      };
    });

    void saveNotes(updatedNotes);
  };

  const deleteNote = (id: string) => {
    void saveNotes(notes.filter((note) => note.id !== id));
  };

  const togglePinNote = (id: string) => {
    const updatedNotes = notes.map((note) => {
      if (note.id !== id) {
        return note;
      }

      return {
        ...note,
        pinned: !note.pinned,
      };
    });

    void saveNotes(updatedNotes);
  };

  // ---------------- CONTEXT PROVIDER ----------------

  return (
    <AppContext.Provider
      value={{
        entries,
        addEntry,
        updateEntry,
        deleteEntry,
        getTodayEvents,
        getMonthStats,

        workplaces,
        addWorkplace,
        updateWorkplace,
        updateWorkplaceRates,
        deleteWorkplace,

        payouts,
        addPayout,
        deletePayout,

        notes,
        addNote,
        updateNote,
        deleteNote,
        togglePinNote,

        currency,
        setCurrency,
        userName,
        setUserName,

        theme,
        setTheme,
        accentColor,
        setAccentColor,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }

  return context;
};
