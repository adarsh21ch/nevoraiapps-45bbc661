import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/reset-pw-once')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get('x-reset-token')
        if (token !== 'lovable-oneshot-8f3a91') {
          return new Response('nope', { status: 401 })
        }
        const { email, password } = await request.json()
        if (email !== 'teamnevorai@gmail.com') {
          return new Response('email not allowed', { status: 403 })
        }
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        let page = 1
        let user: { id: string; email?: string | null } | null = null
        for (;;) {
          const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 })
          if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
          user = data.users.find((u) => (u.email ?? '').toLowerCase() === email.toLowerCase()) ?? null
          if (user || data.users.length < 200) break
          page++
        }
        if (!user) return new Response(JSON.stringify({ error: 'user not found' }), { status: 404 })
        const { error: e2 } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password })
        if (e2) return new Response(JSON.stringify({ error: e2.message }), { status: 500 })
        return new Response(JSON.stringify({ ok: true, id: user.id }), {
          headers: { 'content-type': 'application/json' },
        })
      },
    },
  },
})
