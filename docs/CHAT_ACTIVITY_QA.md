# Typing and presence checks

Restart Django and reload the admin portal and mobile app after updating the code.
For local development, run one ASGI process; Render uses the existing REDIS_URL to
share connection presence across workers. No database migration is needed.

1. Sign in to the admin portal and mobile app as different accounts. Open their
   conversation on both devices. The admin header and directory dot should show
   Active only after the server confirms the mobile connection.
2. Type on mobile without sending. The admin feed should show animated typing
   dots at the bottom. Stop typing: they disappear within five seconds. Send a
   message: the typing indicator clears when the message event arrives.
3. Type in the admin composer (including an emoji). Mobile should show typing.
   Stop for three seconds, clear the input, send, blur, close the conversation,
   switch users, or hide the browser tab: typing should stop. The next chat must
   not inherit the previous chat's typing state.
4. Background the mobile app: after its socket closes, the admin dot becomes
   gray/Inactive without refreshing. Reopen it: it becomes Active again.
5. Open the same mobile account on two clients. Close one: the account stays
   Active. Close both: it becomes Inactive. An abrupt network loss is detected
   by a heartbeat timeout, so this case is not instant (allow up to 90 seconds).
6. Disconnect the admin browser itself: status dots disappear rather than
   displaying stale green dots. Reconnect: fresh statuses load automatically.
7. Sign in as Barangay staff: only permitted partners can be watched. Other
   barangays' resident status events must not be delivered. Message access and
   Superadmin conversation isolation remain governed by existing chat rules.

Inspect browser Network → WS → `/ws/events/` → Messages for `presence.watch`,
`presence.changed`, and `chat.typing`. Outgoing typing uses POST
`/api/v1/chat/typing/`, throttled to at most once per two seconds while typing.
The directory watches the first 75 filtered rows plus the open conversation;
the header inbox watches its first 20 entries while open (100 total per socket).

Run automated checks with `npm run test:chat`, `npm run test:realtime`, and
`npm run build`. Backend regressions: `python manage.py test realtime
chat.test_support_access chat.test_unread_inbox --settings=Serbisure.test_settings
--noinput` (requires the isolated local PostgreSQL test configuration).
