const express = require('express');
const { layCauHinh, luuCauHinh } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(layCauHinh());
});

router.put('/', (req, res) => {
  const ketQua = luuCauHinh(req.body || {});
  res.json(ketQua);
});

module.exports = router;
