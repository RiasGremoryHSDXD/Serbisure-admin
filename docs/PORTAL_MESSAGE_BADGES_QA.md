# Portal unread messages

The personal inbox is fetched from authenticated `GET /api/v1/chat/inbox/` once for the entire signed-in portal. Its `unread_count` values are the authoritative count of received, non-deleted unread messages. No mock counts, local-storage inbox or notification defaults are used.

The header message icon and Users navigation show the total. The header opens recent conversations with previews and individual unread counts; selecting an entry navigates to Users and opens that conversation, including partners outside the current directory filter. Role tabs and directory rows also show counts. Counts above 99 display `99+` with the exact count retained in accessible labels. Zero-count badges disappear.

Refresh runs every five seconds while the tab is visible, and when focus/visibility returns. This is an in-portal indicator, not an operating-system push notification. With a conversation open, its thread also refreshes every five seconds. Hidden tabs do not fetch threads and therefore do not automatically acknowledge newly arrived messages.

Opening a thread uses the existing authenticated backend thread endpoint, which marks that account's incoming messages from the chosen partner as read. Only after a successful thread response does the portal request updated inbox counts. It does not clear badges optimistically or send redundant read PATCH requests. An inbox request started before the thread read is followed by a fresh request. Failed inbox sync retains the last confirmed counts and displays a retry notice in the message menu. Account changes and logout discard prior inbox state and invalidate late responses. Perspective/jurisdiction filters never change whose personal messages are counted.

## Automated checks

- `npm run test:chat`: parsing, counting, failed sync/retry, empty inbox, account switching, queued refresh after a read, and rendered header/navigation/directory badges.
- `npm run test:dashboard`: existing portal data regression tests.
- `npx tsc --noEmit` and `npm run build`.
- Backend: `python manage.py test chat --settings=Serbisure.test_settings --noinput` verifies both Superadmin and Barangay inbox counts, photo/text messages, read isolation and authentication alongside existing chat regression tests. Uses an isolated local test database.

## Manual acceptance on the running app

1. Sign in as Superadmin and stay on Dashboard. From mobile, send two messages to that account. Within five seconds, the header and Users badge should show `2`.
2. Open the message menu: the sender's preview and count should appear. Select it: the actual thread opens and that sender's badge clears after server acknowledgment. Other senders remain unread.
3. Send a message from a Kasambahay while Homeowners is selected. The Kasambahays tab has a badge; the header menu also opens the thread directly.
4. Repeat with a real Barangay account. Its inbox must contain only messages sent to that account.
5. Hide the browser tab with a conversation open, send another message, then close the conversation before further viewing if needed. Newly received messages are not acknowledged by a hidden-tab poll; on return an open conversation intentionally refreshes and acknowledges its received messages.
6. Disconnect the backend and refresh the message menu. Confirm it shows a sync error without fake zero counts. Reconnect and retry.
7. Sign out and sign in as a different officer. Confirm previous account previews and counts are never displayed.

No migration or mobile/native rebuild is needed. Reload the portal after restarting its frontend dev server if necessary.
