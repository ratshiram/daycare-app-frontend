// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

// These lines read the variables from your .env file.
// Make sure your .env file is in the ROOT of your project (not in src)
// and that you've restarted your server (`npm start`) after creating/editing .env
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// Initialize the Supabase client variable
let supabaseInstance = null;

// Check if the URL and Key are actually loaded from .env and seem valid
if (supabaseUrl && supabaseUrl.startsWith('https') && supabaseAnonKey && supabaseAnonKey.length > 50) { // Basic check for key length
  try {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    console.log("supabaseClient.js: Supabase client initialized successfully.");
  } catch (error) {
    console.error("supabaseClient.js: Error creating Supabase client:", error);
    // In a real app, you might throw this error or handle it more gracefully
    // For now, supabaseInstance will remain null if creation fails.
  }
} else {
  console.error(
    "supabaseClient.js: Supabase URL or Anon Key is MISSING or INVALID in your .env file. " +
    "1. Ensure .env file exists in the project ROOT. " +
    "2. Ensure it contains REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY. " +
    "3. Ensure you RESTARTED your development server (npm start) after changes to .env. " +
    "URL must start with 'https://'. Key must be a long string."
  );
  // supabaseInstance will remain null.
}

// This is the NAMED EXPORT that App.js will import.
// It exports the 'supabase' client instance (or null if initialization failed).
export const supabase = supabaseInstance;

/*
------------------------------------------------------------------------------------------
REMINDER FOR .env FILE (if using Create React App):
------------------------------------------------------------------------------------------
1.  File Name: `.env`
    Location: In the ROOT directory of your `daycare-app-frontend` project
              (the same level as your `package.json` file, NOT inside the `src` folder).

2.  Content Example (replace with YOUR actual values):
    REACT_APP_SUPABASE_URL=https://your-actual-url.supabase.co
    REACT_APP_SUPABASE_ANON_KEY=your-very-long-anon-key

    * NO quotes around the values.
    * NO semicolons at the end of the lines.

3.  After creating or changing the `.env` file, you MUST:
    * STOP your development server (Ctrl + C in the terminal).
    * RESTART it (`npm start`).
------------------------------------------------------------------------------------------
*/
