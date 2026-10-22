/**
 * Maps the browser language to a bundled catalog. The JSON files come from samples/messages.
 * Returning null keeps the built-in English catalog.
 */
export function messagesBundle(locale: string): string | null {
  const language = locale.split('-')[0]?.toLowerCase();

  if (language === 'pt') {
    return '/assets/authkit.pt-BR.json';
  }

  if (language === 'es') {
    return '/assets/authkit.es.json';
  }

  return null;
}
