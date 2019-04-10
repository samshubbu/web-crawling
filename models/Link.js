const mongoose = require('mongoose')

const linksUrl = new mongoose.Schema({
    url: String,
    count: Number,
    params: {type: [], default:[]}
})

module.exports = mongoose.model('Link', linksUrl)