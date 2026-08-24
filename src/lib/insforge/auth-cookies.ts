import type { AuthCookieSettings } from "@insforge/sdk/ssr";

export const authCookieSettings: AuthCookieSettings = {
  options: {
    accessToken: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
    refreshToken: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
  },
};

