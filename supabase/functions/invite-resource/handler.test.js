import test from 'node:test'
import assert from 'node:assert/strict'
import { createInviteHandler } from './handler.js'

function fixture(options = {}) {
  const calls = { mails: [], invites: [], writes: [] }
  const account = { id: 'account', email: 'assigned@example.com', ...options.account }
  const resource = options.noResource ? null : { id: 'resource', auth_user_id: 'account', name: 'Montage', access_enabled: true, ...options.resource }
  const client = {
    auth: {
      getUser: async () => ({ data: { user: options.invalidToken ? null : { id: options.actor || 'owner' } } }),
      signInWithOtp: async body => { calls.mails.push(body); return { error: options.mailError || null } },
      admin: {
        getUserById: async id => { assert.equal(id, 'account'); return { data: { user: account } } },
        listUsers: async () => ({ data: { users: options.newUser ? [] : [account] } }),
        inviteUserByEmail: async (email, config) => { calls.invites.push({ email, config }); return { data: { user: { ...account, email } } } },
      },
    },
    from(table) {
      let update
      const query = {
        select: () => query, eq: () => query, is: () => query,
        maybeSingle: async () => ({ data: table === 'projects' ? { owner_user_id: 'owner' } : resource }),
        update: body => { update = body; calls.writes.push(body); return query },
        insert: async body => { calls.writes.push(body); return {} },
        then: (resolve, reject) => Promise.resolve({ data: update ? [{ id: 'resource' }] : [] }).then(resolve, reject),
      }
      return query
    },
  }
  const handler = createInviteHandler({ createClient: () => client, env: () => 'test' })
  const invoke = (body = {}, token = 'test-token') => handler(new Request('https://example.com/invite-resource', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : {}, body: JSON.stringify({ action: 'send_login', project_id: 'project', resource_id: 'resource', ...body }) }))
  return { calls, invoke }
}
test('owner sends only to mapped account, with a fixed redirect and no account creation', async () => {
  const { calls, invoke } = fixture()
  const response = await invoke({ email: 'attacker@example.com' })
  assert.equal(response.status, 200)
  assert.equal(calls.mails.length, 1)
  assert.deepEqual(calls.mails[0], { email: 'assigned@example.com', options: { shouldCreateUser: false, emailRedirectTo: 'https://slow409.github.io/Project-progress/' } })
  assert.equal(calls.writes.length, 0)
  assert.equal(calls.invites.length, 0)
})
test('anonymous callers, expired tokens, and resource users cannot send mail', async () => {
  for (const options of [{ actor: 'resource-user' }, { invalidToken: true }, {}]) {
    const f = fixture(options)
    const response = await f.invoke({}, Object.keys(options).length ? 'token' : '')
    assert.ok([401, 403].includes(response.status))
    assert.equal(f.calls.mails.length, 0)
  }
})
test('disabled, missing, unlinked, banned, and deleted accounts cannot receive links', async () => {
  for (const options of [{ resource: { access_enabled: false } }, { noResource: true }, { resource: { auth_user_id: null } }, { account: { banned_until: '2999-01-01' } }, { account: { deleted_at: '2026-01-01' } }, { account: { email: null } }]) {
    const f = fixture(options)
    assert.ok((await f.invoke()).status >= 400)
    assert.equal(f.calls.mails.length, 0)
  }
})
test('mail rate limits and upstream errors have distinct safe responses', async () => {
  const limited = fixture({ mailError: { status: 429 } })
  const response = await limited.invoke()
  assert.equal(response.status, 429)
  assert.equal((await response.json()).error, 'email_rate_limit')
  const failure = fixture({ mailError: { status: 500, message: 'private details' } })
  const failed = await failure.invoke()
  assert.equal(failed.status, 502)
  assert.equal((await failed.json()).error, 'login_link_failed')
})
test('existing invitation flow still links existing and new accounts', async () => {
  for (const newUser of [false, true]) {
    const f = fixture({ resource: { auth_user_id: null }, newUser })
    const response = await f.invoke({ action: 'link', email: 'Assigned@Example.com' })
    assert.equal(response.status, 200)
    assert.equal((await response.json()).invited, newUser)
    assert.equal(f.calls.invites.length, newUser ? 1 : 0)
    assert.equal(f.calls.mails.length, 0)
    assert.equal(f.calls.writes[0].auth_user_id, 'account')
  }
})
test('unknown actions do not send email or change resources', async () => {
  const f = fixture()
  assert.equal((await f.invoke({ action: 'delete' })).status, 400)
  assert.equal(f.calls.mails.length, 0)
  assert.equal(f.calls.writes.length, 0)
})
