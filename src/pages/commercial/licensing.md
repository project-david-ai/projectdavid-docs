---
title: Licensing
category: commercial
slug: commercial-licensing
nav_order: 1
---

# Licensing

![Project David](/projectdavid_logo.png)

## Overview

Project David is distributed under the [PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/). This permits use for noncommercial purposes — personal use, research, education, and qualifying charitable or academic use — at no cost and with no time limit.

Commercial use requires a license. This page explains what commercial use means, how the license mechanism works, what you will see when you run the platform without a license, and how to obtain one.

---

## Who Needs a Commercial License

You require a commercial license if you are:

- A for-profit organisation using Project David in any capacity
- Deploying Project David as part of a commercial product or service
- Using Project David in an operational or production environment within a government or regulated industry context
- Integrating Project David into internal tooling that supports revenue-generating activities

If you are unsure whether your use requires a commercial license, it does. Contact [licensing@projectdavid.co.uk](mailto:licensing@projectdavid.co.uk) and we will tell you within 48 hours.

---

## How the License Mechanism Works

Project David Platform uses an Ed25519 cryptographic offline license. Understanding how it works matters for security-conscious operators — particularly those in government, defence, and regulated industries where phone-home behaviour is a disqualifying characteristic.

### Entirely offline

License validation happens entirely on your machine. When `pdavid` starts, it reads the `.pdavid.lic` file from your project directory and verifies its cryptographic signature against a public key baked into the platform binary. If the signature is valid and the license has not expired, the platform starts.

That is the complete process. There is no network call. No registration server. No telemetry. No callback to any Project David infrastructure at any point during license validation or during normal operation.

The platform will start successfully on a machine with no network access at all, provided a valid license file is present.

### Anonymous in operation

The license file contains an organisation name, a country code, and an expiry date — information you provide when requesting a license. Once issued, that information lives only in the license file on your machine. The platform reads it locally and never transmits it anywhere.

Project David does not operate a license server. There is no server to transmit to. The public key in the binary can verify that a license file was signed by Project David, but it cannot communicate outbound, cannot report back, and has no mechanism to do so.

### How the signature works

Each license file is signed with an Ed25519 private key held exclusively by Project David. The corresponding public key is embedded in the `projectdavid-platform` package. When you run `pdavid`, it:

1. Reads the license file from disk
2. Reconstructs the canonical payload (organisation, expiry, features)
3. Verifies the Ed25519 signature against the embedded public key
4. Proceeds if valid, or enters grace period / exits if not

A license file cannot be forged without the private key. A license file cannot be modified — any change to the payload invalidates the signature. A license file from one organisation cannot be used by another.

### What the license file contains

```json
{
  "payload": {
    "schema": "pdavid-license-v1",
    "customer": "Acme Defence Ltd",
    "org_id": "acme-defence",
    "country": "GB",
    "max_nodes": 5,
    "issued_at": "2026-04-06T00:00:00+00:00",
    "expires_at": "2027-04-06T00:00:00+00:00",
    "features": ["platform"]
  },
  "signature": "..."
}
```

Nothing in this file is secret. It is not a password or a key — it is a signed certificate, like an SSL certificate. You can share it with your security team, submit it for audit, or inspect it at any time.

---

## The Grace Period

When `pdavid` starts and no license file is found, the platform enters a 30-day grace period. During the grace period the platform runs normally — no features are restricted and no operations are blocked.

Each startup during the grace period prints a notice:

```
============================================================
  Project David Platform — License
============================================================
  ⚠️  No license file found.
  Grace period    : 27 day(s) remaining

  Project David Platform requires a commercial license for production use.
  Contact : licensing@projectdavid.co.uk
  Website : https://projectdavid.co.uk

  Place your license file at: /your/project/directory/.pdavid.lic
============================================================
```

The grace period is measured from the first time `pdavid` runs on a given machine. It is stored locally in `~/.pdavid/.grace_start` and is not reset by reinstalling the package or deleting the `.env` file.

After 30 days without a valid license file, the platform will not start. The notice changes to:

