export type PayrollPayType = 'hourly' | 'shift' | 'monthly';
export type PayrollTaxMode = 'gross' | 'net' | 'none';

export interface PayCalculation {
  baseAmount: number;
  gross: number;
  tax: number;
  net: number;
  taxPercent: number;
  taxMode: PayrollTaxMode;
}

export interface HourlyShiftInput {
  hours: number;
  breakMinutes?: number;
  rate: number;
  taxMode: PayrollTaxMode;
  taxPercent: number;
}

const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const validateNonNegative = (value: number, field: string): void => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${field} має бути невід’ємним числом.`);
  }
};

/**
 * Розрахунок Gross / податку / Net для відомої базової суми.
 *
 * gross: baseAmount — сума до податку.
 * net:   baseAmount — сума після податку.
 * none:  податок не розраховується; обидві суми однакові.
 *
 * Це приблизна модель, а не офіційний податковий розрахунок.
 */
export function calculatePay(
  baseAmount: number,
  taxMode: PayrollTaxMode,
  taxPercent: number,
): PayCalculation {
  validateNonNegative(baseAmount, 'Сума');
  validateNonNegative(taxPercent, 'Відсоток податку');

  if (taxPercent >= 100) {
    throw new Error('Відсоток податку має бути меншим за 100%.');
  }

  if (!['gross', 'net', 'none'].includes(taxMode)) {
    throw new Error('Невідомий режим податку.');
  }

  let gross: number;
  let tax: number;
  let net: number;

  if (taxMode === 'gross') {
    gross = baseAmount;
    tax = roundMoney(gross * taxPercent / 100);
    net = roundMoney(gross - tax);
  } else if (taxMode === 'net') {
    net = baseAmount;
    gross = roundMoney(net / (1 - taxPercent / 100));
    tax = roundMoney(gross - net);
  } else {
    gross = baseAmount;
    tax = 0;
    net = baseAmount;
  }

  return {
    baseAmount: roundMoney(baseAmount),
    gross: roundMoney(gross),
    tax: roundMoney(tax),
    net: roundMoney(net),
    taxPercent: taxMode === 'none' ? 0 : taxPercent,
    taxMode,
  };
}

/**
 * Розрахунок погодинної зміни.
 * hours — загальна тривалість зміни в годинах ДО віднімання перерви.
 */
export function calculateHourlyShiftPay(
  input: HourlyShiftInput,
): PayCalculation & {
  totalHours: number;
  breakMinutes: number;
  paidHours: number;
  hourlyRate: number;
} {
  const {
    hours,
    breakMinutes = 0,
    rate,
    taxMode,
    taxPercent,
  } = input;

  validateNonNegative(hours, 'Тривалість зміни');
  validateNonNegative(breakMinutes, 'Перерва');
  validateNonNegative(rate, 'Ставка');

  if (breakMinutes > hours * 60) {
    throw new Error('Перерва не може бути довшою за зміну.');
  }

  const paidHours = Math.max(0, hours - breakMinutes / 60);
  const baseAmount = roundMoney(paidHours * rate);
  const calculation = calculatePay(baseAmount, taxMode, taxPercent);

  return {
    ...calculation,
    totalHours: hours,
    breakMinutes,
    paidHours: Math.round(paidHours * 10000) / 10000,
    hourlyRate: rate,
  };
}

/**
 * Сума фактичних виплат мінус нарахований дохід.
 * Позитивне значення — виплачено більше за нараховане.
 * Негативне — частина доходу ще не отримана.
 *
 * Викликати лише для сум в одній валюті та за однаковий період.
 */
export function calculatePaymentDifference(
  accruedNet: number,
  received: number,
): number {
  validateNonNegative(accruedNet, 'Нарахований дохід');
  validateNonNegative(received, 'Отримані виплати');

  return roundMoney(received - accruedNet);
}