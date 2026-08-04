export const isInsForgeConfigured = () => {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
  const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;

  return Boolean(baseUrl && /^https?:\/\//.test(baseUrl) && anonKey);
};
