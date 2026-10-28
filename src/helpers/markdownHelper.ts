export const escapeMarkdown = (text: string): string =>
  text.replace(/[_*`[\]]/g, (char) => `\\${char}`);
