const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const verifyToken = require('../middleware/auth');

router.use(verifyToken);

router.patch('/:taskId/status', taskController.updateTaskStatus);
router.delete('/:taskId', taskController.deleteTask);

module.exports = router;