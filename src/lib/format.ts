/**
 * Date formatting utilities for arVix Portal
 */

export function formatDate(dateString: string | null, style: 'short' | 'long' = 'short'): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: style === 'short' ? 'short' : 'long',
    day: 'numeric',
  });
}
