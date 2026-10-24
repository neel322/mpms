# 📊 MPMS — Mini Project Management System

> **Full-stack web application for multi-tenant project management, role-governed task assignment, and workflow tracking.**  
> *Developed as an engineering task during an internship.*

MPMS (Mini Project Management System) is a clean, full-stack project governance and team collaboration platform. It allows users to register, create projects, invite team members, assign tasks with granular priorities and due dates, track workflow progress (To Do, In Progress, Completed), and monitor project health through real-time dashboards and filters.

---

## 📌 Internship Context
This project was developed as an internship backend and full-stack engineering task designed to demonstrate:
- Clean **MVC (Model-View-Controller)** architecture in Node.js and Express.
- Role-based project and task governance (enforcing permissions where only admins can invite members or mark projects completed).
- Relational data modeling and transactional operations in **PostgreSQL**.
- Secure authentication pipelines utilizing **JSON Web Tokens (JWT)** and **bcryptjs**.
- Defensive API validation and business rules (e.g., blocking project completion if unresolved tasks remain; locking completed tasks).

---

## ✨ Key Features

- **🔐 Authentication & Access Security:**
  - Secure registration and login with bcrypt password hashing.
  - Stateless JWT token authorization protecting all project and task endpoints.
- **📁 Project Governance & Lifecycle:**
  - Create and manage projects with distinct status flags (`pending`, `completed`).
  - **Completion Guard:** Project administrators can only mark a project completed after all associated tasks have been finished.
  - **Member Freeze:** Once a project is completed, adding new members is prevented.
- **👥 Role-Based Team Collaboration:**
  - Project admins can add members by email or username.
  - Team members can view fellow project contributors and their assigned responsibilities.
- **📋 Task Management & Workflow:**
  - Assign tasks to team members with title, description, priority (`low`, `medium`, `high`), status (`todo`, `in_progress`, `completed`), and due dates.
  - **Task Lock & Ownership:** Non-admin assignees can only update their own task progress; once completed, tasks cannot be altered unless modified by an administrator.
  - **Automatic Timestamping:** Records the exact timestamp (`completed_at`) when a task is completed.
- **📊 Real-Time Dashboard & Filters:**
  - Filter projects by completion status (`all`, `pending`, `completed`).
  - Search and filter tasks by status, priority, and assignee.
  - Instant project statistics and health metrics.

---

## 🛠️ Tech Stack

### Backend
- **Runtime:** Node.js & Express.js
- **Database:** PostgreSQL (compatible with Supabase or standard PostgreSQL)
- **Database Driver:** `pg` (node-postgres connection pool with automatic SSL support)
- **Authentication:** JSON Web Tokens (`jsonwebtoken`) & `bcryptjs`
- **CORS Support:** `cors`

### Frontend
- **Interface:** Semantic HTML5, Responsive Custom CSS3, Modern Vanilla JavaScript (ES6+)
- **Architecture:** Client-side SPA consuming RESTful JSON API endpoints

---

## 📁 Project Structure

```text
mpms/
├── public/
│   ├── css/
│   │   └── styles.css        # Dashboard styling, badges, modals & layout
│   ├── js/
│   │   └── app.js            # Client-side state, API calls, event listeners
│   └── index.html            # Main single-page interface
├── src/
│   ├── config/
│   │   └── db.js             # PostgreSQL connection pool & automatic table migrations
│   ├── controllers/
│   │   ├── authController.js # Registration, login, and current user resolution
│   │   ├── projectController.js # Project CRUD, member management & status toggle
│   │   └── taskController.js # Task assignment, status updates & completion locks
│   ├── middleware/
│   │   └── auth.js           # JWT verification middleware
│   ├── routes/
│   │   ├── authRoutes.js     # /api/auth endpoints
│   │   ├── projectRoutes.js  # /api/projects endpoints
│   │   └── taskRoutes.js     # /api/tasks endpoints
│   ├── app.js                # Express app configuration & middleware
│   └── server.js             # Server bootstrap & port listener
├── .env.example              # Environment variables template
├── .gitignore
├── package.json
└── README.md
```

---

## 🔌 API Endpoints Summary

| Method | Endpoint | Description | Auth Required |
|---|---|---|:---:|
| `POST` | `/api/auth/register` | Register new user | No |
| `POST` | `/api/auth/login` | Authenticate user & issue JWT | No |
| `GET` | `/api/auth/me` | Fetch authenticated user profile | Yes |
| `GET` | `/api/projects` | List all projects accessible to user | Yes |
| `POST` | `/api/projects` | Create a new project | Yes |
| `GET` | `/api/projects/:projectId/members` | Get project member list | Yes |
| `POST` | `/api/projects/:projectId/members` | Add member to project (Admin only) | Yes |
| `PATCH`| `/api/projects/:projectId/status` | Mark project completed/pending (Admin only) | Yes |
| `GET` | `/api/projects/:projectId/tasks` | Get all tasks for a project | Yes |
| `POST` | `/api/projects/:projectId/tasks` | Create and assign a task (Admin only) | Yes |
| `PATCH`| `/api/tasks/:taskId/status` | Update task progress / mark complete | Yes |
| `DELETE`| `/api/tasks/:taskId` | Delete task | Yes |

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- PostgreSQL database instance (local or hosted on [Supabase](https://supabase.com))

### 1. Installation
```bash
git clone <repository-url>
cd mpms
npm install
```

### 2. Configure Environment Variables
Create a `.env` file based on the provided template:
```bash
cp .env.example .env
```
Open `.env` and fill in your database connection string and secret key:
```env
PORT=3000
DATABASE_URL="postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
JWT_SECRET="your_jwt_secret_key_here"
```

### 3. Run Application
```bash
# Development mode with live reload
npm run dev

# Or standard production start
npm start
```
The server will start on `http://localhost:3000`. Open your browser and navigate to `http://localhost:3000`.

---

## 🏷️ Tags
`#internship` `#webdevelopment` `#nodejs` `#expressjs` `#postgresql` `#supabase` `#restapi` `#javascript` `#projectmanagement` `#fullstack`
