const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: connectionString && connectionString.includes('localhost')
    ? false
    : { rejectUnauthorized: false }
});

const initDB = async () => {
  const query = `
    -- Ensure columns exist
    ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES public.projects(id) ON DELETE CASCADE;
    ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assignee_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL;
    ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE DEFAULT NULL;
    ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

    -- Update constraint safely
    DO $$ 
    BEGIN 
      ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
      ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check 
        CHECK (status IN ('todo', 'in_progress', 'completed', 'pending'));
    EXCEPTION 
      WHEN OTHERS THEN NULL;
    END $$;
  `;
  try {
    await pool.query(query);
    console.log('Status constraint updated to include todo, in_progress, completed.');
  } catch (err) {
    console.error('Migration error:', err.message);
  }
};

initDB();

module.exports = pool;