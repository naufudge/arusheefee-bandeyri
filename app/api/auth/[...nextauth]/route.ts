import { handlers } from "@/lib/auth";

// next-auth's handlers expose both GET (sign-in / callback / session) and
// POST (sign-out / CSRF). Re-export them as the route handler this folder
// requires.
export const { GET, POST } = handlers;
