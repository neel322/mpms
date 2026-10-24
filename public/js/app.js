let currentUser = null;
let currentProject = null;
let currentTasks = [];
let currentMembers = [];

// ========================
// AUTHENTICATION & BOOT
// ========================

function getToken() {
  return localStorage.getItem('token');
}

function setAuth(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
  currentUser = user;
}

function logout() {
  localStorage.clear();
  window.location.reload();
}

async function checkAuth() {
  const token = getToken();
  if (!token) {
    showAuthScreen();
    return;
  }

  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Expired');
    const data = await res.json();
    currentUser = data.user;
    showAppScreen();
  } catch (err) {
    logout();
  }
}

function showAuthScreen() {
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('appScreen').classList.add('hidden');
}

function showAppScreen() {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');
  document.getElementById('userNameDisplay').textContent = currentUser.name;
  document.getElementById('userEmailDisplay').textContent = currentUser.email;

  // Re-render SVG icons for newly visible elements (Logout, Plus, etc.)
  if (window.lucide) {
    lucide.createIcons();
  }

  loadProjects();
}

function switchAuthTab(type) {
  const tabLogin = document.getElementById('tabLogin');
  const tabReg = document.getElementById('tabRegister');
  const formLogin = document.getElementById('loginForm');
  const formReg = document.getElementById('registerForm');
  const errDiv = document.getElementById('authError');
  errDiv.classList.add('hidden');

  if (type === 'login') {
    tabLogin.className = 'flex-1 py-2 text-xs font-bold rounded-lg bg-white shadow-sm text-slate-900 transition';
    tabReg.className = 'flex-1 py-2 text-xs font-bold rounded-lg text-slate-500 transition';
    formLogin.classList.remove('hidden');
    formReg.classList.add('hidden');
  } else {
    tabReg.className = 'flex-1 py-2 text-xs font-bold rounded-lg bg-white shadow-sm text-slate-900 transition';
    tabLogin.className = 'flex-1 py-2 text-xs font-bold rounded-lg text-slate-500 transition';
    formReg.classList.remove('hidden');
    formLogin.classList.add('hidden');
  }
}

// ========================
// PROJECTS
// ========================

let currentProjectFilter = 'all'; // 'all' | 'active' | 'completed'

// 1. Fetch filtered projects directly from backend database
async function loadProjects() {
  try {
    const url = currentProjectFilter === 'all' 
      ? '/api/projects' 
      : `/api/projects?status=${currentProjectFilter}`;

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });

    if (!res.ok) throw new Error('Failed to fetch projects');

    const projects = await res.json();
    renderProjectList(projects);
  } catch (err) {
    console.error('Failed to load projects from DB:', err);
  }
}

// 2. Tab switcher triggers a fresh DB fetch
function setProjectFilter(filter) {
  currentProjectFilter = filter;

  // Visual button styling
  const btnAll = document.getElementById('filterProjAll');
  const btnActive = document.getElementById('filterProjActive');
  const btnCompleted = document.getElementById('filterProjCompleted');

  const activeClass = 'flex-1 py-1.5 text-center rounded-lg bg-white shadow-sm text-slate-900 font-bold transition';
  const inactiveClass = 'flex-1 py-1.5 text-center rounded-lg text-slate-500 hover:text-slate-700 font-semibold transition';

  if (btnAll) btnAll.className = filter === 'all' ? activeClass : inactiveClass;
  if (btnActive) btnActive.className = filter === 'active' ? activeClass : inactiveClass;
  if (btnCompleted) btnCompleted.className = filter === 'completed' ? activeClass : inactiveClass;

  // Query database with the new filter
  loadProjects();
}

