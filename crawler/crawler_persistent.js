const { firefox, chromium } = require("playwright-extra")
const fs = require("fs");
const readline = require("readline");
const path = require("path")

const stealth = require('puppeteer-extra-plugin-stealth')()

async function startCrawling() {
    const arg = process.argv.slice(2);
   
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    if (arg[0] != undefined) {

        const folders_name = arg[0].replaceAll("\.", "_");
        const url = createURL(arg[0]);
        const hostName = getHostName(url.hostname);
        const allRequests = [];
        const allResponses = [];
        const path_to_extension = path.join(__dirname, 'chromium_extensions/google_translate');
        const main_path = `../../Crawler_data/Websites/${folders_name}/`

        fs.mkdir(path.join(main_path, 'persistent'), { recursive: true }, (err) => {
            if (err) throw err;
            fs.mkdir(path.join(main_path, 'data'), { recursive: true }, (err) => {
                if (err) throw err;
            });
            
            console.log("CRAWLER: -- Site\'s folder created. --");
        });

        const launchOptions = {
            headless: false,
            viewport: null,
            args: [
                `--disable-extensions-except=${path_to_extension}`,
                `--load-extension=${path_to_extension}`,
                `--no-sandbox`,
                `--enable-chrome-browser-cloud-management`,
                `--diable-infobars`,
                `--disable-blink-features=AutomationControlled`
            ],
            ignoreDefaultArgs: ['--enable-automation']
        };  
        
        const context = await chromium.launchPersistentContext(path.join(main_path, 'persistent'), launchOptions);

        const page = await context.newPage();

        page.on('request', async request => {
            allRequests.push(await collectNetTraffic(request, null));
        });
        
        page.on('response', async response => {
            allResponses.push(await collectNetTraffic(null, response));
        });

        await page.goto(url.toString(), { waitUntil: "load", timeout: 0 });

        rl.question('CRAWLER: Type "exit" to terminate crawler and save data, or any key to kill it (without saving any data)\n', async (input) => {
            if (input.trim().toLowerCase() === "exit") {
                console.info('CRAWLER: Saving data and exiting.');

                await collectCookies(context, path.join(main_path, 'data/all_cookies.json'), hostName);
                
                await context.close();

                writeToFile(path.join(main_path, 'data/all_requests.json'), JSON.stringify(allRequests, null, 2), "Requests");
                writeToFile(path.join(main_path, 'data/all_responses.json'), JSON.stringify(allResponses, null, 2), "Responses");

                rl.close();
            } else {
                console.info('CRAWLER: Exiting.. Data will not be saved.');
                
                rl.close();
                process.exit(0);
            }
        });
    } else {
        console.error("CRAWLER: ## Wrong input. ##");
        console.error("CRAWLER: ## Usage: node crawler.js <domain name of site to crawl> ##");
    }
}

async function collectCookies(context, siteFolder, name) {
    const cookies = await context.cookies();
    const first = [];
    const third = [];
    const allCookies = {
        first_party: null,
        third_party: null 
    };

    cookies.forEach(element => {
        if (element.domain.includes(name))
            first.push(element);
        else 
            third.push(element); 
    });

    allCookies.first_party = first;
    allCookies.third_party = third;

    writeToFile(siteFolder, JSON.stringify(allCookies, null, 2), "Cookies");
}

async function collectNetTraffic(request, response) {
    if (response === null) {
        const data = {
            url: request.url(),
            method: request.method(),
            headers: request.headers(),
            postData: request.postData()
        }

        return data;
    } else {
        const data = {
            url: response.url(),
            status: response.status(),
            headers: response.headers(),
            body: null
        }

        const res_body = await response.text().catch(e => null);

        if (res_body) 
            data.body = res_body;

        return data;
    }
}

function writeToFile(fileName, contentToWrite, contentType) {
    fs.writeFile(fileName, contentToWrite, (err) => {
        if (err) throw err;
        console.info(`CRAWLER: -- ${contentType} successfully stored. --`);
    });
}

function createURL(name) {
    var url;

    if (name.includes("http://" || "https://")) {
        url = new URL(name);
    } else {
        const tmp = "https://".concat(name);
        url = new URL(tmp);
    }

    return url;
}

function getHostName(name) {
    var host;

    if (name.includes("www.")) {
        host = name.slice(4);
    } else {
        host = name;
    }

    return host;
}

startCrawling();
