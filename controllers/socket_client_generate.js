const io = require("socket.io-client");

function startSocketClient() {
  const socket = io("http://localhost:5000");

  socket.on("connect", () => {
    console.log("Connected to socket flaskserver");
  });

  socket.on("error", (data) => {
    console.error("Error:", data.message);
  });

  socket.on("generated_text", (data) => {
    process.stdout.write(data.text_chunk);
  });

  const readline = require("readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("Enter prompt: ", (prompt) => {
    socket.emit("generate_text", { prompt });
    rl.close();
  });
}

startSocketClient();

module.exports = startSocketClient;
