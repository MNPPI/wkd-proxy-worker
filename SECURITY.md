# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, please use [GitHub's private vulnerability reporting](https://github.com/MNPPI/wkd-proxy-worker/security/advisories/new) to submit your report. This ensures the issue can be assessed and addressed before public disclosure.

## Scope

This project is a Cloudflare Worker that proxies WKD requests. Security concerns include:

- Request handling and input validation
- Upstream proxy behavior
- Information disclosure in logs or error responses
- DNS record management in the deploy workflow

## Response

We aim to acknowledge reports within 48 hours and provide a fix or mitigation plan within 7 days for confirmed vulnerabilities.
