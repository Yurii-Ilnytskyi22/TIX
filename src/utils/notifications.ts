
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { CalendarItem } from '../context/AppContext';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('calendar-reminders', {
      name: 'Нагадування календаря',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    });
  }

  const current = await Notifications.getPermissionsAsync();

  if (current.granted) return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function cancelEntryNotification(
  notificationId?: string,
): Promise<void> {
  if (!notificationId) return;

  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.warn('Не вдалося скасувати нагадування:', error);
  }
}

export async function scheduleEntryNotification(
  item: CalendarItem,
): Promise<string | undefined> {
  if (
    item.reminder === 'Без нагадування' ||
    !item.reminder ||
    item.type === 'shift' && item.status === 'cancelled'
  ) {
    return undefined;
  }

  const allowed = await requestNotificationPermission();
  if (!allowed) return undefined;

  const [year, month, day] = item.date.split('-').map(Number);
  const [hours, minutes] = item.time.split(':').map(Number);

  const eventDate = new Date(year, month - 1, day, hours, minutes);

  const reminderMinutes: Record<string, number> = {
    'За 10 хв': 10,
    'За 30 хв': 30,
    'За 1 год': 60,
  };

  const minutesBefore = reminderMinutes[item.reminder];
  if (!minutesBefore) return undefined;

  const notificationDate = new Date(
    eventDate.getTime() - minutesBefore * 60_000,
  );

  if (notificationDate.getTime() <= Date.now()) return undefined;

  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: item.type === 'shift' ? 'Нагадування про зміну' : 'Нагадування про подію',
        body: `${item.title} — початок о ${item.time}`,
        sound: 'default',
        data: {
          date: item.date,
          entryId: item.id,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: notificationDate,
        ...(Platform.OS === 'android'
          ? { channelId: 'calendar-reminders' }
          : {}),
      },
    });
  } catch (error) {
    console.warn('Не вдалося запланувати нагадування:', error);
    return undefined;
  }
}
