# Shadow Learning – Discord code bot

Generates access codes for Discord users who have the **Staff** role (or the role name you set).

## Setup

1. **Create a bot** in the [Discord Developer Portal](https://discord.com/developers/applications):
   - New Application → Bot → Reset Token (copy it once).
   - Enable **Message Content Intent** under Bot.
   - Invite the bot to your server with scopes: `bot`, permissions: **Send Messages**, **Read Message History**.

2. **Copy env file and fill in:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env`:
   - `DISCORD_BOT_TOKEN` = your bot token
   - `KEY_SERVER_URL` = your key server (e.g. `https://shadow-learning-production.up.railway.app`)
   - `ADD_KEY_SECRET` = same secret you set on the key server as `ADD_KEY_SECRET`
   - `STAFF_ROLE_NAME` = role name required to use the command (default: `Staff`)

3. **On the key server (Railway):** set `ADD_KEY_SECRET` to a long random string. Use the same value in the bot’s `.env`.

4. **Create a “Staff” role** in your Discord server and assign it to users who may generate codes.

5. **Run the bot:**
   ```bash
   cd discord-bot
   npm install
   npm start
   ```

## Usage

Users with the Staff role can type in any channel:

- `!code`
- `!getcode`
- `!accesscode`

The bot will register a new code with the key server and send it via DM. That code can be used once on the Shadow Learning site (one device per code if binding is enabled).
