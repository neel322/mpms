const db = require('../config/db');

// List projects where the user is either owner or member
exports.getProjects = async (req, res) => {
  const { status } = req.query; // 'all', 'active', or 'completed'

  try {
    let query = `
      SELECT DISTINCT p.id, p.name, p.description, 
        COALESCE(LOWER(p.status), 'active') AS status, 
        p.completed_at, p.created_at,
        u.name AS owner_name, 
        pm.role AS current_user_role,
        (SELECT COUNT(*) FROM public.project_members WHERE project_id = p.id)::int AS member_count,
        (SELECT COUNT(*) FROM public.tasks WHERE project_id = p.id)::int AS total_tasks,
        (SELECT COUNT(*) FROM public.tasks WHERE project_id = p.id AND LOWER(status) = 'completed')::int AS completed_tasks
      FROM public.projects p
      JOIN public.users u ON p.owner_id = u.id
      JOIN public.project_members pm ON pm.project_id = p.id
      WHERE pm.user_id = $1
    `;

    const params = [req.user.id];

    if (status === 'completed') {
      query += ` AND LOWER(p.status) = 'completed'`;
    } else if (status === 'active' || status === 'pending') {
      query += ` AND (LOWER(p.status) = 'active' OR p.status IS NULL)`;
    }

    query += ` ORDER BY p.created_at DESC;`;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching projects:', err);
    res.status(500).json({ error: err.message });
  }
};

// Create a new project and add the creator as admin
exports.createProject = async (req, res) => {
  const { name, description } = req.body;
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'Project name is required.' });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const projectRes = await client.query(
      `INSERT INTO projects (name, description, owner_id)
       VALUES ($1, $2, $3) RETURNING *;`,
      [name.trim(), description ? description.trim() : '', req.user.id]
    );
    const newProject = projectRes.rows[0];

    // Auto-enroll creator as project admin
    await client.query(
      `INSERT INTO project_members (project_id, user_id, role)
       VALUES ($1, $2, 'admin');`,
      [newProject.id, req.user.id]
    );

    await client.query('COMMIT');
    res.status(201).json(newProject);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// Toggle Project Status between 'active' and 'completed' (Admin only)
exports.toggleProjectStatus = async (req, res) => {
  const { projectId } = req.params;
  const { status } = req.body;

  if (!['active', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Status must be active or completed.' });
  }

  try {
    // 1. Verify caller has admin role
    const adminCheck = await db.query(
      `SELECT role FROM public.project_members WHERE project_id = $1 AND user_id = $2;`,
      [projectId, req.user.id]
    );

    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Only project admins can change the project status.' });
    }

    // 2. If attempting to mark as completed, ensure no pending tasks exist
    if (status === 'completed') {
      const taskCheck = await db.query(
        `SELECT COUNT(*)::int AS remaining 
         FROM public.tasks 
         WHERE project_id = $1 AND status != 'completed';`,
        [projectId]
      );

      const remainingCount = taskCheck.rows[0].remaining;
      if (remainingCount > 0) {
        return res.status(400).json({ 
          error: `Cannot complete project: there ${remainingCount === 1 ? 'is 1 task' : `are ${remainingCount} tasks`} remaining. Complete all tasks first.` 
        });
      }
    }

    // 3. Update project status and completed_at timestamp
    const updateQuery = `
      UPDATE public.projects
      SET status = $1::text,
          completed_at = CASE 
            WHEN $1::text = 'completed' THEN CURRENT_TIMESTAMP 
            ELSE NULL 
          END
      WHERE id = $2
      RETURNING *;
    `;
    const updated = await db.query(updateQuery, [status, projectId]);
    res.json(updated.rows[0]);
  } catch (err) {
    console.error('Error toggling project status:', err);
    res.status(500).json({ error: err.message });
  }
};

// Fetch members of a specific project
exports.getProjectMembers = async (req, res) => {
  const { projectId } = req.params;
  try {
    const query = `
      SELECT pm.id, pm.role, pm.joined_at, u.id AS user_id, u.name, u.email
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = $1
      ORDER BY pm.role ASC, u.name ASC;
    `;
    const result = await db.query(query, [projectId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Add a team member by email
exports.addProjectMember = async (req, res) => {
  const { projectId } = req.params;
  const { email, role } = req.body;

  if (!email || email.trim() === '') {
    return res.status(400).json({ error: 'Member email is required.' });
  }

  try {
    // 1. Check project status (lock if completed)
    const projectRes = await db.query(
      `SELECT status FROM public.projects WHERE id = $1;`,
      [projectId]
    );
    if (projectRes.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }
    if (projectRes.rows[0].status === 'completed') {
      return res.status(400).json({ 
        error: 'This project is completed and locked. Reopen the project to add new members.' 
      });
    }

    // 2. Check if requester has admin role
    const permCheck = await db.query(
      `SELECT role FROM public.project_members WHERE project_id = $1 AND user_id = $2;`,
      [projectId, req.user.id]
    );
    if (permCheck.rows.length === 0 || permCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Permission denied: Only project admins can add team members.' });
    }

    // 3. Find user and insert member
    const userRes = await db.query(
      `SELECT id, name, email FROM public.users WHERE email = LOWER(TRIM($1));`,
      [email]
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'No registered user found with this email.' });
    }
    const targetUser = userRes.rows[0];

    const insertRes = await db.query(
      `INSERT INTO public.project_members (project_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (project_id, user_id) DO NOTHING
       RETURNING *;`,
      [projectId, targetUser.id, role === 'admin' ? 'admin' : 'member']
    );

    if (insertRes.rows.length === 0) {
      return res.status(400).json({ error: 'User is already a member of this project.' });
    }

    res.status(201).json({
      message: 'Member added successfully.',
      member: { ...targetUser, role: insertRes.rows[0].role }
    });
  } catch (err) {
    console.error('Error adding project member:', err);
    res.status(500).json({ error: err.message });
  }
};
