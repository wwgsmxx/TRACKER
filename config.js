/* ──────────────────────────────────────────── */
/* HabitFlow - Supabase Configuration          */
/* ──────────────────────────────────────────── */

window.ENV_SUPABASE_URL = 'https://tuqtawunmlmhuetxdveo.supabase.co';
window.ENV_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR1cXRhd3VubWxtaHVldHhkdmVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyMDEzNjEsImV4cCI6MjEwMTc3NzM2MX0.gBVLxozez4GH0R-FoCDsGeP1fOVPqocdSQD93FkGQT0';

// Инициализация Supabase Client
(function() {
  if (typeof supabase !== 'undefined' && supabase.createClient) {
    try {
      window.supabaseClient = supabase.createClient(window.ENV_SUPABASE_URL, window.ENV_SUPABASE_ANON_KEY);
    } catch (e) {
      console.error('Failed to initialize Supabase client:', e);
    }
  }
})();

