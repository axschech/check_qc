var http = require('http');
var url = require('url');
var cheerio = require('cheerio');
var fs = require('fs');
var moment = require('moment');

var twitter = require('twitter');

try {
    var credentials = JSON.parse(fs.readFileSync('secrets.json', 'utf8'));
} catch (e) {
    console.log('credentials are missing');
    return;
}

var client = new twitter(credentials.twitter);
var params = {
    screen_name: 'axschech',
    status: ' http://questionablecontent.net \nThis tweet was generated by https://github.com/axschech/check_qc'
};


var mandrill = require('mandrill-api/mandrill');
var mandrill_client = new mandrill.Mandrill(credentials.mandrill.key);

var mandrill_message = {
    "from_email": "no-reply@axschech.com",
    "from_name": "No Reply",
    "to": [{
            "email": "ax.schech@gmail.com",
            "name": "Alex Schechter",
            "type": "to"
    }]
};

var file = 'img.json';
var log = 'log.txt';
var craftMessage = function(message) {
        var data = {
            time: moment().format('YYYY/MM/DD hh:mm:ss'),
            status: message
        };
        console.log(data);
        fs.appendFileSync(log, JSON.stringify(data) + "\n", 'utf8');
};
var work = function () {
    var html = "";
    var content;
    try {
        content = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        content = undefined;
    }

    var curImg;
    if (content !== undefined) {
        curImg = content['img'];
    }
    var dat_rand = Math.floor(Math.random() * 99999) + 1000;
    var req = http.request(
        {
            hostname: 'questionablecontent.net',
            path: '/?rand=' + dat_rand,
            headers: {'Cache control': 'no cache'}
        },
        function (response) {
        response.setEncoding('utf8');
        response.on('data', function (chunk) {
            html += chunk;
        });

        response.on('end', function () {
            var $ = cheerio.load(html);
            $('img').each(function (img, test) {
                if (img === 3) {
                    var parsed = url.parse($(test).attr('src'));
                    var pathname = parsed.pathname;
                    var splits = pathname.split('/');
                    var more = splits[2].split('.');
                    var imgNum = more[0];
                    content = {
                        "img": parseInt(imgNum)
                    };
                    if (!curImg) {
                        fs.writeFileSync(file, JSON.stringify(content), 'utf8');
                        curImg = imgNum;
                    }
                    if (parseInt(imgNum) === parseInt(curImg)) {
                        craftMessage(false);
                    } else {
                        content['img'] = imgNum;
                        fs.writeFileSync(file, JSON.stringify(content), 'utf8');
                        craftMessage('wrote file');
                        curImg = imgNum;
                        params.status = "QC number "+curImg+" is up!" + params.status;
                        client.post('statuses/update', params, function (error) {
                            if(error) {
                                craftMessage(error);
                            } else {
                                craftMessage('tweeted');
                            }
                        });
                        mandrill_message.html = "<h1> Questionable Content <a href='http://questionablecontent.net'>" + curImg + "</a> is up </h1>";
                        mandrill_message.html += "<p>For faster updates check <a href='http://twtter.com/check_qc'>Twitter</a></p>";
                        mandrill_message.html += "<p><small>This email was sent from <a href='http://github.com/axschech/check_qc'>check_qc</a></small></p>";
                        mandrill_message.subject = moment().format('YYYY/MM/DD hh:mm:ss') + " QC is up!";
                        mandrill_client.messages.send({"message": mandrill_message}, function(result) {
                            craftMessage({mandril: result[0], sent: mandrill_message});

                        }, function(e) {
                            craftMessage(e);
                            // Mandrill returns the error as an object with name and message keys
                            console.log('A mandrill error occurred: ' + e.name + ' - ' + e.message);
                            // A mandrill error occurred: Unknown_Subaccount - No subaccount exists with the id 'customer-123'
                        });
                    }
                }
            });
        });
    });
    req.on('error', function(error) {
        console.log(error);
    });
    req.end();
};

work();

setInterval(function () {
    work();
}, 30000);
