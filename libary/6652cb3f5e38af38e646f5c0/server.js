const express = require('express');
const app = express();
const PORT = "";

app.get('/', (re, res) => {
    res.send('Hello World!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})