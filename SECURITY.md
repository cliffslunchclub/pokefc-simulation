# PokéFC public mirror security policy

This repository is for **public development and testing only**. It must never possess production credentials or independently publish to SiteGround.

Please report security vulnerabilities privately to the repository owner using GitHub's private vulnerability-reporting feature when available, rather than opening a public issue containing exploit details or secrets.

## Contribution boundaries

- Do not commit secrets, .env files, SSH keys, personal saves, customer data or deployment credentials.
- CI jobs must use `contents: read` by default. Do not introduce `pull_request_target`, repository-write permissions, production FTPS, or workflows that push to the private repo.
- Pin external GitHub actions and the Soccer-JS source to reviewed commit SHAs.
- Keep public QA synthetic and reproducible. No live customer data or private fixtures.
- All promotions into the private production repository require a separate explicit release review.

The public repo may not have enforceable branch/ruleset protections until a repository administrator configures them. See repository Settings > Rules > Rulesets and Settings > Actions > General before enabling outside contributions.
