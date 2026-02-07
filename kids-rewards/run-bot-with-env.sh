#!/bin/bash
# Load environment variables and run the bot

set -a
source .env.local
set +a

npm run test-bot-phase4
