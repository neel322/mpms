const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const taskController = require('../controllers/taskController');
const verifyToken = require('../middleware/auth');

router.use(verifyToken); // All project routes require valid JWT

router.get('/', projectController.getProjects);
router.post('/', projectController.createProject);
router.get('/:projectId/members', projectController.getProjectMembers);
router.post('/:projectId/members', projectController.addProjectMember);
router.patch('/:projectId/status', projectController.toggleProjectStatus);

// Tasks under a project
router.get('/:projectId/tasks', taskController.getProjectTasks);
router.post('/:projectId/tasks', taskController.createTask);

module.exports = router;