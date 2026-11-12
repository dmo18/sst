/**
 * Vendors write times in UTC inside their incident text. Operators read
 * Eastern time everywhere else in this application, so UTC times inside vendor
 * text are rewritten to Eastern for display. Only the clock time changes; the
 * vendor's wording is otherwise left alone.
 */

const EASTERN = 'America/New_York';
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH = '(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const WEEKDAY = '(?:(?:Mon|Tues?|Wed(?:nes)?|Thu(?:rs?)?|Fri|Sat(?:ur)?|Sun)(?:day)?,?\\s+)?';
const ZONE = '(?:UTC|GMT)\\b';
const CLOCK = '(\\d{1,2}):(\\d{2})(?::\\d{2})?\\s*([AaPp]\\.?[Mm]\\.?)?';

const DATED = new RegExp(`${WEEKDAY}${MONTH}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})(?:,?\\s+at\\s+|\\s+-\\s+|,\\s+|\\s+)${CLOCK}\\s*${ZONE}`, 'gi');
const ISO = /\b(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::\d{2})?(?:\.\d+)?\s*(?:Z|UTC)\b/g;
const BARE = new RegExp(`\\b${CLOCK}\\s*${ZONE}`, 'gi');

function hour24(hour: number, meridiem?: string): number {
  if (!meridiem) return hour;
  const pm = /^p/i.test(meridiem);
  return (hour % 12) + (pm ? 12 : 0);
}

function easternClock(timestamp: number): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: EASTERN, hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' }).format(new Date(timestamp));
}

function easternDateAndClock(timestamp: number): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: EASTERN, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short' }).format(new Date(timestamp));
}

function valid(hour: number, minute: number): boolean {
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

/**
 * Rewrite UTC and GMT times in vendor text to Eastern time. `reference` is the
 * time of the update the text belongs to; it supplies the date for a time
 * written without one, so the right daylight-saving offset is used.
 */
export function utcTextToEastern(text: string, reference?: string | number): string {
  if (!text || !/UTC|GMT|\dZ\b/.test(text)) return text;
  const referenceMs = typeof reference === 'number' ? reference : Date.parse(reference || '');
  const base = Number.isFinite(referenceMs) ? new Date(referenceMs) : new Date();

  return text
    .replace(DATED, (match, month: string, day: string, year: string, hour: string, minute: string, meridiem?: string) => {
      const h = hour24(Number(hour), meridiem);
      if (!valid(h, Number(minute))) return match;
      const timestamp = Date.UTC(Number(year), MONTHS.indexOf(month.slice(0, 3).toLowerCase()), Number(day), h, Number(minute));
      return Number.isFinite(timestamp) ? easternDateAndClock(timestamp) : match;
    })
    .replace(ISO, (match, year: string, month: string, day: string, hour: string, minute: string) => {
      if (!valid(Number(hour), Number(minute))) return match;
      const timestamp = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
      return Number.isFinite(timestamp) ? easternDateAndClock(timestamp) : match;
    })
    .replace(BARE, (match, hour: string, minute: string, meridiem?: string) => {
      const h = hour24(Number(hour), meridiem);
      if (!valid(h, Number(minute))) return match;
      return easternClock(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), h, Number(minute)));
    });
}
