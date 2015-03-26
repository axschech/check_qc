var http = require('http');
var url = require('url');
var cheerio = require('cheerio');
var fs = require('fs');

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
    status: ' This tweet was generated by https://github.com/axschech/code_snippets/blob/master/check_qc/check_qc.js'
};


var mandrill = require('mandrill-api/mandrill');
var mandrill_client = new mandrill.Mandrill(credentials.mandrill.key);

var message = {
    "subject": "example subject",
    "from_email": "message.from_email@example.com",
    "from_name": "Some Name",
    "to": [{
            "email": "ax.schech@gmail.com",
            "name": "Alex Schechter",
            "type": "to"
    }]
};


var html = "";
var file = 'img.json';
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

var work = function () {

    http.get('http://questionablecontent.net', function (response) {
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
                        console.log(true);
                    } else {
                        console.log(false);
                        content['img'] = imgNum;
                        fs.writeFileSync(file, JSON.stringify(content), 'utf8');
                        curImg = imgNum;
                        params.status = "QC number "+curImg+" is up!" + params.status;
                        client.post('statuses/update', params, function (error) {
                            console.log(error);
                        });
                        message.html = "<h1> Questionable Content <a href='http://questionablecontent.net'>" + curImg + "</a> is up </h1>";
                        mandrill_client.messages.send({"message": message}, function(result) {
                            console.log(result);

                        }, function(e) {
                            // Mandrill returns the error as an object with name and message keys
                            console.log('A mandrill error occurred: ' + e.name + ' - ' + e.message);
                            // A mandrill error occurred: Unknown_Subaccount - No subaccount exists with the id 'customer-123'
                        });
                    }
                }
            });
        });
    });

};

work();

setInterval(function () {
    work();
}, 30000);
