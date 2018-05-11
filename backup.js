

var alert = require('alert-node');
var express = require('express');
var path = require('path');
var cmd = require('node-cmd');
var app = express();
var bodyParser = require('body-parser');
var request = require('request');
var fs = require('fs');
var url = require('url');


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));


app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
// Setup template engines go here.




// home page
app.get('/', function (req, res) {
    var context = req.query

    res.render('index_old', context)
    // res.render('index')
})

function checkConnectivity(des_hostname, des_port, next) {
    cmd.get('ping -c 1 ' + des_hostname, function (err, data, stderr) {
        if (!err) {
            var des_ip = data.split(" ")[2].replace('(', '').replace(')', '');  // remove () from data return

            cmd.get('nmap -p ' + des_port + ' ' + des_hostname, function (err, data, stderr) {
                var result = data.split(" ")
                if (result.indexOf("open") > -1) {  // if port open 
                    console.log(des_hostname + ':' + des_port + '  ' + 'open')
                    var status = des_hostname + ':' + des_port + '  ' + 'open';
                    return next(true, des_ip, null, status)  // connectivity, des_ip, error, status
                } else {  // if port closed
                    console.log(des_hostname + ':' + des_port + '  ' + 'closed')
                    var status = des_hostname + ':' + des_port + '  ' + 'closed';
                    return next(false, null, err, status)  // connectivity, des_ip, error, status
                }
            })
        } else {
            console.log(des_hostname + '  ' + 'closed device')
            var status = des_hostname + '  ' + 'closed device';
            return next(false, null, err, status)  // connectivity, des_ip, error
        }
    })
}

// check_connectivity for use transfer service
app.get('/check_connect', function (req, res) {

    checkConnectivity(req.query.des_hostname, 8080, function (connectivity, des_ip, err, status) {
        if (connectivity == false) {  // can't connect
            var context = {
                connectivity: connectivity,
                status: status
            }
            res.redirect(url.format({
                pathname: "/",
                query: context
            })
            );
        } else {  // can connect
            var context = req.query
            context.des_ip = des_ip
            res.redirect(url.format({
                pathname: "/gridftp",
                query: context
            })
            );
        }
    })
    // req.query.connectivity = false

    // res.redirect('/')
    // console.log(req.query);
    // // res.json(req.query)
    // cmd.get('ping -c 1 ' + req.query.des_hostname, function (err, data, stderr) {
    //   if (!err) {
    //     console.log(data)
    //     var des_ip = data.split(" ")[2].replace('(', '').replace(')', '');
    //     // des_ip = des_ip.replace('(', '').replace(')', '')  // remove () from data return
    //     console.log(des_ip)
    //     res.send(des_ip)

    //   } else {
    //     // res.send('false')
    //     console.log(err);
    //     res.redirect('/');  // return to home page
    //   }
    // })
});

// internal function
function getFileList(ip, port, next) {
    request('http://' + ip + ':' + port + '/listfile', function (error, response, body) {
        // console.log('http://' + ip + ':8080/listfile')
        // console.log('error:', error); // Print the error if one occurred
        // console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
        // console.log('body:', body); // Print the HTML for the Google homepage.
        // console.log(body)

        next(JSON.parse(body))
    });
}




// transfer file by gsiftp
app.post('/gsiftp', function (req, res) {
    // console.log(req.body)
    // res.json(req.body)

    cmd.get('./transfer.sh gsiftp://' + req.body.source_name + '/home/guser/Desktop/' + req.body.source_file + ' gsiftp://' + req.body.des_name + '/home/guser/Desktop/' + req.body.source_file, function (err, data, stderr) {
        if (!err) {
            console.log('success : ', data)
            res.send('<h1> success law sus </h1> ')
            // res.redirect('/gridftp')
            // res.redirect(url.format({
            //             pathname:"/gridftp",
            //             query:req.query}) 
            //           );
        } else {
            console.log(err)
            res.send('<h1> False na ja </h1>')
            // res.redirect(url.format({
            //             pathname:"/gridftp",
            //             query:req.query}) 
            //           );
        }
    })

})





// gridftp page
app.get('/gridftp', function (req, res) {


    cmd.get('hostname', function (err, data, stderr) {  // get source hostname
        if (!err) {
            data = data.replace('\n', '')  // remove \n from data return
            var context = { source_hostname: data }

            cmd.get('hostname -I', function (err, data, stderr) {  // get souece ip
                if (!err) {
                    context.source_ip = data.replace('\n', '')  // remove \n from data return
                    getFileList("localhost", 8080, function (body) {

                        context.file_list = body  // get file list


                        context.destination_hostname = req.query.des_hostname  // get destination information from form
                        context.destination_ip = req.query.destination_ip
                        context.status = true

                        getFileList(context.destination_ip, 8080, function (result) {
                            context.des_file_list = result  // get file list of destination host
                            // res.render('gridftp', context)
                            res.send(context)
                        })
                    })

                } else {
                    console.log('error : ', err)
                    context.error = err
                    res.render('gridftp', context)
                }

            })

        } else {
            console.log('error : ', err)
            context.error = err
            res.render('gridftp', context)
        }
    })


})




// list files in file path (return json filename and size)
app.get('/listfile', function (req, res) {
    var file_path = "/home/guser/Desktop/"


    cmd.get(
        'ls -shp ' + file_path, function (err, data, stderr) {
            if (!err) {
                // console.log('passed', data)
                var file_size_arr = data.split("\n");
                file_size_arr.splice(-1, 1)  // remove " " last element
                file_size_arr.splice(0, 1)  // remove " total information " at first element
                // console.log(arr)

                // get only file name 
                cmd.get('ls -p ' + file_path, function (err, data, stderr) {
                    if (!err) {
                        var file_name_arr = data.split("\n");
                        file_name_arr.splice(-1, 1)  // remove " " last element
                        var file_size_obj = {};
                        for (var i = 0; i < file_size_arr.length; i++) {
                            // console.log(file_size_arr[i])

                            file_size_obj[file_name_arr[i]] = file_size_arr[i].replace(file_name_arr[i], '')  // remove file name from string file size+filename
                        }
                        // console.log(file_size_obj)
                        res.json(file_size_obj)
                    } else {
                        console.log('error', err)
                    }
                })



                // res.json(file_size_arr);

            } else {
                console.log('error', err)
            }
        }
    )
})


var server = app.listen(8080, function () {

    var host = 'localhost'
    var port = server.address().port
    console.log("GridFTP App listening at http://%s:%s", host, port);

});
