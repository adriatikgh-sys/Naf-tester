'use server'

import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { db } from '@/lib/db'
import { signIn } from '@/lib/auth'

const registerSchema = z.object({
  organisationName: z.string().trim().min(2).max(120),
  userName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(10).max(200),
  // ISO 4217 / BCP 47 — the form defaults these to NOK / nb-NO for the
  // Nordic launch, but any values are accepted.
  currencyCode: z.string().trim().toUpperCase().length(3),
  locale: z.string().trim().min(2).max(20),
})

export type RegisterState = { error?: string }

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')
    .replace(/å/g, 'a')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export async function registerOrganisation(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const data = parsed.data

  const existing = await db.user.findUnique({ where: { email: data.email } })
  if (existing) {
    return { error: 'An account with this email already exists.' }
  }

  const baseSlug = slugify(data.organisationName) || 'org'
  let slug = baseSlug
  for (let i = 2; await db.organisation.findUnique({ where: { slug } }); i++) {
    slug = `${baseSlug}-${i}`
  }

  const passwordHash = await bcrypt.hash(data.password, 10)

  // Organisation + first admin user, atomically.
  await db.$transaction(async (tx) => {
    const org = await tx.organisation.create({
      data: {
        name: data.organisationName,
        slug,
        currencyCode: data.currencyCode,
        locale: data.locale,
      },
    })
    await tx.user.create({
      data: {
        email: data.email,
        name: data.userName,
        passwordHash,
        role: 'ADMIN',
        organisationId: org.id,
      },
    })
  })

  // Sign the new admin in and land them on the dashboard.
  await signIn('credentials', {
    email: data.email,
    password: data.password,
    redirectTo: '/dashboard',
  })
  return {}
}
