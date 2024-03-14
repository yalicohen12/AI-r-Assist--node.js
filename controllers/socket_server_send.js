const io = require("socket.io-client");
// let flaskSocket = io("http://localhost:5000");
let flaskSocket = null;
const app = require("express")();
const cors = require("cors");
app.use(cors());
const server = require("http").createServer(app);
const ioServer = require("socket.io")(server);
ioServer.on("connection", () => {
  console.log("client in");
});
ioServer.listen(8080);

function send_prompt(prompt, memory, anotation) {
  flaskSocket = io("http://localhost:5000");

  return new Promise((resolve, reject) => {
    const aiResponseChunks = [];

    // Event handler for receiving generated text chunks
    flaskSocket.on("generated_text", (data) => {
      // process.stdout.write(data.text_chunk);
      aiResponseChunks.push(data.text_chunk);
      ioServer.emit("generated_text", data.text_chunk);
    });
    flaskSocket.on("stream_end", () => {
      const aiResponse = aiResponseChunks.join("");
      ioServer.emit("stream_end");
      ioServer.disconnectSockets();
      flaskSocket.disconnect();
      resolve(aiResponse);
    });

    flaskSocket.on("error", (error) => {
      reject(error);
    });

    flaskSocket.emit("generate_text", { prompt, memory, anotation });
  });
}

// send_prompt("write 3 words");

module.exports = send_prompt;
