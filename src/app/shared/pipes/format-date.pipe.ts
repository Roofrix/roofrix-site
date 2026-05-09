import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'formatDate',
  standalone: true,
})
export class FormatDatePipe implements PipeTransform {
  /**
   * Formats a Firestore timestamp, Date, or date string.
   *
   * Usage:
   *   {{ timestamp | formatDate }}            → "May 9, 2026"  (short)
   *   {{ timestamp | formatDate:'long' }}     → "May 9, 2026, 02:30 PM"
   *   {{ timestamp | formatDate:'datetime' }} → "05/09/2026, 2:30 PM"
   *   {{ timestamp | formatDate:'time' }}     → "May 9, 2:30 PM"
   */
  transform(value: any, format: 'short' | 'long' | 'datetime' | 'time' = 'short'): string {
    if (!value) return 'N/A';

    try {
      const date = value.toDate ? value.toDate() : new Date(value);
      if (isNaN(date.getTime())) return 'N/A';

      const options = this.getOptions(format);
      return new Intl.DateTimeFormat('en-US', options).format(date);
    } catch {
      return 'N/A';
    }
  }

  private getOptions(format: string): Intl.DateTimeFormatOptions {
    switch (format) {
      case 'long':
        return { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
      case 'datetime':
        return { year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit', hour12: true };
      case 'time':
        return { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
      case 'short':
      default:
        return { year: 'numeric', month: 'short', day: 'numeric' };
    }
  }
}