```
============================================================
  ❌ Commercial License Required
============================================================

  No license file found and grace period has expired.

  Project David Platform is free for noncommercial use.
  Commercial use requires a license.

  To obtain a license:
    Email   : licensing@projectdavid.co.uk
    Website : https://projectdavid.co.uk

  Include your organisation name, country, and intended use.
  We respond within 48 hours.
============================================================
```

If you see this message, contact us at [licensing@projectdavid.co.uk](mailto:licensing@projectdavid.co.uk). We will issue a license and have you running again within 48 hours.

---

## What to Do When You See the License Prompt

### During the grace period

No action is required immediately. The platform will continue to run. Use this time to request a license so you have it before the grace period expires.

To request a license, email [licensing@projectdavid.co.uk](mailto:licensing@projectdavid.co.uk) with:

- Your organisation name and country
- A brief description of your use case
- The components you are deploying (Core, Platform, SDK, or a combination)

We will respond within 48 hours with a `.pdavid.lic` file attached.

### Installing the license file

Place the `.pdavid.lic` file in the same directory as your `.env` file — the directory from which you run `pdavid`:

```
your-project-directory/
├── .env
├── .pdavid.lic    ← place it here
└── docker-compose.yml
```

On the next `pdavid` startup the license will be detected and validated. If valid, the startup notice changes to:

```
============================================================
  Project David Platform — License
============================================================
  ✅ Licensed to  : Acme Defence Ltd
  📋 Org ID       : acme-defence
  📅 Expires      : 2027-04-06 (365 days remaining)
============================================================
```

### If the grace period has already expired

Place the license file as described above and run `pdavid` again. The platform will start normally once a valid license is present. The grace period expiry does not permanently block the platform — it only blocks startup when no valid license file is found.

---

## License Renewal

Commercial licenses are issued for one year by default. The platform begins displaying renewal reminders 60 days before expiry:

```
  ⚠️  License expires in 58 days.
  Renew at: licensing@projectdavid.co.uk
```

To renew, contact [licensing@projectdavid.co.uk](mailto:licensing@projectdavid.co.uk) before your expiry date. We will issue a new license file. Replace the existing `.pdavid.lic` with the new one — no restart or reconfiguration required beyond that.

---

## Security and Compliance Considerations

### No network requirements for licensing

The license mechanism introduces zero new network dependencies. A fully airgapped deployment licensed by Project David requires no outbound connectivity for license purposes. The license file is static, self-contained, and verified entirely in process.

If your security policy requires network traffic analysis, there is nothing license-related to find. The only traffic `pdavid` generates is Docker Hub pulls and the stack's own service traffic — none of which involves Project David's infrastructure.

### Suitable for air-gapped and classified environments

The offline Ed25519 license mechanism was chosen specifically because Project David's customers include organisations that cannot tolerate phone-home behaviour by policy — government agencies, defence contractors, financial institutions, and critical infrastructure operators.

The license file can be delivered by email, USB, or any other out-of-band channel appropriate for your environment. Once on disk, it requires no further contact with Project David or any external system.

### Audit trail

The license file itself serves as a verifiable audit artifact. Its contents — organisation, issue date, expiry, and feature set — are human-readable and cryptographically bound. Your security team can verify that the file was issued by Project David (by checking the signature) and that it has not been modified (the signature would be invalid if any field had changed).

---

## Why Commercial Licensing

Project David is sovereign AI infrastructure — built to replace hyperscaler dependency for organisations that cannot or will not route sensitive data through foreign cloud APIs. It is in production use across more than 100 countries.

Commercial licensing funds continued development of the platform, Sovereign Forge (the distributed GPU training pipeline), and the broader ecosystem. The community edition remains free for noncommercial use. Commercial licensing exists to sustain the project — not to restrict it.

---

## Contact

**Email:** [licensing@projectdavid.co.uk](mailto:licensing@projectdavid.co.uk)  
**Website:** [https://projectdavid.co.uk](https://projectdavid.co.uk)  
**Response time:** Within 48 hours

---

*Project David is created and maintained by Francis Neequaye Armah.*  
*All intellectual property is solely owned by the author.*  
*There are no co-owners, investors, or encumbrances on the IP.*