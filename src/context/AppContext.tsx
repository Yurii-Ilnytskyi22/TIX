
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from 'react';
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

type StorageKey =
  | 'tix_calendar_entries'
  | 'tix_workplaces'
  | 'tix_payouts'
  | 'tix_notes'
  | 'tix_currency'
  | 'tix_username'
  | 'tix_theme'
  | 'tix_accent_color';

function createId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

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

  // Актуальні значення стану для асинхронних операцій.
  const entriesRef = useRef(entries);
  const workplacesRef = useRef(workplaces);
  const payoutsRef = useRef(payouts);
  const notesRef = useRef(notes);

  const currencyRef = useRef(currency);
  const userNameRef = useRef(userName);
  const themeRef = useRef(theme);
  const accentColorRef = useRef(accentColor);

  // Черга записів: операції AsyncStorage виконуються послідовно.
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  // Не дозволяємо змінам випереджати початкове завантаження.
  const loadPromiseRef = useRef<Promise<void>>(Promise.resolve());
  const loadedRef = useRef(false);

  // Захист від застарілих операцій із нагадуваннями.
  const notificationVersionsRef = useRef<Map<string, number>>(new Map());

  const nextNotificationVersion = (key: string): number => {
    const next =
      (notificationVersionsRef.current.get(key) ?? 0) + 1;

    notificationVersionsRef.current.set(key, next);
    return next;
  };

  const isNotificationVersionCurrent = (
    key: string,
    version: number,
  ): boolean => {
    return notificationVersionsRef.current.get(key) === version;
  };

  const enqueueSave = (
    key: StorageKey,
    value: unknown,
  ): Promise<void> => {
    const serialized = JSON.stringify(value);

    const operation = saveQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        await AsyncStorage.setItem(key, serialized);
      });

    saveQueueRef.current = operation.catch((error) => {
      console.error(`Не вдалося зберегти ${key}:`, error);
    });

    return saveQueueRef.current;
  };

  const waitUntilLoaded = async (): Promise<void> => {
    await loadPromiseRef.current;
  };

  // ---------------- ЗАВАНТАЖЕННЯ ДАНИХ ----------------

  useEffect(() => {
    let mounted = true;

    const loadData = async (): Promise<void> => {
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

        if (!mounted) return;

        const parsedEntries = savedEntries
          ? JSON.parse(savedEntries)
          : {};

        const parsedWorkplaces = savedWorkplaces
          ? JSON.parse(savedWorkplaces)
          : [];

        const parsedPayouts = savedPayouts
          ? JSON.parse(savedPayouts)
          : [];

        const parsedNotes = savedNotes
          ? JSON.parse(savedNotes)
          : [];

        const safeEntries =
          parsedEntries &&
          typeof parsedEntries === 'object' &&
          !Array.isArray(parsedEntries)
            ? parsedEntries as Record<string, CalendarItem[]>
            : {};

        const safeWorkplaces: Workplace[] =
          Array.isArray(parsedWorkplaces)
            ? parsedWorkplaces.map((workplace: Workplace) => ({
                ...workplace,
                defaultBreakMinutes:
                  workplace.defaultBreakMinutes === 30
                    ? 0
                    : workplace.defaultBreakMinutes ?? 0,
                rates: Array.isArray(workplace.rates)
                  ? workplace.rates
                  : [],
              }))
            : [];

        const safePayouts: PayoutItem[] =
          Array.isArray(parsedPayouts) ? parsedPayouts : [];

        const safeNotes: NoteItem[] =
          Array.isArray(parsedNotes) ? parsedNotes : [];

        entriesRef.current = safeEntries;
        workplacesRef.current = safeWorkplaces;
        payoutsRef.current = safePayouts;
        notesRef.current = safeNotes;

        setEntries(safeEntries);
        setWorkplaces(safeWorkplaces);
        setPayouts(safePayouts);
        setNotes(safeNotes);

        if (savedCurrency) {
          currencyRef.current = savedCurrency;
          setCurrencyState(savedCurrency);
        }

        if (savedUserName) {
          userNameRef.current = savedUserName;
          setUserNameState(savedUserName);
        }

        if (savedTheme === 'dark' || savedTheme === 'light') {
          themeRef.current = savedTheme;
          setThemeState(savedTheme);
        }

        if (savedAccentColor) {
          accentColorRef.current = savedAccentColor;
          setAccentColorState(savedAccentColor);
        }
      } catch (error) {
        console.error('Помилка завантаження даних TIX:', error);
      } finally {
        loadedRef.current = true;
      }
    };

    loadPromiseRef.current = loadData();

    return () => {
      mounted = false;
    };
  }, []);

  // ---------------- ЗБЕРЕЖЕННЯ ДАНИХ ----------------

  const saveEntries = async (
    newEntries: Record<string, CalendarItem[]>,
  ): Promise<void> => {
    entriesRef.current = newEntries;
    setEntries(newEntries);
    await enqueueSave('tix_calendar_entries', newEntries);
  };

  const saveWorkplaces = async (
    newWorkplaces: Workplace[],
  ): Promise<void> => {
    workplacesRef.current = newWorkplaces;
    setWorkplaces(newWorkplaces);
    await enqueueSave('tix_workplaces', newWorkplaces);
  };

  const savePayouts = async (
    newPayouts: PayoutItem[],
  ): Promise<void> => {
    payoutsRef.current = newPayouts;
    setPayouts(newPayouts);
    await enqueueSave('tix_payouts', newPayouts);
  };

  const saveNotes = async (
    newNotes: NoteItem[],
  ): Promise<void> => {
    notesRef.current = newNotes;
    setNotes(newNotes);
    await enqueueSave('tix_notes', newNotes);
  };

  const setCurrency = (curr: string): void => {
    currencyRef.current = curr;
    setCurrencyState(curr);
    void enqueueSave('tix_currency', curr);
  };

  const setUserName = (name: string): void => {
    userNameRef.current = name;
    setUserNameState(name);
    void enqueueSave('tix_username', name);
  };

  const setTheme = (newTheme: 'dark' | 'light'): void => {
    themeRef.current = newTheme;
    setThemeState(newTheme);
    void enqueueSave('tix_theme', newTheme);
  };

  const setAccentColor = (color: string): void => {
    accentColorRef.current = color;
    setAccentColorState(color);
    void enqueueSave('tix_accent_color', color);
  };

  // ---------------- КАЛЕНДАР ----------------

  const addEntry = (date: string, item: NewCalendarItem): void => {
    void (async () => {
      await waitUntilLoaded();

      const newItem = {
        ...item,
        id: createId(),
      } as CalendarItem;

      const updated = {
        ...entriesRef.current,
        [date]: [
          ...(entriesRef.current[date] || []),
          newItem,
        ],
      };

      await saveEntries(updated);

      const key = `${date}:${newItem.id}`;
      const version = nextNotificationVersion(key);

      const notificationId =
        await scheduleEntryNotification(newItem);

      if (!notificationId) return;

      if (!isNotificationVersionCurrent(key, version)) {
        await cancelEntryNotification(notificationId);
        return;
      }

      const currentDay = entriesRef.current[date] || [];
      const stillExists = currentDay.some(
        (entry) => entry.id === newItem.id,
      );

      if (!stillExists) {
        await cancelEntryNotification(notificationId);
        return;
      }

      const finalEntries = {
        ...entriesRef.current,
        [date]: currentDay.map((entry) =>
          entry.id === newItem.id
            ? { ...entry, notificationId }
            : entry,
        ),
      };

      await saveEntries(finalEntries);
    })().catch((error) => {
      console.error('Помилка додавання запису календаря:', error);
    });
  };

  const updateEntry = (
    date: string,
    id: string,
    updatedFields: Partial<CalendarItem>,
  ): void => {
    void (async () => {
      await waitUntilLoaded();

      const dayItems = entriesRef.current[date] || [];
      const oldItem = dayItems.find((item) => item.id === id);

      if (!oldItem) return;

      const key = `${date}:${id}`;
      const version = nextNotificationVersion(key);

      const updatedItem = {
        ...oldItem,
        ...updatedFields,
        id: oldItem.id,
        type: oldItem.type,
      } as CalendarItem;

      const updatedEntries = {
        ...entriesRef.current,
        [date]: dayItems.map((item) =>
          item.id === id ? updatedItem : item,
        ),
      };

      await saveEntries(updatedEntries);

      await cancelEntryNotification(oldItem.notificationId);

      if (!isNotificationVersionCurrent(key, version)) {
        return;
      }

      const notificationId =
        await scheduleEntryNotification(updatedItem);

      if (!isNotificationVersionCurrent(key, version)) {
        if (notificationId) {
          await cancelEntryNotification(notificationId);
        }
        return;
      }

      const latestDay = entriesRef.current[date] || [];
      const latestItem = latestDay.find(
        (item) => item.id === id,
      );

      if (!latestItem) {
        if (notificationId) {
          await cancelEntryNotification(notificationId);
        }
        return;
      }

      const finalEntries = {
        ...entriesRef.current,
        [date]: latestDay.map((item) =>
          item.id === id
            ? { ...item, notificationId }
            : item,
        ),
      };

      await saveEntries(finalEntries);
    })().catch((error) => {
      console.error('Помилка оновлення запису календаря:', error);
    });
  };

  const deleteEntry = (date: string, id: string): void => {
    void (async () => {
      await waitUntilLoaded();

      const key = `${date}:${id}`;
      nextNotificationVersion(key);

      const dayItems = entriesRef.current[date] || [];
      const item = dayItems.find((entry) => entry.id === id);

      if (item?.notificationId) {
        await cancelEntryNotification(item.notificationId);
      }

      const updated = {
        ...entriesRef.current,
        [date]: dayItems.filter((entry) => entry.id !== id),
      };

      await saveEntries(updated);
    })().catch((error) => {
      console.error('Помилка видалення запису календаря:', error);
    });
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
      if (!date.startsWith(currentMonth)) return;

      (items || []).forEach((item) => {
        if (item.type !== 'shift') return;

        if (item.status === 'completed') {
          totalHours +=
            Number(item.actualHours ?? item.hours) || 0;

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

    totalEarnings = roundMoney(totalEarnings);
    grossEarnings = roundMoney(grossEarnings);
    totalTax = roundMoney(totalTax);
    expectedEarnings = roundMoney(expectedEarnings);
    totalPayouts = roundMoney(totalPayouts);
    totalHours = roundMoney(totalHours);

    const paymentDifference = roundMoney(
      totalPayouts - totalEarnings,
    );

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

  const addWorkplace = (
    workplace: Omit<Workplace, 'id'>,
  ): void => {
    void (async () => {
      await waitUntilLoaded();

      const newWorkplace: Workplace = {
        ...workplace,
        id: createId(),
      };

      await saveWorkplaces([
        ...workplacesRef.current,
        newWorkplace,
      ]);
    })().catch((error) => {
      console.error('Помилка додавання місця роботи:', error);
    });
  };

  const updateWorkplace = (
    workplaceId: string,
    updatedFields: Partial<Omit<Workplace, 'id' | 'rates'>>,
  ): void => {
    void (async () => {
      await waitUntilLoaded();

      const updated = workplacesRef.current.map((workplace) => {
        if (workplace.id !== workplaceId) return workplace;

        return {
          ...workplace,
          ...updatedFields,
        };
      });

      await saveWorkplaces(updated);
    })().catch((error) => {
      console.error('Помилка оновлення місця роботи:', error);
    });
  };

  const updateWorkplaceRates = (
    workplaceId: string,
    newRate: RateVersion,
  ): void => {
    void (async () => {
      await waitUntilLoaded();

      const updated = workplacesRef.current.map((workplace) => {
        if (workplace.id !== workplaceId) return workplace;

        const existingRates = Array.isArray(workplace.rates)
          ? workplace.rates
          : [];

        return {
          ...workplace,
          rates: [newRate, ...existingRates],
        };
      });

      await saveWorkplaces(updated);
    })().catch((error) => {
      console.error('Помилка оновлення ставок:', error);
    });
  };

  const deleteWorkplace = (id: string): void => {
    void (async () => {
      await waitUntilLoaded();

      await saveWorkplaces(
        workplacesRef.current.filter(
          (workplace) => workplace.id !== id,
        ),
      );
    })().catch((error) => {
      console.error('Помилка видалення місця роботи:', error);
    });
  };

  // ---------------- ВИПЛАТИ ----------------

  const addPayout = (
    payout: Omit<PayoutItem, 'id'>,
  ): void => {
    void (async () => {
      await waitUntilLoaded();

      const newPayout: PayoutItem = {
        ...payout,
        id: createId(),
      };

      await savePayouts([
        newPayout,
        ...payoutsRef.current,
      ]);
    })().catch((error) => {
      console.error('Помилка додавання виплати:', error);
    });
  };

  const deletePayout = (id: string): void => {
    void (async () => {
      await waitUntilLoaded();

      await savePayouts(
        payoutsRef.current.filter(
          (payout) => payout.id !== id,
        ),
      );
    })().catch((error) => {
      console.error('Помилка видалення виплати:', error);
    });
  };

  // ---------------- НОТАТКИ ----------------

  const addNote = (
    noteData: Omit<NoteItem, 'id' | 'createdAt' | 'updatedAt'>,
  ): void => {
    void (async () => {
      await waitUntilLoaded();

      const nowIso = new Date().toISOString();

      const newNote: NoteItem = {
        ...noteData,
        id: createId(),
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      await saveNotes([
        newNote,
        ...notesRef.current,
      ]);
    })().catch((error) => {
      console.error('Помилка додавання нотатки:', error);
    });
  };

  const updateNote = (
    id: string,
    updated: Partial<NoteItem>,
  ): void => {
    void (async () => {
      await waitUntilLoaded();

      const updatedNotes = notesRef.current.map((note) => {
        if (note.id !== id) return note;

        return {
          ...note,
          ...updated,
          id: note.id,
          updatedAt: new Date().toISOString(),
        };
      });

      await saveNotes(updatedNotes);
    })().catch((error) => {
      console.error('Помилка оновлення нотатки:', error);
    });
  };

  const deleteNote = (id: string): void => {
    void (async () => {
      await waitUntilLoaded();

      await saveNotes(
        notesRef.current.filter((note) => note.id !== id),
      );
    })().catch((error) => {
      console.error('Помилка видалення нотатки:', error);
    });
  };

  const togglePinNote = (id: string): void => {
    void (async () => {
      await waitUntilLoaded();

      const updatedNotes = notesRef.current.map((note) => {
        if (note.id !== id) return note;

        return {
          ...note,
          pinned: !note.pinned,
        };
      });

      await saveNotes(updatedNotes);
    })().catch((error) => {
      console.error('Помилка закріплення нотатки:', error);
    });
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
