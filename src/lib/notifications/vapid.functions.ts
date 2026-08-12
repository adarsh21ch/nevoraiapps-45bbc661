/**
 * Public server function returning the VAPID public key so the browser can
 * subscribe to Web Push. The public key is safe to expose — it is the same
 * value push endpoints require in the `Crypto-Key` header.
 */

import { createServerFn } from "@tanstack/react-start";

export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  const key = typeof process !== 'undefined' ? process.env.VAPID_PUBLIC_KEY : undefined;
  return { publicKey: key ?? null };
});
