// Dev only: NEXT_PUBLIC_DEV_OWNER=1 makes you the owner of every Chog, on the
// page and in the API, with no wallet or signature needed. It can never turn on
// in production: NODE_ENV is "production" in every build, so this is false there.
export const DEV_OWNER = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEV_OWNER === "1";
