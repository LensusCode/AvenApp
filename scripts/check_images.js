require('dotenv').config();
const { client } = require('../src/config/db');

async function checkImages() {
    try {
        console.log("Checking Users...");
        const users = await client.execute("SELECT id, username, avatar FROM users WHERE avatar IS NOT NULL LIMIT 5");
        console.log(users.rows);

        console.log("\nChecking Channels...");
        const channels = await client.execute("SELECT id, name, avatar FROM channels WHERE avatar IS NOT NULL LIMIT 5");
        console.log(channels.rows);

        console.log("\nChecking Stories...");
        const stories = await client.execute("SELECT id, media_url, type FROM stories WHERE type='image' LIMIT 5");
        console.log(stories.rows);

    } catch (error) {
        console.error("Error:", error);
    }
}

checkImages();
