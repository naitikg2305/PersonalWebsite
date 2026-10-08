---
title: "AWS CLI: Using Multiple Accounts on One Machine"
category: "Cloud & AWS"
slug: "aws-cli-multiple-accounts"
summary: "How AWS CLI profiles, SSO sessions, and AWS_PROFILE work together, and the habits that stop you running a command against the wrong account."
---

# AWS CLI: Using Multiple Accounts on One Machine

I work across several AWS accounts on one laptop: my personal account, an employer R&D account, and a client's preprod and prod accounts. The AWS CLI handles this with **profiles**. It's the same idea as SSH host aliases for multiple GitHub accounts (see [/knowledge/git-ssh-multiple-github-accounts](/knowledge/git-ssh-multiple-github-accounts)): the name you pass decides which identity is used.

## How the CLI picks an account

```
aws s3 ls --profile personal
              │
              ▼  ~/.aws/config       [profile personal]  → region, output, SSO settings
                 ~/.aws/credentials  [personal]          → static keys (if not SSO)
              ▼
         AWS sees the IAM user/role behind that profile
```

Precedence, highest first:
1. Raw `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` environment variables
2. `--profile NAME` on the command
3. The `AWS_PROFILE` environment variable
4. The `[default]` profile

## The trap that motivated this note

I ran `echo $AWS_PROFILE` and found it set to a **client production profile**, exported by a setup script for that engagement. In any terminal that sourced the script, a bare `aws ...` command, with no `--profile`, would have run against the client's prod account. Nothing warns you.

My rules since then:
- Always pass `--profile` explicitly for personal work.
- Run `aws sts get-caller-identity --profile X` before anything that creates or deletes, and check the **account ID**.
- Don't define a `[default]` profile on a machine with client accounts, so a forgotten `--profile` fails loudly.

## Setting up a profile with a static access key

Good for a personal account (use a dedicated IAM user, never root):
```bash
aws configure --profile personal
# AWS Access Key ID:     <IAM → Users → Security credentials → Create access key>
# AWS Secret Access Key: <shown once>
# Default region name:   us-east-1
# Default output format: json
```
Resulting files:
```ini
# ~/.aws/config
[profile personal]
region = us-east-1
output = json

# ~/.aws/credentials   (chmod 600, never commit)
[personal]
aws_access_key_id = AKIA...
aws_secret_access_key = ...
```
Gotcha: `config` uses `[profile personal]`, but `credentials` uses plain `[personal]`. Mixing them up gives "The config profile could not be found."

## Setting up SSO profiles (IAM Identity Center)

Better for work accounts, because the credentials are temporary:
```bash
aws configure sso --profile client-preprod
# SSO session name: client
# SSO start URL:    https://<org>.awsapps.com/start
# SSO region:       us-east-1
# → browser opens; approve; pick the account and role
```
Several profiles can share one `[sso-session client]` block, so **one login covers all of them**:
```bash
aws sso login --sso-session client     # daily; tokens expire after ~8–12 h
aws sso logout
```
```ini
[sso-session client]
sso_start_url = https://<org>.awsapps.com/start
sso_region = us-east-1
sso_registration_scopes = sso:account:access

[profile client-preprod]
sso_session = client
sso_account_id = <account-id>
sso_role_name = <RoleName>
region = us-east-1
```

## Everyday commands

```bash
aws configure list-profiles                        # list profiles
aws sts get-caller-identity --profile personal     # who am I? (run first, always)
aws configure list --profile personal              # where each setting comes from
aws s3 ls --profile personal                       # one-off command
AWS_PROFILE=personal aws s3 ls                     # one command, shell untouched
export AWS_PROFILE=personal                        # switch the whole shell
unset AWS_PROFILE                                  # clear it
```

In code, boto3 uses the same profiles:
```python
import boto3
session = boto3.Session(profile_name="personal", region_name="us-east-1")
client = session.client("bedrock-runtime")
```
Deployed code (Lambda, CI) uses **no profiles**: the function's IAM role, or the CI's OIDC role, supplies credentials automatically, and no keys are stored anywhere.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `ExpiredToken` / "Token has expired" | `aws sso login --sso-session <name>` |
| `AccessDenied` on something that should work | `aws sts get-caller-identity --profile X`: wrong account or role |
| "Unable to locate credentials" | `aws configure list --profile X`: no keys and no SSO token |
| A command hit the wrong account | `echo $AWS_PROFILE`: an environment variable overrode your intent |
| "The config profile (X) could not be found" | a typo, or `[X]` written where `[profile X]` is needed |

## Key takeaways

- Profiles are to AWS what SSH host aliases are to GitHub: the name you pass picks the identity.
- `AWS_PROFILE` silently overrides your default. Check it, and prefer explicit `--profile`.
- `aws sts get-caller-identity` is the "who am I" command; run it before anything destructive.
- Use SSO for work accounts (temporary credentials, one login covering several profiles) and a dedicated IAM user, never root, for a personal account.
- Deployed code should use IAM roles, not keys.
