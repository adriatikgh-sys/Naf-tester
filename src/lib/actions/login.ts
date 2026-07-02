'use server'

import { AuthError } from 'next-auth'
import { signIn } from '@/lib/auth'

export type LoginState = { error?: string }

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      redirectTo: (formData.get('callbackUrl') as string) || '/dashboard',
    })
    return {}
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: 'Wrong email or password.' }
    }
    // next/navigation redirects reach here as thrown values — rethrow them.
    throw error
  }
}
