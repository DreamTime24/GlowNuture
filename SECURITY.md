# Security

Read [docs/SECURITY.md](docs/SECURITY.md) for implemented controls and remaining deployment checks.

Keep private keys, backend/.env, card data, database dumps and customer records out of git and issue bodies. No default owner credentials are supplied. Production requires PostgreSQL, HTTPS/secure cookies, Firebase identity and staff MFA. Live payment, merchant settlement and courier acceptance are owner/provider work; this source alone does not establish those accounts.
