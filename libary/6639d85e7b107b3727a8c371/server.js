const express = require('express');
const app = express();
const port = 3000; 
const mysql = require('mysql2');
const adminRoutes = require('./routes/categoriesRoutes');

app.use(express.json());

app.use('/admin/category', adminRoutes);

app.get('/', (req, res) => {
    res.send('Hello, World!');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
