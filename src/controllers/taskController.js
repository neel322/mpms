const db = require('../config/db');

// Get all tasks for a project
exports.getProjectTasks = async (req, res) => {
  const { projectId } = req.params;
  try {
    const query = `
      SELECT t.*, 
        u.name AS assignee_name, 
        u.email AS assignee_email
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.project_id = $1
      ORDER BY t.created_at DESC;
    `;
    const result = await db.query(query, [projectId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
// CREATE TASK: Only Project Admins can create and assign tasks
exports.createTask = async (req, res) => {
  const { projectId } = req.params;
  const { title, description, assignee_id, priority, due_date } = req.body;

  if (!title || title.trim() === '') {
    return res.status(400).json({ error: 'Task title is required.' });
  }

  try {
    // Check if requester is a project admin
    const adminCheck = await db.query(
      `SELECT role FROM public.project_members WHERE project_id = $1 AND user_id = $2;`,
      [projectId, req.user.id]
    );

    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Permission denied: Only project admins can create and assign tasks.' });
    }

    const cleanDueDate = due_date && due_date.trim() !== '' ? new Date(due_date).toISOString() : null;
    const cleanAssignee = assignee_id && String(assignee_id).trim() !== '' ? parseInt(assignee_id, 10) : null;
    const cleanPriority = ['low', 'medium', 'high'].includes(priority) ? priority : 'medium';

    const insertQuery = `
      INSERT INTO public.tasks (project_id, title, description, assignee_id, priority, due_date, status, completed_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'todo', NULL)
      RETURNING *;
    `;
    const result = await db.query(insertQuery, [
      projectId,
      title.trim(),
      description ? description.trim() : '',
      cleanAssignee,
      cleanPriority,
      cleanDueDate
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating task:', err);
    res.status(500).json({ error: err.message });
  }
};

// UPDATE STATUS: Only assignee or admin can edit; if already completed, ONLY admin can change it
exports.updateTaskStatus = async (req, res) => {
  const { taskId } = req.params;
  const { status } = req.body;

  if (!['todo', 'in_progress', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value.' });
  }

  try {
    // 1. Fetch current task state
    const taskRes = await db.query(`SELECT * FROM public.tasks WHERE id = $1;`, [taskId]);
    if (taskRes.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found.' });
    }
    const task = taskRes.rows[0];

    // 2. Fetch requester role in this project
    const memberRes = await db.query(
      `SELECT role FROM public.project_members WHERE project_id = $1 AND user_id = $2;`,
      [task.project_id, req.user.id]
    );

    if (memberRes.rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this project.' });
    }

    const isAdmin = memberRes.rows[0].role === 'admin';
    const isAssignee = task.assignee_id === req.user.id;

    // Check basic participation: must be admin or assignee
    if (!isAdmin && !isAssignee) {
      return res.status(403).json({ error: 'Only the assignee or project admin can update this task.' });
    }

    // LOCK: If already completed, block non-admins from changing anything
    if (task.status === 'completed' && !isAdmin) {
      return res.status(403).json({ 
        error: 'This task is completed and locked. Only a project admin can reopen or edit it.' 
      });
    }

    // 3. Update status and timestamp safely
    const updateQuery = `
      UPDATE public.tasks
      SET status = $1::text,
          completed_at = CASE 
            WHEN $1::text = 'completed' THEN CURRENT_TIMESTAMP 
            ELSE NULL 
          END
      WHERE id = $2
      RETURNING *;
    `;
    const updated = await db.query(updateQuery, [status, taskId]);
    res.json(updated.rows[0]);
  } catch (err) {
    console.error('Error updating status:', err);
    res.status(500).json({ error: err.message });
  }
};

// Delete task (Admin only)
exports.deleteTask = async (req, res) => {
  const { taskId } = req.params;
  try {
    const taskRes = await db.query(`SELECT project_id FROM tasks WHERE id = $1;`, [taskId]);
    if (taskRes.rows.length === 0) return res.status(404).json({ error: 'Task not found.' });

    const memRes = await db.query(
      `SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2;`,
      [taskRes.rows[0].project_id, req.user.id]
    );

    if (memRes.rows.length === 0 || memRes.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Only project admins can delete tasks.' });
    }

    await db.query(`DELETE FROM tasks WHERE id = $1;`, [taskId]);
    res.json({ message: 'Task deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};