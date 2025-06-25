import express from 'express';
const router = express.Router();

router.get('/', (req, res) => {
  res.send('✅ test-route is working correctly');
});

export default router;
