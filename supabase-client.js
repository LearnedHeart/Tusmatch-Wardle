// supabase-client.js

const supabaseUrl = 'https://mimieikswytpoouowlye.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pbWllaWtzd3l0cG9vdW93bHllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2OTc4MTYsImV4cCI6MjA4MTI3MzgxNn0.Jvg5YSZCW_5kbGRwkGD0e6k5QGcSlfpY4QtvwDzJUq4';

let supabaseClient = null;

if (typeof createClient !== 'undefined') {
    supabaseClient = createClient(supabaseUrl, supabaseKey);
} else if (window.supabase && typeof window.supabase.createClient === 'function') {
    supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
} else {
    console.error("Impossible d'initialiser Supabase : createClient introuvable.");
}

// Expose globally
window.supabaseClient = supabaseClient;