// 3. Render the list returned by PostgreSQL
function renderProjectList(projects) {
  const container = document.getElementById('projectList');
  if (!container) return;
  container.innerHTML = '';

  if (!projects || projects.length === 0) {
    container.innerHTML = `
      <div class="text-center py-8 text-xs text-slate-400 font-medium">
        No ${currentProjectFilter === 'all' ? '' : currentProjectFilter} projects found.
      </div>
    `;
    return;
  }

  projects.forEach(p => {
    const isSelected = currentProject && currentProject.id === p.id;
    const isCompleted = p.status === 'completed';

    const card = document.createElement('div');
    card.className = `p-3.5 rounded-2xl border cursor-pointer transition ${
      isSelected 
        ? 'bg-indigo-50/80 border-indigo-200 shadow-sm' 
        : 'bg-white hover:bg-slate-50/80 border-slate-200/80'
    }`;
    card.onclick = () => selectProject(p);

    const statusPill = isCompleted
      ? `<span class="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
           <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Completed
         </span>`
      : `<span class="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
           <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Pending
         </span>`;

    card.innerHTML = `
      <div class="flex items-center justify-between gap-2">
        <h4 class="font-bold text-sm ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-900'} truncate">
          ${escapeHtml(p.name)}
        </h4>
        <span class="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${p.current_user_role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}">
          ${p.current_user_role}
        </span>
      </div>
      <p class="text-xs text-slate-400 line-clamp-1 mt-1">${escapeHtml(p.description || 'No description')}</p>
      
      <div class="flex items-center justify-between text-[11px] text-slate-400 font-semibold mt-3 pt-2 border-t border-slate-100">
        <div class="flex items-center gap-2">
          <span>${p.completed_tasks || 0}/${p.total_tasks || 0} done</span>
          <span>•</span>
          <span>${p.member_count || 1} members</span>
        </div>
        ${statusPill}
      </div>
    `;
    container.appendChild(card);
  });

  if (window.lucide) lucide.createIcons();
}
async function toggleCurrentProjectCompletion() {
  if (!currentProject) return;

  const targetStatus = currentProject.status === 'completed' ? 'active' : 'completed';

  // If trying to complete the project, check if any task is unfinished
  if (targetStatus === 'completed') {
    const incompleteTasks = currentTasks.filter(t => t.status !== 'completed');

    if (incompleteTasks.length > 0) {
      alert(
        `Cannot complete project!\n\nThere ${incompleteTasks.length === 1 ? 'is still 1 remaining task' : `are still ${incompleteTasks.length} remaining tasks`} not marked as completed. Please complete all tasks before finishing this project.`
      );
      return;
    }

    if (!confirm('All tasks are finished. Are you sure you want to mark this project as completed?')) {
      return;
    }
  } else {
    if (!confirm('Reopen this project to active status?')) {
      return;
    }
  }

  try {
    const res = await fetch(`/api/projects/${currentProject.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ status: targetStatus })
    });

    const updated = await res.json();
    if (!res.ok) {
      alert(updated.error || 'Failed to update project status');
      return;
    }

    currentProject.status = updated.status;
    currentProject.completed_at = updated.completed_at;
    selectProject(currentProject);
  } catch (err) {
    console.error('Error toggling project completion:', err);
  }
}

async function selectProject(proj) {
  currentProject = proj;
  document.getElementById('noProjectSelected').classList.add('hidden');
  document.getElementById('projectDetailView').classList.remove('hidden');

  document.getElementById('projHeaderName').textContent = proj.name;
  document.getElementById('projHeaderDesc').textContent = proj.description || 'No description provided';
  document.getElementById('projRoleBadge').textContent = proj.current_user_role;

  const isAdmin = proj.current_user_role === 'admin';
  const isProjCompleted = proj.status === 'completed';

  // 1. Update Project Status Badge
  const statusBadge = document.getElementById('projStatusBadge');
  if (isProjCompleted) {
    statusBadge.className = 'inline-flex items-center gap-1 text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200';
    statusBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-indigo-600"></span> Finished';
  } else {
    statusBadge.className = 'inline-flex items-center gap-1 text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60';
    statusBadge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active';
  }

  // 2. Admin-Only Project Complete Toggle Button
  const toggleBtn = document.getElementById('btnToggleProjectComplete');
  const toggleText = document.getElementById('btnProjectCompleteText');
  if (isAdmin) {
    toggleBtn.classList.remove('hidden');
    if (isProjCompleted) {
      toggleBtn.className = 'inline-flex items-center gap-1.5 text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 px-3.5 py-2 rounded-xl transition';
      toggleText.textContent = 'Reopen Project';
    } else {
      toggleBtn.className = 'inline-flex items-center gap-1.5 text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3.5 py-2 rounded-xl transition';
      toggleText.textContent = 'Mark Completed';
    }
  } else {
    toggleBtn.classList.add('hidden');
  }

  // 3. Admin-Only Create Task Button (hide if not admin or if project is finished)
  const createTaskBtn = document.getElementById('btnOpenCreateTask');
  if (createTaskBtn) {
    if (isAdmin && !isProjCompleted) {
      createTaskBtn.classList.remove('hidden');
    } else {
      createTaskBtn.classList.add('hidden');
    }
  }

  await loadProjectMembers(proj.id);
  await loadProjectTasks(proj.id);
  loadProjects(); // refresh sidebar styles
  if (window.lucide) lucide.createIcons();
}

// ========================
// MEMBERS
// ========================

async function loadProjectMembers(projectId) {
  try {
    const res = await fetch(`/api/projects/${projectId}/members`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    currentMembers = await res.json();
    
    // Update count in header & modal
    document.getElementById('projMemberCount').textContent = currentMembers.length;
    const memberCountBadge = document.getElementById('memberCountBadge');
    if (memberCountBadge) {
      memberCountBadge.textContent = `${currentMembers.length} member${currentMembers.length === 1 ? '' : 's'}`;
    }

    // Populate task assignee dropdown in Create Task modal
    const assigneeSelect = document.getElementById('taskAssignee');
    if (assigneeSelect) {
      assigneeSelect.innerHTML = `<option value="">Unassigned</option>`;
      currentMembers.forEach(m => {
        assigneeSelect.innerHTML += `<option value="${m.user_id}">${escapeHtml(m.name)} (${m.role})</option>`;
      });
    }

    // Inside loadProjectMembers(projectId):
const isAdmin = currentProject && currentProject.current_user_role === 'admin';
const isCompleted = currentProject && currentProject.status === 'completed';

const addMemberSection = document.getElementById('addMemberSection');
const memberNoticeNonAdmin = document.getElementById('memberNoticeNonAdmin');

if (addMemberSection && memberNoticeNonAdmin) {
  if (isCompleted) {
    // Project is finished: hide invite form for everyone (including admins)
    addMemberSection.classList.add('hidden');
    memberNoticeNonAdmin.classList.remove('hidden');
    memberNoticeNonAdmin.innerHTML = `
      <i data-lucide="lock" class="w-4 h-4 text-slate-400"></i>
      <span>This project is completed and locked. Reopen the project to invite new members.</span>
    `;
  } else if (isAdmin) {
    // Project is active & user is admin
    addMemberSection.classList.remove('hidden');
    memberNoticeNonAdmin.classList.add('hidden');
  } else {
    // Project is active & user is a regular member
    addMemberSection.classList.add('hidden');
    memberNoticeNonAdmin.classList.remove('hidden');
    memberNoticeNonAdmin.innerHTML = `
      <i data-lucide="shield" class="w-4 h-4 text-slate-400"></i>
      <span>Only project admins can invite additional collaborators.</span>
    `;
  }
  if (window.lucide) lucide.createIcons();
}

    // Render roster
    const memberContainer = document.getElementById('memberListContainer');
    memberContainer.innerHTML = '';

    currentMembers.forEach(m => {
      const isSelf = currentUser && m.user_id === currentUser.id;
      const initials = (m.name || 'U')
        .split(' ')
        .map(n => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

      const roleBadge = m.role === 'admin'
        ? `<span class="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
             <i data-lucide="shield-check" class="w-3 h-3 text-indigo-600"></i> Admin
           </span>`
        : `<span class="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
             Member
           </span>`;

      const card = document.createElement('div');
      card.className = 'flex items-center justify-between p-3 bg-white border border-slate-200/80 rounded-2xl hover:bg-slate-50/60 transition';
      card.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-700 text-white font-bold text-xs flex items-center justify-center shadow-sm">
            ${initials}
          </div>
          <div>
            <div class="flex items-center gap-1.5">
              <p class="text-xs font-bold text-slate-900">${escapeHtml(m.name)}</p>
              ${isSelf ? '<span class="text-[10px] font-bold text-slate-400">(You)</span>' : ''}
            </div>
            <p class="text-[11px] text-slate-400">${escapeHtml(m.email)}</p>
          </div>
        </div>
        <div>
          ${roleBadge}
        </div>
      `;
      memberContainer.appendChild(card);
    });

    if (window.lucide) {
      lucide.createIcons();
    }
  } catch (err) {
    console.error('Failed to load members:', err);
  }
}

