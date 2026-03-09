/**
 * Discord bot: generates Shadow Learning access codes for users with a specific role.
 * Set DISCORD_BOT_TOKEN, KEY_SERVER_URL, ADD_KEY_SECRET, and STAFF_ROLE_NAME in .env
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const { Client, GatewayIntentBits, ActivityType } = require("discord.js");
const https = require("https");
const http = require("http");

const TOKEN = (process.env.DISCORD_BOT_TOKEN || "").trim();
const KEY_SERVER_URL = (process.env.KEY_SERVER_URL || "").trim();
const ADD_KEY_SECRET = (process.env.ADD_KEY_SECRET || "").trim();
const STAFF_ROLE_NAME = (process.env.STAFF_ROLE_NAME || "Staff").trim();

if (!TOKEN) {
  console.error("Missing DISCORD_BOT_TOKEN. Set it in .env (in the discord-bot folder).");
  process.exit(1);
}
if (!KEY_SERVER_URL || !ADD_KEY_SECRET) {
  console.error("Set KEY_SERVER_URL and ADD_KEY_SECRET in .env");
  process.exit(1);
}

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function addKeyToServer(code) {
  return new Promise((resolve, reject) => {
    const url = new URL(KEY_SERVER_URL);
    const isHttps = url.protocol === "https:";
    const path = (url.pathname.replace(/\/$/, "") || "") + "/admin/add-key";
    const body = JSON.stringify({ secret: ADD_KEY_SECRET, code });
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: path || "/admin/add-key",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };
    const req = (isHttps ? https : http).request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (json.ok && json.code) resolve(json.code);
          else reject(new Error(json.error || "Server rejected code"));
        } catch (e) {
          reject(new Error(data || "Invalid response"));
        }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

client.once("ready", () => {
  console.log(`Bot logged in as ${client.user.tag}`);
  console.log(`Staff role name: "${STAFF_ROLE_NAME}"`);
  // Show as Online with a status so it’s visible in the member list
  client.user.setPresence({
    status: "online",
    activities: [{ name: "!code for access", type: ActivityType.Watching }],
  });
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  const text = (message.content || "").trim().toLowerCase();
  if (text !== "!code" && text !== "!getcode" && text !== "!accesscode") return;

  const member = message.guild ? message.guild.members.cache.get(message.author.id) : null;
  const hasRole = member && member.roles.cache.some((r) => r.name.toLowerCase() === STAFF_ROLE_NAME.toLowerCase());

  if (!hasRole) {
    await message.reply("You need the **" + STAFF_ROLE_NAME + "** role to generate access codes.");
    return;
  }

  const code = generateCode();
  try {
    const registered = await addKeyToServer(code);
    await message.author.send(
      `Your Shadow Learning access code: **${registered}**\n\n` +
      "Use it at the site to unlock. Each code can be bound to one device."
    ).catch(() => null);
    if (message.channel.type !== 1) {
      await message.reply("I sent you a DM with your access code.");
    }
  } catch (err) {
    console.error("Add key error:", err.message);
    await message.reply("Could not generate code right now. Try again later.");
  }
});

client.login(TOKEN).catch((err) => {
  console.error("Login failed:", err.message);
  if (err.message && err.message.includes("token")) {
    console.error("Get a new token from Discord Developer Portal → your app → Bot → Reset Token, then put it in .env as DISCORD_BOT_TOKEN");
  }
  process.exit(1);
});
