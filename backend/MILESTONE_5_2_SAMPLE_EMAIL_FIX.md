# Milestone 5.2 Sample-Backend Email Fix

The active SMTP send path now mirrors the supplied sample backend:

- Django `EmailMessage`
- plain-text template
- `DEFAULT_FROM_EMAIL`
- one `X-Zalary-Notification-ID` header
- Celery delivery task
- encrypted recipient at rest
- retry and deduplication protections retained

Removed from the active SMTP path:

- custom `@zalary.local` Message-ID
- `Auto-Submitted`
- custom reply-to
- delivery/provider tracking headers
- provider abstraction for normal SMTP sends
- HTML multipart content

SMTP success remains `accepted`, not `delivered`, because inbox placement still requires manual observation.
