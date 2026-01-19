import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { internal } from './_generated/api'
import { Webhook } from 'svix'

const http = httpRouter()

// Clerk webhook types
interface ClerkWebhookEvent {
  type: string
  data: {
    id: string
    email_addresses: Array<{ email_address: string }>
    first_name: string | null
    last_name: string | null
    image_url: string | null
  }
}

http.route({
  path: '/webhooks/clerk',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error('CLERK_WEBHOOK_SECRET not set')
      return new Response('Webhook secret not configured', { status: 500 })
    }

    // Get headers
    const svixId = request.headers.get('svix-id')
    const svixTimestamp = request.headers.get('svix-timestamp')
    const svixSignature = request.headers.get('svix-signature')

    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response('Missing svix headers', { status: 400 })
    }

    // Get body
    const payload = await request.text()

    // Verify webhook
    const wh = new Webhook(webhookSecret)
    let event: ClerkWebhookEvent

    try {
      event = wh.verify(payload, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as ClerkWebhookEvent
    } catch (err) {
      console.error('Webhook verification failed:', err)
      return new Response('Invalid signature', { status: 401 })
    }

    // Handle event
    switch (event.type) {
      case 'user.created':
      case 'user.updated': {
        const name =
          `${event.data.first_name ?? ''} ${event.data.last_name ?? ''}`.trim() || undefined

        await ctx.runMutation(internal.users.upsert, {
          clerkId: event.data.id,
          email: event.data.email_addresses[0]?.email_address ?? '',
          name,
          imageUrl: event.data.image_url ?? undefined,
        })
        break
      }

      case 'user.deleted':
        await ctx.runMutation(internal.users.deleteByClerkId, {
          clerkId: event.data.id,
        })
        break
    }

    return new Response('OK', { status: 200 })
  }),
})

// Nango webhook types
interface NangoWebhookPayload {
  type: string
  connectionId: string
  providerConfigKey?: string
}

http.route({
  path: '/webhooks/nango',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    // Nango uses the secret key for webhook signature verification
    const secretKey = process.env.NANGO_SECRET_KEY
    if (!secretKey) {
      console.error('NANGO_SECRET_KEY not set')
      return new Response('Webhook secret not configured', { status: 500 })
    }

    // Verify signature
    const signature = request.headers.get('x-nango-signature')
    if (!signature) {
      return new Response('Missing signature header', { status: 400 })
    }

    const payload = await request.text()

    // Verify HMAC signature using Web Crypto API
    const encoder = new TextEncoder()
    const keyData = encoder.encode(secretKey)
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    if (signature !== expectedSignature) {
      console.error('Webhook signature mismatch')
      return new Response('Invalid signature', { status: 401 })
    }

    const event = JSON.parse(payload) as NangoWebhookPayload

    // Handle event
    await ctx.runMutation(internal.integrations.handleWebhookEvent, {
      type: event.type,
      connectionId: event.connectionId,
      provider: event.providerConfigKey,
    })

    return new Response('OK', { status: 200 })
  }),
})

export default http
