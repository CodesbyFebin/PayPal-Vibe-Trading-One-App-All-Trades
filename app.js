const express = require('express');
const { createApp } = require('./server');

module.exports = createApp({ app: express() });