// ========================
// TASKS & METRICS
// ========================

async function loadProjectTasks(projectId) {
  try {
    const res = await fetch(`/api/projects/${projectId}/tasks`, {
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    currentTasks = await res.json();
    updateMetrics();
    applyFilters();
  } catch (err) {
    console.error('Failed to load tasks:', err);
  }
}

function updateMetrics() {
  const now = new Date();
  const total = currentTasks.length;
  const inProgress = currentTasks.filter(t => t.status === 'in_progress').length;
  const completed = currentTasks.filter(t => t.status === 'completed').length;
  const overdue = currentTasks.filter(t => t.status !== 'completed' && t.due_date && new Date(t.due_date) < now).length;

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statInProgress').textContent = inProgress;
  document.getElementById('statCompleted').textContent = completed;
  document.getElementById('statOverdue').textContent = overdue;

  // Calculate percentage
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  document.getElementById('projPercentText').textContent = `${percent}%`;
  document.getElementById('projProgressBar').style.width = `${percent}%`;
}

function applyFilters() {
  const searchVal = document.getElementById('taskSearchInput').value.toLowerCase().trim();
  const statusVal = document.getElementById('filterStatus').value;
  const priorityVal = document.getElementById('filterPriority').value;

  const filtered = currentTasks.filter(t => {
    const matchSearch = t.title.toLowerCase().includes(searchVal) || (t.description && t.description.toLowerCase().includes(searchVal));
    const matchStatus = statusVal === 'all' ? true : t.status === statusVal;
    const matchPriority = priorityVal === 'all' ? true : t.priority === priorityVal;
    return matchSearch && matchStatus && matchPriority;
  });

  renderTaskList(filtered);
}

function renderTaskList(tasks) {
  const container = document.getElementById('taskList');
  container.innerHTML = '';

  if (tasks.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
        <p class="text-xs font-bold text-slate-700">No tasks match your criteria.</p>
        <p class="text-[11px] text-slate-400">Try clearing filters or add a new task.</p>
      </div>
    `;
    return;
  }

  const now = new Date();

  tasks.forEach(task => {
    const isCompleted = task.status === 'completed';
    const isOverdue = !isCompleted && task.due_date && new Date(task.due_date) < now;
    const isAdmin = currentProject.current_user_role === 'admin';
    const isAssignee = task.assignee_id === currentUser.id;
    const canEditStatus = isAdmin || (isAssignee && !isCompleted);
    
    let actionHtml = '';

if (canEditStatus) {
  actionHtml = `
    <select onchange="updateStatus(${task.id}, this.value)" class="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 cursor-pointer focus:ring-2 focus:ring-indigo-500">
      <option value="todo" ${task.status === 'todo' ? 'selected' : ''}>To Do</option>
      <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
      <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>Completed</option>
    </select>
  `;
} else if (isCompleted) {
  // Completed & viewed by the assignee (or any non-admin)
  actionHtml = `
    <div class="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl cursor-not-allowed select-none" title="Completed tasks can only be reopened by a project admin">
      <i data-lucide="lock" class="w-3.5 h-3.5 text-emerald-600"></i>
      <span>Completed</span>
    </div>
  `;
} else {
  // Not completed, but assigned to someone else
  actionHtml = `
    <span class="text-xs font-semibold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 cursor-not-allowed select-none">
      ${task.status.replace('_', ' ').toUpperCase()}
    </span>
  `;
}
    const card = document.createElement('div');
    card.className = `p-4 bg-white border border-slate-200/80 rounded-2xl flex flex-col sm:flex-row justify-between gap-3 items-start sm:items-center transition ${isCompleted ? 'opacity-70 bg-slate-50/50' : ''}`;

    // Relative Due Badge
    let dueBadgeHtml = '';
    if (task.due_date) {
      const dueStr = new Date(task.due_date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      if (isCompleted) {
        dueBadgeHtml = `<span class="due-badge due-future"><i data-lucide="calendar" class="w-3 h-3"></i> Due ${dueStr}</span>`;
      } else if (isOverdue) {
        dueBadgeHtml = `<span class="due-badge due-overdue"><i data-lucide="alert-circle" class="w-3 h-3"></i> Overdue (${dueStr})</span>`;
      } else {
        dueBadgeHtml = `<span class="due-badge due-soon"><i data-lucide="clock" class="w-3 h-3"></i> Due ${dueStr}</span>`;
      }
    }

    // Assignee & Dates text
    const assigneeStr = task.assignee_name ? escapeHtml(task.assignee_name) : 'Unassigned';
    const completedStr = task.completed_at ? `<span class="text-emerald-600 font-semibold">• Completed ${new Date(task.completed_at).toLocaleDateString()}</span>` : '';

    card.innerHTML = `
      <div class="space-y-1.5 w-full">
        <div class="flex flex-wrap items-center gap-2">
          <h4 class="font-bold text-sm ${isCompleted ? 'line-through text-slate-400' : 'text-slate-900'}">${escapeHtml(task.title)}</h4>
          <span class="badge-priority badge-priority-${task.priority}">${task.priority}</span>
          <span class="badge-status badge-status-${task.status}">${task.status.replace('_', ' ')}</span>
          ${dueBadgeHtml}
        </div>
        <p class="text-xs text-slate-500">${escapeHtml(task.description || 'No description')}</p>
        <div class="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 font-medium pt-1">
          <span>Assignee: <strong class="text-slate-700">${assigneeStr}</strong></span>
          <span>•</span>
          <span>Created: ${new Date(task.created_at).toLocaleDateString()}</span>
          ${completedStr}
        </div>
      </div>

      <!-- Action Select & Controls -->
      <div class="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
        ${actionHtml}

        ${currentProject.current_user_role === 'admin' ? `
          <button onclick="deleteTask(${task.id})" class="text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition" title="Delete Task">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        ` : ''}
      </div>
    `;
    container.appendChild(card);
  });

  if (window.lucide) lucide.createIcons();
}

async function updateStatus(taskId, newStatus) {
  try {
    const res = await fetch(`/api/tasks/${taskId}/status`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}` 
      },
      body: JSON.stringify({ status: newStatus })
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Failed to update status');
      return;
    }
    loadProjectTasks(currentProject.id);
  } catch (err) {
    console.error('Error updating status:', err);
  }
}

