import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

type WeatherInfo = {
  city: string;
  country: string;
  temperature: string;
  description: string;
  icon: string;
  wind: string;
  humidity: string;
};

type LocationInfo = {
  city?: string;
  region?: string;
  country_name?: string;
  latitude?: number;
  longitude?: number;
};

const WEATHER_URL = 'https://wttr.in';

const WEATHER_CODES: Record<string, { description: string; icon: string }> = {
  '113': { description: 'Ясно', icon: '☀️' },
  '116': { description: 'Мінлива хмарність', icon: '🌤️' },
  '119': { description: 'Хмарно', icon: '☁️' },
  '122': { description: 'Суцільна хмарність', icon: '☁️' },
  '143': { description: 'Імла', icon: '🌫️' },
  '176': { description: 'Можливий дощ', icon: '🌦️' },
  '179': { description: 'Можливий сніг', icon: '🌨️' },
  '200': { description: 'Гроза', icon: '⛈️' },
  '227': { description: 'Сніг', icon: '❄️' },
  '248': { description: 'Туман', icon: '🌫️' },
  '263': { description: 'Мряка', icon: '🌧️' },
  '296': { description: 'Дощ', icon: '🌧️' },
  '302': { description: 'Сильний дощ', icon: '🌧️' },
  '308': { description: 'Злива', icon: '🌧️' },
  '323': { description: 'Сніг', icon: '🌨️' },
  '332': { description: 'Сильний сніг', icon: '❄️' },
  '353': { description: 'Короткочасний дощ', icon: '🌦️' },
  '389': { description: 'Гроза з дощем', icon: '⛈️' },
};

const WEATHER_TRANSLATIONS: Record<string, string> = {
  Sunny: 'Сонячно',
  Clear: 'Ясно',
  'Partly cloudy': 'Мінлива хмарність',
  Cloudy: 'Хмарно',
  Overcast: 'Похмуро',
  Mist: 'Імла',
  Fog: 'Туман',
  Rain: 'Дощ',
  'Light rain': 'Невеликий дощ',
  'Heavy rain': 'Сильний дощ',
  Snow: 'Сніг',
  'Light snow': 'Невеликий сніг',
  Thunderstorm: 'Гроза',
  Drizzle: 'Мряка',
};

function getGreeting(hour: number): string {
  if (hour < 5) return 'Час відпочити';
  if (hour < 12) return 'Доброго ранку';
  if (hour < 18) return 'Доброго дня';
  return 'Доброго вечора';
}

function getGreetingMessage(hour: number): string {
  if (hour < 5) return 'Навіть великі плани починаються з відпочинку.';
  if (hour < 12) return 'Нехай сьогодні все складається якнайкраще.';
  if (hour < 18) return 'Час рухатися до своїх цілей крок за кроком.';
  return 'Підбиймо підсумки дня та сплануймо завтрашній.';
}

