# Server HTMS
A middleware for express that allows you to process [htms](https://htms.fsh.plus) in the server side instead of the client side

## Usage
```js
const express = require('express');
const app = express();
const htms = require('server-htms');

app.use(htms)

app.get('/', (req, res) => {
  res.htms('file/path.html')
})
```