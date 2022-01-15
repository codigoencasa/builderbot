const express = require('express')
const router = express.Router();
const { sendMessagePost } = require('../controllers/web')

router.post('/send', sendMessagePost)

module.exports = router