async function deleteTask(taskId) {
  if (!confirm('Are you sure you want to delete this task?')) return;
  try {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${getToken()}` }
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Failed to delete');
      return;
    }
    loadProjectTasks(currentProject.id);
  } catch (err) {
    console.error('Error deleting task:', err);
  }
}

// ========================
// MODAL CONTROLS & EVENTS
// ========================

function openModal(id) { 
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }
}

function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', () => {
  // Auth Form Listeners
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errDiv = document.getElementById('authError');

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok) {
      setAuth(data.token, data.user);
      showAppScreen();
    } else {
      errDiv.textContent = data.error;
      errDiv.classList.remove('hidden');
    }
  });

  document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const errDiv = document.getElementById('authError');

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (res.ok) {
      setAuth(data.token, data.user);
      showAppScreen();
    } else {
      errDiv.textContent = data.error;
      errDiv.classList.remove('hidden');
    }
  });

  // Project Creation Listener
  document.getElementById('newProjectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('newProjName').value;
    const description = document.getElementById('newProjDesc').value;

    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}` 
      },
      body: JSON.stringify({ name, description })
    });
    if (res.ok) {
      closeModal('newProjectModal');
      document.getElementById('newProjectForm').reset();
      loadProjects();
    }
  });

  // Task Creation Listener
  const newTaskForm = document.getElementById('newTaskForm');
