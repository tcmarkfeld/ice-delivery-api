const jwt = require("jsonwebtoken");
const jwtDecode = require("jwt-decode");
require("dotenv").config();

function validateToken(req, res) {
  const token = req.headers["auth-token"];

  if (!token) {
    return res.status(403).send("Token invalid");
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) {
      return res.status(403).send("Token invalid");
    } else {
      var test = jwtDecode(token);
      if (test.role !== "admin") {
        return res.status(403).send("Token invalid");
      }
      return (req.user = user);
    }
  });
}

module.exports.validateToken = validateToken;
