/**
 * Formats a time the way the macOS menu bar does, for example "Sun Oct 11 9:41 AM".
 * @param currentTime - The time to show.
 * @param locale - The locale for day/month names and the clock style.
 * @returns The formatted menu bar clock text.
 */
export function formatMenuBarClock(currentTime: Date, locale = 'en-US'): string {
  const datePartsFormatter = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const timeFormatter = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' });
  const dateParts = datePartsFormatter.formatToParts(currentTime);
  /**
   * Reads one part (weekday, month or day) of the formatted date.
   * @param partType - Which part to read.
   * @returns The part's text.
   */
  const readDatePart = (partType: Intl.DateTimeFormatPartTypes): string =>
    dateParts.find((datePart) => datePart.type === partType)?.value ?? '';
  return `${readDatePart('weekday')} ${readDatePart('month')} ${readDatePart('day')} ${timeFormatter.format(currentTime)}`;
}
