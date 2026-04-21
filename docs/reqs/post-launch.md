# Post-Launch Checklist

## Security & Cost

- [ ] Add secret header check in Express to restrict direct Cloud Run API access (bypass prevention)
- [ ] Resolve Dependabot alerts — lodash and path-to-regexp vulnerabilities in `package-lock.json`
- [ ] Confirm GCP billing alert is firing correctly (test by checking alert config at $1 threshold)

## Infrastructure

- [ ] Set up CD — automate `firebase deploy` and `gcloud run deploy` via GitHub Actions (currently HITL)
- [ ] Fix `firebase login --reauth` friction — consider a long-lived CI token for headless deploys
- [ ] Update `DEPLOY.md` with the `firebase use jw-craps` step (required before deploy on a fresh machine)

## DNS & Domain

- [ ] Verify `jason@jasonwoodard.com` email is fully working after nameserver switch
- [ ] Add DKIM verification check in Google Admin console
- [ ] Set up a simple `jasonwoodard.com` homepage — currently serving a broken BizLand placeholder

## App

- [ ] Fix TypeScript unused variable error in `DistributionPage.tsx` (`SectionTitle`)
- [ ] Address Vite chunk size warning — bundle over 500KB, consider code splitting
