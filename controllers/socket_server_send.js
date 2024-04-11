const io = require("socket.io-client");
// let flaskSocket = io("http://localhost:5000");
let flaskSocket = null;
const app = require("express")();
const cors = require("cors");
app.use(cors());
const server = require("http").createServer(app);
const ioServer = require("socket.io")(server);
ioServer.on("connection", () => {
  console.log("node socket client in");
});
ioServer.listen(8080);

function send_prompt(prompt, memory, anotation, fileData) {
  flaskSocket = io("http://localhost:5000");

  return new Promise((resolve, reject) => {
    const aiResponseChunks = [];

    const timeoutId = setTimeout(() => {
      console.error(
        "Flask connection timed out after 15 seconds. Closing connection."
      );
      ioServer.emit("generated_text", "Model is unReachable try again");
      flaskSocket.disconnect();
      ioServer.emit("stream_end");
      ioServer.disconnectSockets();
      console.log("node socket client out");
      // reject(new Error("Flask connection timeout"));
    }, 40000);

    // Event handler for receiving generated text chunks
    flaskSocket.on("generated_text", (data) => {
      // process.stdout.write(data.text_chunk);
      clearTimeout(timeoutId);
      aiResponseChunks.push(data.text_chunk);
      ioServer.emit("generated_text", data.text_chunk);
    });
    flaskSocket.on("stream_end", () => {
      clearTimeout(timeoutId);
      const aiResponse = aiResponseChunks.join("");
      ioServer.emit("stream_end");
      ioServer.disconnectSockets();
      flaskSocket.disconnect();
      console.log("node socket client out");
      resolve(aiResponse);
    });

    flaskSocket.on("error", (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });

    flaskSocket.emit("generate_text", { prompt, memory, anotation, fileData });
  });
}

// send_prompt("write 3 words");

module.exports = send_prompt;
