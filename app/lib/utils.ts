import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const salt = process.env.AUTH_SECRET || ''
  const data = encoder.encode(password + salt)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
}

export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  const hash = await hashPassword(password)
  return hash === hashedPassword
}

export async function getPasswordVersion(hashedPassword: string): Promise<string> {
  return hashPassword(hashedPassword)
}

export function isPasswordVersionValid(tokenVersion: unknown, currentVersion: string): boolean {
  return typeof tokenVersion === "string" && tokenVersion === currentVersion
}
