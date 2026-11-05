const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function formatDateTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return Number.isNaN(date.getTime()) ? 'Unknown time' : dateTimeFormatter.format(date);
}

export function formatRelativeTime(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time';
  }

  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absolute = Math.abs(diffSeconds);
  const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

  if (absolute < 60) {
    return relative.format(diffSeconds, 'second');
  }
  if (absolute < 3600) {
    return relative.format(Math.round(diffSeconds / 60), 'minute');
  }
  if (absolute < 86_400) {
    return relative.format(Math.round(diffSeconds / 3600), 'hour');
  }
  return relative.format(Math.round(diffSeconds / 86_400), 'day');
}
