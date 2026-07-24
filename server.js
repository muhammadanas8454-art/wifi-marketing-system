const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const app = express();

app.use(express.urlencoded({ extended: true }));

// Read keys securely from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || 'PASTE_YOUR_SUPABASE_URL_HERE';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'PASTE_YOUR_SUPABASE_ANON_PUBLIC_KEY_HERE';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Profile inventory to dynamically brand separate cafe locations
const venueProfiles = {
    "lisbon_brunch": {
        name: "Sharjah Brunch Co.",
        color: "#d4a373",
        logo: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=100"
    },
    "algarve_surf": {
        name: "Algarve Surf Cafe",
        color: "#0077b6",
        logo: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=100"
    }
};

// Listen for the physical router redirect sequence
app.get('/login', (req, res) => {
    const userMac = req.query.mac || '';
    const loginLink = req.query.loginlink || '#';
    const venueId = req.query.venue || "default"; 

    const profile = venueProfiles[venueId] || { name: "Guest WiFi", color: "#333333", logo: "" };

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${profile.name} WiFi</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px 20px; background: #f4f6f9; }
                .box { background: white; padding: 30px; border-radius: 10px; max-width: 400px; margin: auto; box-shadow: 0px 4px 10px rgba(0,0,0,0.1); border-top: 5px solid ${profile.color}; }
                .logo { max-width: 100px; border-radius: 50%; margin-bottom: 15px; }
                input[type="email"] { width: 90%; padding: 12px; margin: 15px 0; border: 1px solid #ccc; border-radius: 5px; font-size: 16px; box-sizing: border-box; }
                button { width: 100%; padding: 12px; background: ${profile.color}; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="box">
                ${profile.logo ? `<img class="logo" src="${profile.logo}">` : ''}
                <h2>Welcome to ${profile.name}</h2>
                <p>Connect to our high-speed guest network.</p>
                
                <form action="/connect" method="POST">
                    <input type="hidden" name="mac" value="${userMac}">
                    <input type="hidden" name="loginlink" value="${loginLink}">
                    <input type="hidden" name="venue" value="${venueId}">
                    <input type="email" name="email" placeholder="Enter your email" required>
                    <button type="submit">Log In To Network</button>
                </form>
            </div>
        </body>
        </html>
    `);
});

// Capture email, execute Supabase insertion, unlock network
app.post('/connect', async (req, res) => {
    const { email, mac, loginlink, venue } = req.body;

    try {
        const { error } = await supabase
            .from('wifi_logs')
            .insert([{ email: email, mac: mac, venue_id: venue }]);

        if (error) throw error;
        console.log(`[SUCCESS] Email ${email} logged to Supabase.`);
    } catch (err) {
        console.error('[DATABASE ERROR]', err.message);
    }

    res.send(`
        <html>
        <head><title>Success</title></head>
        <body onload="document.forms[0].submit()">
            <p>Verifying access parameters, please wait...</p>
            <form method="POST" action="${loginlink || 'https://google.com'}">
                <input type="hidden" name="username" value="wifi_guest">
                <input type="hidden" name="password" value="">
                <input type="hidden" name="dst" value="https://google.com">
            </form>
        </body>
        </html>
    `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`WiFi Agency Server Online on port ${PORT}`));