if (newTaskForm) {
  newTaskForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // 1. Guard check: make sure a project is selected
    if (!currentProject || !currentProject.id) {
      alert('Please select or create a project first before adding tasks.');
      return;
    }

    const titleInput = document.getElementById('taskTitle');
    const descInput = document.getElementById('taskDesc');
    const assigneeInput = document.getElementById('taskAssignee');
    const priorityInput = document.getElementById('taskPriority');
    const dueDateInput = document.getElementById('taskDueDate');

    const title = titleInput ? titleInput.value.trim() : '';
    if (!title) {
      alert('Task title cannot be empty.');
      return;
    }

    const payload = {
      title,
      description: descInput ? descInput.value.trim() : '',
      assignee_id: assigneeInput && assigneeInput.value ? assigneeInput.value : null,
      priority: priorityInput ? priorityInput.value : 'medium',
      due_date: dueDateInput && dueDateInput.value ? dueDateInput.value : null
    };

    console.log('Submitting task for project ID:', currentProject.id, payload);

    try {
      const res = await fetch(`/api/projects/${currentProject.id}/tasks`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}` 
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        closeModal('newTaskModal');
        newTaskForm.reset();
        await loadProjectTasks(currentProject.id);
        await loadProjects(); // Refresh sidebar task counter
      } else {
        console.error('Server error creating task:', data);
        alert(data.error || 'Failed to create task.');
      }
    } catch (err) {
      console.error('Network or fetch error:', err);
      alert('Could not connect to server to create task.');
    }
  });
}


  // Add Member Listener
  document.getElementById('addMemberForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('newMemberEmail').value;
    const role = document.getElementById('newMemberRole').value;

    const res = await fetch(`/api/projects/${currentProject.id}/members`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}` 
      },
      body: JSON.stringify({ email, role })
    });
    const data = await res.json();
    if (res.ok) {
      document.getElementById('newMemberEmail').value = '';
      loadProjectMembers(currentProject.id);
    } else {
      alert(data.error || 'Could not add member');
    }
  });

  checkAuth();
});