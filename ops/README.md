# PIRATE production deployment

Production follows the `production` branch of `PIRATEglobal/twenty`, initially
based on upstream `v2.8.3`. Keep `main` available for upstream updates; merge
customizations into `production` when they are ready to deploy.

The `PIRATE production` GitHub Actions workflow builds the upstream `twenty`
Docker target and publishes `ghcr.io/pirateglobal/twenty:sha-<commit>`.
Only after a successful build does it request a Coolify deployment and wait
for completion. Coolify reads `ops/compose.yml` from the fork and pulls the
image matching `SOURCE_COMMIT`. Builds run on GitHub rather than the CRM host.

Coolify holds the runtime secrets. GitHub holds only its deployment API token
in `COOLIFY_TOKEN`, with `read` and `deploy` abilities. Repository variables
`COOLIFY_URL`, `COOLIFY_APPLICATION_UUID`, and `COOLIFY_DEPLOY_ENABLED` configure
the deployment. Direct Git push webhooks must remain disabled so deployments
wait for the image build.

The existing Coolify service `jgrm1k1qwpl6my1kat59f8ot` owns PostgreSQL and
Redis, including the existing scheduled database backups. The Git application
joins that service's network and mounts its existing external uploads volume.
Do not delete that service, its network, or its volumes.

Database migrations are disabled for this same-version cutover. Before an
upstream version upgrade or a customization requiring migrations, take a
consistent database/uploads backup, test the migration in isolation, and
explicitly enable migrations for the web service during the upgrade.

For rollback, redeploy a previously built commit through Coolify. Rolling
back across a database migration also requires the matching database backup.
