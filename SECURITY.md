# Security Policy

HealthArchive is a public static information archive. Do not upload secrets,
private PDFs, unpublished review documents, API keys, or personal contact data
that is not already intended for public release.

## Reporting a Vulnerability

Please report suspected vulnerabilities through the site's feedback channel or
by email to healtharchive2026@gmail.com. Include the affected URL, a short reproduction
path, and whether any public data was exposed or modified.

## Operational Notes

- Use GitHub two-factor authentication for repository access.
- Do not place administrator passwords, API tokens, or service credentials in
  client-side JavaScript.
- Rotate any backend or Worker secret immediately if it was ever committed or
  exposed in browser-delivered code.
- Keep domain DNS, HTTPS certificate status, and public storage buckets under
  regular review.
