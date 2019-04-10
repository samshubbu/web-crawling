const rp = require('request-promise');
const cheerio = require('cheerio');
const mongoose = require('mongoose');
const databaseConfig = require('./config/database').database;
const Link = require('./models/Link')

const websiteUrl = 'https://www.medium.com';
const validUrl = /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/g;


const start = async () => {

    // Database Connection 
    await mongoose
        .connect(databaseConfig)
        .then(() => {
            console.log('Connected to the Database ' + databaseConfig)
        })
        .catch((err) => {
            console.log(`Error in database connection`);
        })

    linksArr.push(websiteUrl);
    arrShift();

}

let linksArr = [];
let running = 0;  //number of active request
let max = 5;  // number of maximum connections

var options = {
    transform: function (body) {
        return cheerio.load(body); // Loading html page 
    }
};

const getLinks = (url) => {

    linksInsertionToDb(url);
    console.log(`Started Crawling ${url}`);
    return rp({ uri: url, ...options })
        .then(function ($) {

            $('body').find('a').each((i, el) => { // iterating on every href on the current html page
                let href = $(el).attr('href');
                if (href != null && href != undefined && validUrl.test(href)) { // checking for valid url
                    linksArr.push(href);
                }
            })
        })
        .catch(function (err) { `Crawling Falied for ${url}` });
}

const arrShift = () => {
    // console.log(running, linksArr.length)
    if (running < max && linksArr.length > 0) {  //if running connections are less hit more till max
        while (running < max) {
            if (linksArr.length == 0)
                break;
            running++;
            getLinks(linksArr.shift())
                .then(x => { running--; arrShift() })
                .catch(err => { running--; arrShift() });
        }
    }

    else if (linksArr.length == 0 && running == 0) {
        console.log('')
    }
}

const linksInsertionToDb = async (url) => {
    let paramKeys;
    let parsedUrl = url.split('?');
    if (parsedUrl.length > 1) {
        queryParams = parsedUrl[1].split('&');
        paramKeys = queryParams.map(p => (p.split('=')[0])).filter(p => !!p); // getting params keys
    }
    const link = await Link.findOne({ url: parsedUrl[0] }).exec();
    if (link) {
        (link.count == null || link.count == undefined) ? link.count = 0 : ''
        paramKeys ? link.params.addToSet(link.params.concat(paramKeys)) : ''
        link.count++;
        await link.save();
    }
    else {
        return Link.create({ url: parsedUrl[0], count: 1 })
    }
}

const onProcessInterrupt = async () => {
    max = 0;
    console.log('Interruption process flow by pressing CTRL + C')
    const pendingCount = linksArr.length
    linksArr = [];
    foundUrls = await Link.count();
    console.log(`Found ${foundUrls} URLS, Pending ${pendingCount} URLS`)
    process.exit(0)
}

process.on('SIGINT', () => { // listening on process termination / interruption
    onProcessInterrupt();
})

start(); // starting the connection

