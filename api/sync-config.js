module.exports = function handler(req, res) {
  const sync = {
    supabaseUrl: process.env.SUPABASE_URL || "",
    anonKey: process.env.SUPABASE_ANON_KEY || "",
    storageBucket: process.env.SUPABASE_STORAGE_BUCKET || "videos",
    workspaceId: process.env.SUPABASE_WORKSPACE_ID || "team-main",
    deviceName: process.env.VISTABOARD_DEVICE_NAME || "web-client",
  };

  const configured = Boolean(sync.supabaseUrl && sync.anonKey && sync.workspaceId);

  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(200).json({ configured, sync: configured ? sync : null });
};
