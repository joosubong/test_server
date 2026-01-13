const express = require("express");
const app = express();
const PORT = process.env.PORT || 3000;

const lottoRouter = require('./routes/lotto');


app.get("/", (req, res) => {
  res.send("서버 작동 중!");
});

app.use('/lotto', lottoRouter);


app.listen(PORT, () => {
  console.log("서버 시작:", PORT);
});