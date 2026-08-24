export const getInsForgeConnectionSettings = () => {
  const baseUrl =
    process.env.INSFORGE_URL ?? process.env.NEXT_PUBLIC_INSFORGE_URL;
  const anonKey =
    process.env.INSFORGE_ANON_KEY ??
    process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;

  return { baseUrl, anonKey };
};

export const isInsForgeConfigured = () => {
  const { baseUrl, anonKey } = getInsForgeConnectionSettings();

  return Boolean(baseUrl && /^https?:\/\//.test(baseUrl) && anonKey);
};