function formatMoney(amount: number, currency: string): string {
  return `${amount.toLocaleString('uk-UA', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function formatHours(hours: number): string {
  const safeHours = Math.max(0, Number(hours) || 0);
  const wholeHours = Math.floor(safeHours);
  const minutes = Math.round((safeHours - wholeHours) * 60);

  if (minutes === 60) {
    return `${wholeHours + 1} год`;
  }

  if (minutes === 0) {
    return `${wholeHours} год`;
  }

  return `${wholeHours} год ${minutes} хв`;
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('uk-UA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

async function loadWeather(): Promise<WeatherInfo> {
  let city = '';
  let country = '';

  // 1. Пробуємо визначити поточне місто за IP
  try {
    const locationResponse = await fetch('https://ipapi.co/json/', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    if (locationResponse.ok) {
      const location = (await locationResponse.json()) as LocationInfo;
      if (location.city) {
        city = location.city;
        country = location.country_name || '';
        // Зберігаємо останню успішну локацію
        await AsyncStorage.setItem('tix_last_city', city);
        if (country) await AsyncStorage.setItem('tix_last_country', country);
      }
    }
  } catch (e) {
    console.log('Помилка визначення IP-локації:', e);
  }

  // 2. Якщо IP-сервіс недоступний, беремо останнє збережене місто з пам'яті пристрою
  if (!city) {
    const savedCity = await AsyncStorage.getItem('tix_last_city');
    const savedCountry = await AsyncStorage.getItem('tix_last_country');
    if (savedCity) {
      city = savedCity;
      country = savedCountry || '';
    }
  }

  // Якщо взагалі немає жодних даних про місто (перший запуск без мережі)
  if (!city) {
    throw new Error('Не вдалося визначити розташування');
  }

  // 3. Запит даних про погоду для знайденого міста
  const weatherResponse = await fetch(
    `${WEATHER_URL}/${encodeURIComponent(city)}?format=j1`,
  );

  if (!weatherResponse.ok) {
    throw new Error('Не вдалося отримати прогноз погоди');
  }

  const weatherData = await weatherResponse.json();
  const current = weatherData?.current_condition?.[0];

  if (!current) {
    throw new Error('Дані про погоду відсутні');
  }

  const code = String(current.weatherCode || '');
  const weatherCode = WEATHER_CODES[code];

  const originalDescription = String(
    current.weatherDesc?.[0]?.value || '',
  );

  const description =
    WEATHER_TRANSLATIONS[originalDescription] ||
    weatherCode?.description ||
    originalDescription ||
    'Погода оновлюється';

  return {
    city,
    country,
    temperature: `${current.temp_C}°`,
    description,
    icon: weatherCode?.icon || '🌡️',
    wind: `${current.windspeedKmph} км/год`,
    humidity: `${current.humidity}%`,
  };
}
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    getTodayEvents,
    getMonthStats,
    currency,
    userName,
    theme,
    accentColor,
  } = useApp();

  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [weatherError, setWeatherError] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(true);

  const isDark = theme === 'dark';

  const colors = useMemo(
    () => ({
      background: isDark ? '#080B10' : '#F3F6FA',
      surface: isDark ? '#111720' : '#FFFFFF',
      surfaceAlt: isDark ? '#171F2A' : '#EAF0F7',
      border: isDark ? '#263443' : '#DCE5EF',
      text: isDark ? '#F4F8FC' : '#152333',
      muted: isDark ? '#91A0B2' : '#64758A',
      accent: accentColor || '#38BDF8',
      green: isDark ? '#55E6A5' : '#16885B',
      warning: isDark ? '#F5C66D' : '#A56A08',
    }),
    [isDark, accentColor],
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;

    const refreshWeather = async () => {
      setWeatherLoading(true);
      setWeatherError(false);

      try {
        const result = await loadWeather();

        if (active) {
          setWeather(result);
          setWeatherError(false);
        }
      } catch {
        if (active) {
          setWeather(null);
          setWeatherError(true);
        }
      } finally {
        if (active) {
          setWeatherLoading(false);
        }
      }
    };

    void refreshWeather();

    return () => {
      active = false;
    };
  }, []);

  const todayEvents = getTodayEvents();
  const monthStats = getMonthStats();

  const greeting = getGreeting(currentTime.getHours());
  const greetingMessage = getGreetingMessage(currentTime.getHours());

  const dateLabel = formatDate(currentTime);
  const monthLabel = currentTime.toLocaleDateString('uk-UA', {
    month: 'long',
    year: 'numeric',
  });

  const completedShifts = todayEvents.filter(
    (item) => item.type === 'shift' && item.status === 'completed',
  ).length;

  const nextEvent = todayEvents.find((item) => {
    if (item.type === 'shift' && item.status === 'cancelled') {
      return false;
    }

    return item.time >= formatClock(currentTime).slice(0, 5);
  });

  const styles = createStyles(colors);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: Math.max(insets.top, 14) + 8 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Верхня панель */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.brand}>TIX<Text style={styles.brandDot}>.</Text></Text>
          <Text style={styles.brandCaption}>ТВІЙ ЧАС. ТВОЇ ПРАВИЛА.</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Відкрити налаштування"
          onPress={() => router.push('/settings')}
          style={({ pressed }) => [
            styles.profileButton,
            { borderColor: colors.border },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.profileInitial, { color: colors.accent }]}>
            {(userName || 'T').trim().charAt(0).toUpperCase()}
          </Text>
        </Pressable>
      </View>

      {/* Годинник і дата */}
      <View style={styles.clockSection}>
        <Text style={styles.eyebrow}>ТВІЙ ДЕНЬ · {dateLabel.toUpperCase()}</Text>

        <Text
          style={[styles.clock, { color: colors.accent }]}
          accessibilityLabel={`Поточний час ${formatClock(currentTime)}`}
        >
          {formatClock(currentTime).slice(0, 5)}
          <Text style={styles.clockSeconds}>
            {formatClock(currentTime).slice(5)}
          </Text>
        </Text>

        <View style={styles.clockFooter}>
          <View style={[styles.liveDot, { backgroundColor: colors.green }]} />
          <Text style={styles.clockFooterText}>Твій час — зараз</Text>
          <View style={styles.clockFooterLine} />
        </View>
      </View>

      {/* Привітання */}
      <View style={styles.greetingSection}>
        <Text style={styles.greetingTitle}>
          {greeting}{userName && userName !== 'Друже' ? `, ${userName}` : ''}.
        </Text>
        <Text style={styles.greetingMessage}>{greetingMessage}</Text>
      </View>

      {/* Погода */}
      <View style={styles.weatherCard}>
        <View style={styles.weatherMain}>
          <View style={styles.weatherLocation}>
            <Text style={styles.cardEyebrow}>ПОГОДА ЗАРАЗ</Text>
            <Text style={styles.weatherCity} numberOfLines={1}>
              {weatherLoading
                ? 'Визначаємо місце…'
                : weather
                  ? [weather.city, weather.country].filter(Boolean).join(', ')
                  : 'Місце перебування'}
            </Text>
            <Text style={styles.weatherDescription}>
              {weatherLoading
                ? 'Завантаження прогнозу'
                : weather
                  ? weather.description
                  : 'Погода тимчасово недоступна'}
            </Text>
          </View>

          <View style={styles.weatherTemperature}>
            {weatherLoading ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <>
                <Text style={styles.weatherIcon}>
                  {weather?.icon || '🌍'}
                </Text>
                <Text style={styles.temperature}>
                  {weather?.temperature || '—'}
                </Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.weatherDivider} />

        <View style={styles.weatherDetails}>
          <View style={styles.weatherDetail}>
            <Text style={styles.weatherDetailIcon}>↗</Text>
            <View>
              <Text style={styles.detailLabel}>Вітер</Text>
              <Text style={styles.detailValue}>{weather?.wind || '—'}</Text>
            </View>
          </View>

          <View style={styles.weatherDetail}>
            <Text style={styles.weatherDetailIcon}>◌</Text>
            <View>
              <Text style={styles.detailLabel}>Вологість</Text>
              <Text style={styles.detailValue}>{weather?.humidity || '—'}</Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Оновити погоду"
            onPress={async () => {
              setWeatherLoading(true);
              setWeatherError(false);

              try {
                const result = await loadWeather();
                setWeather(result);
              } catch {
                setWeatherError(true);
                setWeather(null);
              } finally {
                setWeatherLoading(false);
              }
            }}
            style={({ pressed }) => [
              styles.refreshButton,
              { borderColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.refreshText, { color: colors.accent }]}>
              ↻
            </Text>
          </Pressable>
        </View>

        {weatherError && (
          <Text style={styles.weatherError}>
            Перевір підключення до інтернету та спробуй оновити погоду.
          </Text>
        )}
      </View>

      {/* Статистика місяця */}
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Твій результат</Text>
          <Text style={styles.sectionSubtitle}>{monthLabel}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/work')}
          style={({ pressed }) => [
            styles.detailsButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.detailsButtonText, { color: colors.accent }]}>
            Детальніше ↗
          </Text>
        </Pressable>
      </View>

      <View style={styles.statsGrid}>
        <View style={[styles.earningsCard, { borderColor: colors.accent }]}>
          <View style={styles.statTopRow}>
            <Text style={styles.statIcon}>↗</Text>
            <Text style={styles.statPeriod}>ЗА МІСЯЦЬ</Text>
          </View>
          <Text style={styles.statLabel}>Зароблено</Text>
          <Text
            style={[styles.earningsValue, { color: colors.green }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatMoney(monthStats.totalEarnings, currency)}
          </Text>
          <Text style={styles.statFootnote}>За обліковані зміни</Text>
        </View>

        <View style={[styles.hoursCard, { borderColor: colors.border }]}>
          <View style={styles.statTopRow}>
            <Text style={styles.statIcon}>◷</Text>
            <Text style={styles.statPeriod}>ЗА МІСЯЦЬ</Text>
          </View>
          <Text style={styles.statLabel}>Відпрацьовано</Text>
          <Text
            style={[styles.hoursValue, { color: colors.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatHours(monthStats.totalHours)}
          </Text>
          <Text style={styles.statFootnote}>
            Змін: {monthStats.shiftCount}
          </Text>
        </View>
      </View>

      {/* План на сьогодні */}
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Сьогодні</Text>
          <Text style={styles.sectionSubtitle}>
            {todayEvents.length
              ? `${todayEvents.length} ${todayEvents.length === 1 ? 'запис' : todayEvents.length < 5 ? 'записи' : 'записів'} у плані`
              : 'День за твоїми правилами'}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/calendar')}
          style={({ pressed }) => [
            styles.addButton,
            { backgroundColor: colors.accent },
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.addButtonText}>＋ Додати</Text>
        </Pressable>
      </View>

      {nextEvent && (
        <View
          style={[
            styles.nextEventBanner,
            { borderLeftColor: colors.accent },
          ]}
        >
          <Text style={styles.nextEventEyebrow}>НАСТУПНИЙ ЗАПИС</Text>
          <Text style={styles.nextEventTitle} numberOfLines={1}>
            {nextEvent.title}
          </Text>
          <Text style={styles.nextEventTime}>
            {nextEvent.time || 'Час не вказано'}
            {nextEvent.endTime ? ` — ${nextEvent.endTime}` : ''}
          </Text>
        </View>
      )}

      {todayEvents.length > 0 ? (
        <View style={styles.eventsList}>
          {todayEvents.map((event) => {
            const isShift = event.type === 'shift';
            const isCancelled = isShift && event.status === 'cancelled';
            const isCompleted = isShift && event.status === 'completed';

            return (
              <Pressable
                key={event.id}
                accessibilityRole="button"
                onPress={() => router.push('/calendar')}
                style={({ pressed }) => [
                  styles.eventCard,
                  { borderColor: colors.border },
                  pressed && styles.pressed,
                ]}
              >
                <View
                  style={[
                    styles.eventAccent,
                    {
                      backgroundColor: isCancelled
                        ? colors.muted
                        : isShift
                          ? colors.accent
                          : colors.warning,
                    },
                  ]}
                />

                <View style={styles.eventTimeColumn}>
                  <Text style={styles.eventTime}>{event.time || '— —'}</Text>
                  <Text style={styles.eventEndTime}>
                    {event.endTime || ''}
                  </Text>
                </View>

                <View style={styles.eventInfo}>
                  <Text style={styles.eventTitle} numberOfLines={2}>
                    {event.title}
                  </Text>
                  <Text style={styles.eventType}>
                    {isCancelled
                      ? 'Зміну скасовано'
                      : isCompleted
                        ? 'Зміну завершено'
                        : isShift
                          ? 'Робоча зміна'
                          : 'Подія'}
                  </Text>
                </View>

                <Text style={styles.eventArrow}>›</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>◷</Text>
          <Text style={styles.emptyTitle}>Поки що вільний день</Text>
          <Text style={styles.emptyDescription}>
            Додай подію або робочу зміну — вони з’являться тут.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/calendar')}
            style={({ pressed }) => [
              styles.emptyAction,
              { borderColor: colors.accent },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.emptyActionText, { color: colors.accent }]}>
              Відкрити календар →
            </Text>
          </Pressable>
        </View>
      )}

      {/* Нижній підсумок */}
      <View style={styles.dayFooter}>
        <View style={[styles.footerDot, { backgroundColor: colors.green }]} />
        <Text style={styles.footerText}>
          Виконано змін сьогодні: {completedShifts}
        </Text>
        <View style={{ flex: 1 }} />
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/notes')}
        >
          <Text style={[styles.footerLink, { color: colors.accent }]}>
            Мої нотатки ↗
          </Text>
        </Pressable>
      </View>

      <Text style={styles.bottomBrand}>TIX · КЕРУЙ СВОЇМ ЧАСОМ</Text>
    </ScrollView>
  );
}

type Palette = {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  green: string;
  warning: string;
};

function createStyles(c: Palette) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: c.background,
    },
    content: {
      paddingHorizontal: 20,
      paddingBottom: 36,
      maxWidth: 760,
      width: '100%',
      alignSelf: 'center',
    },
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 30,
    },
    brand: {
      color: c.text,
      fontSize: 35,
      fontWeight: '900',
      letterSpacing: 3,
    },
    brandDot: {
      color: c.accent,
    },
    brandCaption: {
      marginTop: 2,
      color: c.muted,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 2,
    },
    profileButton: {
      width: 46,
      height: 46,
      borderRadius: 16,
      borderWidth: 1,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileInitial: {
      fontSize: 20,
      fontWeight: '800',
    },
    clockSection: {
      paddingVertical: 8,
      marginBottom: 24,
    },
    eyebrow: {
      color: c.muted,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
    },
    clock: {
      marginTop: 6,
      fontSize: 76,
      lineHeight: 86,
      fontWeight: '800',
      letterSpacing: -4,
      fontVariant: ['tabular-nums'],
    },
    clockSeconds: {
      fontSize: 32,
      fontWeight: '600',
      letterSpacing: -1,
    },
    clockFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 5,
      gap: 8,
    },
    liveDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    clockFooterText: {
      color: c.muted,
      fontSize: 12,
    },
    clockFooterLine: {
      flex: 1,
      height: 1,
      backgroundColor: c.border,
      marginLeft: 6,
    },
    greetingSection: {
      marginBottom: 22,
    },
    greetingTitle: {
      color: c.text,
      fontSize: 24,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    greetingMessage: {
      color: c.muted,
      fontSize: 14,
      lineHeight: 21,
      marginTop: 5,
    },
    weatherCard: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 23,
      padding: 18,
      marginBottom: 30,
    },
    weatherMain: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 82,
    },
    weatherLocation: {
      flex: 1,
      paddingRight: 10,
    },
    cardEyebrow: {
      color: c.muted,
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 1.5,
    },
    weatherCity: {
      color: c.text,
      fontSize: 17,
      fontWeight: '700',
      marginTop: 8,
    },
    weatherDescription: {
      color: c.muted,
      fontSize: 12,
      marginTop: 4,
    },
    weatherTemperature: {
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 76,
    },
    weatherIcon: {
      fontSize: 28,
    },
    temperature: {
      color: c.text,
      fontSize: 27,
      fontWeight: '800',
      marginTop: 1,
    },
    weatherDivider: {
      height: 1,
      backgroundColor: c.border,
      marginVertical: 14,
    },
    weatherDetails: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    weatherDetail: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    weatherDetailIcon: {
      color: c.accent,
      fontSize: 22,
      fontWeight: '700',
    },
    detailLabel: {
      color: c.muted,
      fontSize: 10,
    },
    detailValue: {
      color: c.text,
      fontSize: 12,
      fontWeight: '700',
      marginTop: 3,
    },
    refreshButton: {
      width: 34,
      height: 34,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    refreshText: {
      fontSize: 23,
      lineHeight: 27,
    },
    weatherError: {
      color: c.warning,
      fontSize: 11,
      lineHeight: 16,
      marginTop: 12,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    sectionTitle: {
      color: c.text,
      fontSize: 21,
      fontWeight: '800',
      letterSpacing: -0.4,
    },
    sectionSubtitle: {
      color: c.muted,
      fontSize: 12,
      marginTop: 4,
      textTransform: 'capitalize',
    },
    detailsButton: {
      paddingVertical: 8,
      paddingLeft: 8,
    },
    detailsButtonText: {
      fontSize: 12,
      fontWeight: '700',
    },
    statsGrid: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 32,
    },
    earningsCard: {
      flex: 1.15,
      minWidth: 0,
      padding: 15,
      borderRadius: 21,
      borderWidth: 1,
      backgroundColor: c.surface,
      minHeight: 158,
      justifyContent: 'space-between',
    },
    hoursCard: {
      flex: 1,
      minWidth: 0,
      padding: 15,
      borderRadius: 21,
      borderWidth: 1,
      backgroundColor: c.surface,
      minHeight: 158,
      justifyContent: 'space-between',
    },
    statTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 4,
    },
    statIcon: {
      color: c.accent,
      fontSize: 22,
      fontWeight: '700',
    },
    statPeriod: {
      color: c.muted,
      fontSize: 8,
      fontWeight: '800',
      letterSpacing: 0.7,
    },
    statLabel: {
      color: c.muted,
      fontSize: 12,
      marginTop: 12,
    },
    earningsValue: {
      fontSize: 25,
      fontWeight: '900',
      letterSpacing: -0.7,
      marginTop: 4,
    },
    hoursValue: {
      fontSize: 24,
      fontWeight: '800',
      letterSpacing: -0.7,
      marginTop: 4,
    },
    statFootnote: {
      color: c.muted,
      fontSize: 10,
      marginTop: 9,
    },
    addButton: {
      borderRadius: 12,
      paddingHorizontal: 13,
      paddingVertical: 10,
    },
    addButtonText: {
      color: '#071018',
      fontSize: 12,
      fontWeight: '800',
    },
    nextEventBanner: {
      borderLeftWidth: 3,
      backgroundColor: c.surfaceAlt,
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
    },
    nextEventEyebrow: {
      color: c.muted,
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 1.1,
    },
    nextEventTitle: {
      color: c.text,
      fontSize: 15,
      fontWeight: '800',
      marginTop: 6,
    },
    nextEventTime: {
      color: c.accent,
      fontSize: 12,
      fontWeight: '700',
      marginTop: 4,
    },
    eventsList: {
      gap: 10,
    },
    eventCard: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: 16,
      backgroundColor: c.surface,
      minHeight: 78,
      paddingVertical: 12,
      paddingHorizontal: 12,
      gap: 12,
    },
    eventAccent: {
      width: 3,
      alignSelf: 'stretch',
      borderRadius: 4,
    },
    eventTimeColumn: {
      minWidth: 48,
    },
    eventTime: {
      color: c.text,
      fontSize: 13,
      fontWeight: '800',
      fontVariant: ['tabular-nums'],
    },
    eventEndTime: {
      color: c.muted,
      fontSize: 10,
      marginTop: 4,
    },
    eventInfo: {
      flex: 1,
    },
    eventTitle: {
      color: c.text,
      fontSize: 14,
      fontWeight: '700',
    },
    eventType: {
      color: c.muted,
      fontSize: 11,
      marginTop: 5,
    },
    eventArrow: {
      color: c.muted,
      fontSize: 25,
      paddingHorizontal: 3,
    },
    emptyState: {
      alignItems: 'center',
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderStyle: 'dashed',
      borderRadius: 21,
      padding: 24,
    },
    emptyIcon: {
      color: c.accent,
      fontSize: 35,
      marginBottom: 10,
    },
    emptyTitle: {
      color: c.text,
      fontSize: 16,
      fontWeight: '800',
      textAlign: 'center',
    },
    emptyDescription: {
      color: c.muted,
      fontSize: 12,
      lineHeight: 19,
      textAlign: 'center',
      marginTop: 7,
      maxWidth: 260,
    },
    emptyAction: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 15,
      paddingVertical: 10,
      marginTop: 16,
    },
    emptyActionText: {
      fontSize: 12,
      fontWeight: '800',
    },
    dayFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 25,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    footerDot: {
      width: 6,
      height: 6,
      borderRadius: 4,
    },
    footerText: {
      color: c.muted,
      fontSize: 11,
    },
    footerLink: {
      fontSize: 11,
      fontWeight: '700',
    },
    bottomBrand: {
      textAlign: 'center',
      color: c.muted,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 2,
      marginTop: 15,
      marginBottom: 8,
    },
    pressed: {
      opacity: 0.72,
    },
  });
}