const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const app = express();

// IMPORTANT: Add body parsing middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Read keys securely from environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || 'PASTE_YOUR_SUPABASE_URL_HERE';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'PASTE_YOUR_SUPABASE_ANON_PUBLIC_KEY_HERE';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('🔗 Supabase URL:', SUPABASE_URL);

// DASHBOARD PASSWORD
const DASHBOARD_PASSWORD = 'restaurant123';

// Profile inventory
const venueProfiles = {
    "lisbon_brunch": {
        name: "Sharjah Brunch Co.",
        color: "#d4a373",
        logo: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=100"
    },
    "Lisbon_brunch": {
        name: "Sharjah Brunch Co.",
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

function getVenueProfile(venueId) {
    if (!venueId) return { name: "Guest WiFi", color: "#333333", logo: "" };
    if (venueProfiles[venueId]) return venueProfiles[venueId];
    if (venueProfiles[venueId.toLowerCase()]) return venueProfiles[venueId.toLowerCase()];
    return { name: venueId || "Guest WiFi", color: "#333333", logo: "" };
}

// ==================== CAPTIVE PORTAL ====================
app.get('/login', (req, res) => {
    const userMac = req.query.mac || '';
    const loginLink = req.query.loginlink || '#';
    const venueId = req.query.venue || "default"; 

    const profile = getVenueProfile(venueId);

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
                .error { color: red; margin-top: 10px; }
                .success { color: green; margin-top: 10px; }
            </style>
        </head>
        <body>
            <div class="box">
                ${profile.logo ? `<img class="logo" src="${profile.logo}">` : ''}
                <h2>Welcome to ${profile.name}</h2>
                <p>Connect to our high-speed guest network.</p>
                
                ${req.query.error ? `<p class="error">❌ ${req.query.error}</p>` : ''}
                ${req.query.success ? `<p class="success">✅ ${req.query.success}</p>` : ''}
                
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
    console.log('[CONNECT] Full request body:', req.body);
    console.log('[CONNECT] Headers:', req.headers['content-type']);
    
    const { email, mac, loginlink, venue } = req.body;

    // Validate email
    if (!email || email.trim() === '' || email === 'undefined' || email === 'null') {
        console.error('[ERROR] Invalid email received:', email);
        // Redirect back to login with error
        return res.redirect(`/login?mac=${mac || ''}&venue=${venue || ''}&error=Please enter a valid email address`);
    }

    const cleanEmail = email.trim();
    const cleanMac = mac || 'unknown';
    const normalizedVenue = venue ? venue.toLowerCase() : 'unknown';
    const cleanLoginLink = loginlink || 'https://google.com';

    try {
        console.log(`[CONNECT] Inserting: Email=${cleanEmail}, MAC=${cleanMac}, Venue=${normalizedVenue}`);
        
        const { data, error } = await supabase
            .from('wifi_logs')
            .insert([{ 
                email: cleanEmail, 
                mac: cleanMac, 
                venue_id: normalizedVenue
            }])
            .select();

        if (error) {
            console.error('[DATABASE ERROR]', error);
            throw error;
        }
        console.log(`[SUCCESS] Email ${cleanEmail} logged to Supabase.`, data);
    } catch (err) {
        console.error('[DATABASE ERROR]', err.message);
        // Still redirect to internet, but log the error
    }

    // Auto-submit to router for internet access
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Access Granted</title>
            <meta http-equiv="refresh" content="3; url=${cleanLoginLink}">
            <style>
                body { font-family: Arial; text-align: center; padding: 50px; background: #f4f6f9; }
                .box { background: white; padding: 30px; border-radius: 10px; max-width: 400px; margin: auto; }
                .check { font-size: 60px; color: #28a745; }
                .loading { display: inline-block; width: 20px; height: 20px; border: 3px solid #f3f3f3; border-top: 3px solid #0077b6; border-radius: 50%; animation: spin 1s linear infinite; }
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
        </head>
        <body>
            <div class="box">
                <div class="check">✅</div>
                <h2>Access Granted!</h2>
                <p>You are now connected to the internet.</p>
                <p>Redirecting you now...</p>
                <div class="loading"></div>
                <p style="font-size: 12px; color: #999; margin-top: 20px;">
                    <a href="${cleanLoginLink}">Click here if not redirected</a>
                </p>
            </div>
            <form method="POST" action="${cleanLoginLink}" id="autoSubmit">
                <input type="hidden" name="username" value="wifi_guest">
                <input type="hidden" name="password" value="">
                <input type="hidden" name="dst" value="https://google.com">
            </form>
            <script>
                // Auto-submit to router
                setTimeout(() => {
                    document.getElementById('autoSubmit').submit();
                }, 1000);
            </script>
        </body>
        </html>
    `);
});

// ==================== DEBUG ENDPOINT ====================
app.get('/debug', async (req, res) => {
    try {
        const { count, error: countError } = await supabase
            .from('wifi_logs')
            .select('*', { count: 'exact', head: true });

        if (countError) {
            return res.json({ success: false, error: countError.message });
        }

        const { data, error } = await supabase
            .from('wifi_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) {
            return res.json({ success: false, error: error.message });
        }

        res.json({
            success: true,
            total_count: count || 0,
            records_returned: data?.length || 0,
            data: data || [],
            columns: data && data.length > 0 ? Object.keys(data[0]) : []
        });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// ==================== DASHBOARD ====================
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

app.post('/dashboard/auth', (req, res) => {
    const { password } = req.body;
    if (password === DASHBOARD_PASSWORD) {
        res.redirect('/dashboard/view');
    } else {
        res.redirect('/dashboard?error=1');
    }
});

// ==================== DASHBOARD VIEW ====================
app.get('/dashboard/view', async (req, res) => {
    try {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        
        const { data: logs, error } = await supabase
            .from('wifi_logs')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[DASHBOARD] Supabase error:', error);
            throw error;
        }

        const safeLogs = logs || [];
        const totalGuests = safeLogs.length;
        const uniqueMacs = new Set(safeLogs.map(l => l.mac).filter(Boolean)).size;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayGuests = safeLogs.filter(l => {
            if (!l.created_at) return false;
            const logDate = new Date(l.created_at);
            logDate.setHours(0, 0, 0, 0);
            return logDate.getTime() === today.getTime();
        }).length;

        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekGuests = safeLogs.filter(l => {
            if (!l.created_at) return false;
            return new Date(l.created_at) >= weekAgo;
        }).length;

        const venueStats = {};
        safeLogs.forEach(l => {
            const venue = l.venue_id || 'unknown';
            venueStats[venue] = (venueStats[venue] || 0) + 1;
        });

        let venueRows = '';
        for (const [venue, count] of Object.entries(venueStats)) {
            const profile = getVenueProfile(venue);
            const venueName = profile.name || venue;
            venueRows += `<tr><td>${venueName}</td><td>${count}</td></tr>`;
        }

        let recentRows = '';
        const recentLogs = safeLogs.slice(0, 20);
        recentLogs.forEach(log => {
            const date = log.created_at ? new Date(log.created_at).toLocaleString() : 'Unknown';
            const profile = getVenueProfile(log.venue_id);
            const venueName = profile.name || log.venue_id || 'Unknown';
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
                <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
                <meta http-equiv="Pragma" content="no-cache">
                <meta http-equiv="Expires" content="0">
                <title>Restaurant WiFi Dashboard</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: Arial, sans-serif; background: #f0f2f5; padding: 20px; }
                    .header { background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
                    .header h1 { color: #333; font-size: 24px; }
                    .header-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
                    .badge { background: #28a745; color: white; padding: 5px 12px; border-radius: 20px; font-size: 12px; }
                    .badge-warning { background: #ffc107; color: #333; padding: 5px 12px; border-radius: 20px; font-size: 12px; }
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
                    .refresh-btn { background: #0077b6; color: white; padding: 8px 16px; border: none; border-radius: 5px; cursor: pointer; }
                    .countdown { color: #666; font-size: 12px; margin-top: 10px; }
                    .data-count { background: #e9ecef; padding: 2px 10px; border-radius: 12px; font-size: 12px; }
                    .empty-state { text-align: center; padding: 40px; color: #999; }
                    @media (max-width: 600px) {
                        .header { flex-direction: column; align-items: stretch; }
                        .header-right { justify-content: space-between; }
                        .stats-grid { grid-template-columns: 1fr 1fr; }
                        table { font-size: 12px; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📊 Restaurant WiFi Dashboard</h1>
                    <div class="header-right">
                        <span class="badge">🔄 Live Data</span>
                        <span class="badge-warning">📊 ${totalGuests} total</span>
                        <button onclick="location.reload()" class="refresh-btn">🔄 Refresh Now</button>
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
                    <h2>📋 Recent Guest Activity <span class="data-count">${recentLogs.length} shown</span></h2>
                    <div style="overflow-x: auto;">
                        ${recentLogs.length > 0 ? `
                        <table>
                            <thead>
                                <tr>
                                    <th>Date/Time</th>
                                    <th>Email</th>
                                    <th>MAC Address</th>
                                    <th>Venue</th>
                                </tr>
                            </thead>
                            <tbody>${recentRows}</tbody>
                        </table>
                        ` : `
                        <div class="empty-state">
                            <p>📭 No guest data yet</p>
                            <p style="font-size: 12px;">Connect to the WiFi and submit your email to see data here</p>
                            <p style="font-size: 12px; margin-top: 10px;">
                                <a href="/login?mac=AA:BB:CC:11:22:33&venue=lisbon_brunch" target="_blank">
                                    🧪 Test the portal
                                </a>
                            </p>
                        </div>
                        `}
                    </div>
                </div>

                <div class="countdown">
                    ⏱️ Data fetched directly from Supabase • Last updated: ${new Date().toLocaleString()}
                    <br>
                    <small>🔍 Total records in database: ${totalGuests}</small>
                </div>

                <script>
                    setTimeout(() => {
                        location.reload();
                    }, 15000);
                </script>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('[DASHBOARD] Error:', err);
        res.status(500).send(`
            <html>
            <head><title>Dashboard Error</title></head>
            <body style="font-family: Arial; padding: 50px; text-align: center;">
                <h1>❌ Dashboard Error</h1>
                <p>${err.message}</p>
                <p><a href="/dashboard">← Back to Login</a></p>
            </body>
            </html>
        `);
    }
});

app.get('/dashboard/logout', (req, res) => {
    res.redirect('/dashboard');
});

// ==================== SERVER START ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 WiFi Agency Server Online on port ${PORT}`);
    console.log(`📊 Dashboard: https://wifi-marketing-system.onrender.com/dashboard`);
    console.log(`🐛 Debug: https://wifi-marketing-system.onrender.com/debug`);
});
