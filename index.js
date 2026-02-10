const mysql = require("mysql");
const express = require("express");
const dotenv = require("dotenv");
const app = express();
const http = require("http");
const cors = require("cors");
const connection = require("./database").connect;

// Loads the configuration from .env to process.env
dotenv.config();
const PORT = 23523;

//MiddleWare
app.use(cors());
app.use(express.json());

//Route MiddleWare
app.use("/api/delivery", require("./routes/delivery"));
app.use("/api/auth", require("./routes/auth"));

//Starts server
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});

const server = http.createServer(app);
server.listen(process.env.PORT);
