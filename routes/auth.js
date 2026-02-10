const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const { loginValidation } = require("../validation");
const verifyToken = require("./verifyToken");
const connection = require("../database").connect;

const router = express.Router();

const runQuery = (sql, params = []) =>
  new Promise((resolve, reject) => {
    connection.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });

router.post("/user/login", async (req, res) => {
  try {
    const loginPerson = {
      email: req.body.email,
      password: req.body.password,
    };

    const { error } = loginValidation(loginPerson);
    if (error) {
      return res.status(400).json({ message: error.details[0].message });
    }

    const users = await runQuery(
      "SELECT id, email, role, password FROM users WHERE email = ? AND role = 'admin' LIMIT 1",
      [loginPerson.email]
    );

    if (!users.length) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(loginPerson.password, user.password);

    if (!validPassword) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const secretToken = process.env.ACCESS_TOKEN_SECRET;
    if (!secretToken) {
      return res.status(500).json({ message: "ACCESS_TOKEN_SECRET is not configured" });
    }

    const token = jwt.sign(
      {
        _id: user.id,
        username: user.email,
        role: user.role,
      },
      secretToken,
      { expiresIn: "7d" }
    );

    return res.status(200).json({ token });
  } catch (err) {
    return res.status(500).json({ message: "Login failed", error: err.message });
  }
});

router.get("/", (req, res) => {
  verifyToken.validateToken(req, res);
  return res.status(200).send("Token valid");
});

module.exports = router;
