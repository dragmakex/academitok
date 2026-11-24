/**
 * Nitro startup plugin — enforces server environment validation at process boot
 * before the HTTP server binds a listening socket or accepts traffic.
 */

import { validateServerEnv } from "@/lib/server-env"

/**
 * Validates required production environment variables when Nitro boots.
 */
export default function validateEnvPlugin(): void {
  validateServerEnv(process.env)
}
