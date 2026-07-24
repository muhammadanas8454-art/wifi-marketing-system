const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Read keys securely from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || 'PASTE_YOUR_SUPABASE_URL_HERE';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'PASTE_YOUR_SUPABASE_ANON_PUBLIC_KEY_HERE';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// DASHBOARD PASSWORD - Change this!
const DASHBOARD_PASSWORD = 'restaurant123';

// Profile inventory to dynamically brand separate cafe locations
const venueProfiles = {
    "lisbon_brunch": {
        name: "Lisbon Brunch Co.",
        color: "#d4a373",
        logo: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=100"
    },
    "algarve_surf": {
        name: "Algarve Surf Cafe",
        color: "#0077b6",
        logo: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=100"
    },
    "mikrotik_hotspot": {
        name: "Guest WiFi",
        color: "#333333",
        logo: ""
    }
};

// ==================== CAPTIVE PORTAL ====================
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

// ==================== DASHBOARD ====================
// Login page for dashboard
app.get('/dashboard', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Admin Dashboard Login</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px 20px; background: #f4f6f9; }
                .box { background: white; padding: 30px; border-radius: 10px; max-width: 400px; margin: auto; box-shadow: 0px 4px 10px rgba(0,0,0,0.1); }
                input[type="password"] { width: 90%; padding: 12px; margin: 15px 0; border: 1px solid #ccc; border-radius: 5px; font-size: 16px; }
                button { width: 100%; padding: 12px; background: #0077b6; color: white; border: none; border-radius: 5px; font-size: 16px; cursor: pointer; font-weight: bold; }
                .error { color: red; margin-top: 10px; }
            </style>
        </head>
        <body>
            <div class="box">
                <h2>🔐 Restaurant Dashboard</h2>
                <p>Enter your admin password</p>
                <form method="POST" action="/dashboard/auth">
                    <input type="password" name="password" placeholder="Enter password" required>
                    <button type="submit">Access Dashboard</button>
                </form>
                ${req.query.error ? '<p class="error">❌ Invalid password. Try again.</p>' : ''}
            </div>
        </body>
        </html>
    `);
});

// Authenticate dashboard access
app.post('/dashboard/auth', (req, res) => {
    const { password } = req.body;
    if (password === DASHBOARD_PASSWORD) {
        // Set a simple cookie/session (in production, use proper session management)
        res.redirect('/dashboard/view');
    } else {
        res.redirect('/dashboard?error=1');
    }
});

// Main dashboard view
app.get('/dashboard/view', async (req, res) => {
    try {
        // Fetch all logs
        const { data: logs, error } = await supabase
            .from('wifi_logs')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Calculate stats
        const totalGuests = logs.length;
        const uniqueMacs = new Set(logs.map(l => l.mac)).size;
        
        // Today's guests
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayGuests = logs.filter(l => {
            const logDate = new Date(l.created_at);
            logDate.setHours(0, 0, 0, 0);
            return logDate.getTime() === today.getTime();
        }).length;

        // Last 7 days
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekGuests = logs.filter(l => new Date(l.created_at) >= weekAgo).length;

        // Group by venue
        const venueStats = {};
        logs.forEach(l => {
            const venue = l.venue_id || 'unknown';
            venueStats[venue] = (venueStats[venue] || 0) + 1;
        });

        // Generate HTML
        let venueRows = '';
        for (const [venue, count] of Object.entries(venueStats)) {
            const venueName = venueProfiles[venue]?.name || venue;
            venueRows += `<tr><td>${venueName}</td><td>${count}</td></tr>`;
        }

        // Recent guests table
        let recentRows = '';
        const recentLogs = logs.slice(0, 20);
        recentLogs.forEach(log => {
            const date = new Date(log.created_at).toLocaleString();
            const venueName = venueProfiles[log.venue_id]?.name || log.venue_id || 'Unknown';
            recentRows += `
                <tr>
                    <td>${date}</td>
                    <td>${log.email || 'N/A'}</td>
                    <td>${log.mac || 'N/A'}</td>
                    <td>${venueName}</td>
                </tr>
            `;
        });

        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Restaurant WiFi Dashboard</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: Arial, sans-serif; background: #f0f2f5; padding: 20px; }
                    .header { background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center; }
                    .header h1 { color: #333; }
                    .logout-btn { background: #dc3545; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; text-decoration: none; }
                    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 20px; }
                    .stat-card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; }
                    .stat-number { font-size: 36px; font-weight: bold; color: #0077b6; }
                    .stat-label { color: #666; margin-top: 5px; font-size: 14px; }
                    .section { background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                    .section h2 { margin-bottom: 15px; color: #333; }
                    table { width: 100%; border-collapse: collapse; font-size: 14px; }
                    th { background: #f8f9fa; padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6; }
                    td { padding: 10px 12px; border-bottom: 1px solid #dee2e6; }
                    tr:hover { background: #f8f9fa; }
                    .refresh-btn { background: #28a745; color: white; padding: 8px 16px; border: none; border-radius: 5px; cursor: pointer; margin-left: 10px; }
                    @media (max-width: 600px) {
                        .header { flex-direction: column; gap: 10px; }
                        .stats-grid { grid-template-columns: 1fr 1fr; }
                        table { font-size: 12px; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📊 Restaurant WiFi Dashboard</h1>
                    <div>
                        <button onclick="location.reload()" class="refresh-btn">🔄 Refresh</button>
                        <a href="/dashboard/logout" class="logout-btn">🚪 Logout</a>
                    </div>
                </div>

                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-number">${totalGuests}</div>
                        <div class="stat-label">Total Guests</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${uniqueMacs}</div>
                        <div class="stat-label">Unique Devices</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${todayGuests}</div>
                        <div class="stat-label">Today's Visitors</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${weekGuests}</div>
                        <div class="stat-label">Last 7 Days</div>
                    </div>
                </div>

                <div class="section">
                    <h2>🏢 Venue Breakdown</h2>
                    <table>
                        <thead><tr><th>Venue</th><th>Total Guests</th></tr></thead>
                        <tbody>${venueRows || '<tr><td colspan="2">No data yet</td></tr>'}</tbody>
                    </table>
                </div>

                <div class="section">
                    <h2>📋 Recent Guest Activity</h2>
                    <div style="overflow-x: auto;">
                        <table>
                            <thead>
                                <tr>
                                    <th>Date/Time</th>
                                    <th>Email</th>
                                    <th>MAC Address</th>
                                    <th>Venue</th>
                                </tr>
                            </thead>
                            <tbody>${recentRows || '<tr><td colspan="4">No guests yet</td></tr>'}</tbody>
                        </table>
                    </div>
                </div>

                <div style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
                    Last updated: ${new Date().toLocaleString()}
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Dashboard error:', err);
        res.status(500).send('Error loading dashboard');
    }
});

// Logout
app.get('/dashboard/logout', (req, res) => {
    res.redirect('/dashboard');
});

// ==================== SERVER START ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`WiFi Agency Server Online on port ${PORT}`));
