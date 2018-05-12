var express = require('express')
var path = require('path')
var cmd = require('node-cmd')
var app = express()
var bodyParser = require('body-parser')
var request = require('request')
var url = require('url')
var now = require('performance-now')
var filesizeParser = require('filesize-parser')

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static('public'))

app.set('views', path.join(__dirname, 'views'))
app.set('view engine', 'ejs')

// Setup template engines go here.
// home page
app.get('/', function (req, res) {
  var context = req.query
  res.render('index', context)
})

function checkConnectivity (des_hostname, des_port, next) {
  cmd.get('ping -c 1 ' + des_hostname, function (err, data, stderr) {
    if (!err) {
      var des_ip = data.split(' ')[2].replace('(', '').replace(')', '')  // remove () from data return

      cmd.get('nmap -p ' + des_port + ' ' + des_hostname, function (err, data, stderr) {
        var result = data.split(" ")
        if (result.indexOf("open") > -1) {  // if port open 
          console.log(des_hostname + ':' + des_port + '  ' + 'open')
          var status = des_hostname + ':' + des_port + '  ' + 'open'
          return next(true, des_ip, null, status)  // connectivity, des_ip, error, status
        } else {  // if port closed
          console.log(des_hostname + ':' + des_port + '  ' + 'closed')
          var status = des_hostname + ':' + des_port + '  ' + 'closed'
          return next(false, null, err, status)  // connectivity, des_ip, error, status
        }
      })
    } else {
      console.log(des_hostname + '  ' + 'closed device')
      var status = des_hostname + '  ' + 'closed device'
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
      )
    } else {  // can connect
      var context = req.query
      context.des_ip = des_ip
      context.status = 'Connected'
      res.redirect(url.format({
        pathname: "/gridftp",
        query: context
      })
      )
    }
  })
})

// internal function
function getFileList(ip, port, next) {
  request('http://' + ip + ':' + port + '/listfile', function (error, response, body) {
    next(JSON.parse(body))
  })
}

function deleteFile(file_path, filename, next) {
  cmd.get("rm -rf '" + file_path + filename + "'", function (err, data, stderr) {
    next(err)
  })
}

function gridftpRedirect(req, res, status) {
  var context = {
    des_hostname: req.body.des_name,
    des_ip: req.body.des_ip,
    status: status
  }

  console.log(status)

  res.redirect(url.format({
    pathname: "/gridftp",
    query: context
  })
  )
}

// transfer via gsiftp 
function transferFile(req, res, source_name, des_name, method) {
  console.log(req.body)

  checkConnectivity(des_name, 2811, function (connectivity, des_ip, err, status) {
    if (connectivity == false) {  // can't connect

      gridftpRedirect(req, res, status)  // closed device or closed port

    } else {  // can connect des 2811 => check 2811 source
      checkConnectivity(source_name, 2811, function (connectivity, source_ip, err, status) {
        if (connectivity == false) {  // can't connect 


          gridftpRedirect(req, res, status)  // closed device or closed port


        } else {  // can connect  => check port 7512 myproxy
          var myproxy_hostname = 'myproxy.expresslane.com'
          checkConnectivity(myproxy_hostname, 7512, function (connectivity, des_ip, err, status) {
            if (connectivity == false) {  // can't connect

              gridftpRedirect(req, res, status)  // closed device or close port

            } else {  // can connect => start file sending
              var file_path = "/home/guser/Desktop/"
              var source_file = JSON.parse(req.body.source_file)
              
              source_file.file_size = source_file.file_size.split(' ').join('')  // remove space for filesizeParser 
              
              var file_size = filesizeParser(source_file.file_size, {base: 10}) / 1000000  // file size in number MB
              console.log('filesize: ' + file_size + ' MB')
              var command = "globus-url-copy -cd -r 'gsiftp://" + source_name + file_path + source_file.file_name + "' 'gsiftp://" + des_name + file_path + source_file.file_name + "'"
              var start = now()  // keep start time for measure transfer performance
              cmd.get('./myproxy-login.sh \n ' + command,
                function (err, data, stderr) {
                  if (!err) {
                    var end = now()  // kepp end time for measure transfer performance

                    var duration = ((end - start) / 1000).toFixed(2) // change millisec to sec
                    console.log('duration: ' + duration + ' seconds')
                    
                    var speed = (file_size / duration).toFixed(2)  // speed with 2 decimals
                    console.log('speed: ' + speed + ' MB/s')

                    var status = method + ' ' + source_file.file_name + ' success in ' + duration + ' seconds ' + '(' + speed + ' MB/s)'
                    gridftpRedirect(req, res, status)


                  } else {
                    console.log(err)

                    var status = 'Error in grid authentication or transfering or permission denied file'
                    gridftpRedirect(req, res, status)

                  }
                })
            }
          })
        }
      })
    }
  })
}

// delete file in local desktop
app.post('/local_delete', function (req, res) {
  console.log(req.body)
  var file_path = "/home/guser/Desktop/"
  var source_file = JSON.parse(req.body.source_file)
  var filename = source_file.file_name
  deleteFile(file_path, filename, function (err) {
    if (!err) {  // check if not error while delete file
      var status = 'Delete ' + filename + ' success'
      gridftpRedirect(req, res, status)

    } else {  // check if error while delete file
      console.log(err)
      var status = 'Error while delete file ' + filename
      gridftpRedirect(req, res, status)
    }
  })
})

// delete file in remote desktop
app.post('/remote_delete', function (req, res) {
  console.log(req.body)
  var source_file = JSON.parse(req.body.source_file)
  request.post({
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    url: 'http://' + req.body.des_ip + ':8080' + '/delete',
    body: "source_file=" + source_file.file_name
  }, function (error, response, body) {
    if (!error) {  // check if not error while request
      var body_obj = JSON.parse(body)

      if (!body_obj.err) {  // check if not error while delete file
        var status = 'Delete ' + source_file.file_name + ' success'
        gridftpRedirect(req, res, status)

      } else {  // if error while delete file
        console.log(body_obj.err)

        var status = 'Error while delete file ' + source_file.file_name
        gridftpRedirect(req, res, status)

      }

    } else {  // if error while request to delete
      console.log(error)

      var status = 'Error while delete request to remote site '
      gridftpRedirect(req, res, status)

    }
  })
})

// delete file in Desktop directory and return status json
app.post('/delete', function (req, res) {
  var file_path = "/home/guser/Desktop/"
  var filename = req.body.source_file
  deleteFile(file_path, filename, function (err) {
    res.json({ err: err })
  })
})


// transfer file upload by gsiftp
app.post('/upload', function (req, res) {
  transferFile(req, res, req.body.source_name, req.body.des_name, 'Upload')
})


// transfer file download by gsiftp
app.post('/download', function (req, res) {
  transferFile(req, res, req.body.des_name, req.body.source_name, 'Download')
})

// gridftp page
app.get('/gridftp', function (req, res) {
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
      )
    } else {  // can connect
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
                context.destination_ip = req.query.des_ip
                context.status = req.query.status

                getFileList(context.destination_ip, 8080, function (result) {
                  context.des_file_list = result  // get file list of destination host
                  res.render('gridftp', context)
                })
              })

            } else {
              console.log('error : ', err)
              res.redirect('/')  // return to home page
            }
          })

        } else {
          console.log('error : ', err)
          res.redirect('/')  // return to home page
        }
      })
    }
  })


})




// list files in file path (return json filename and size)
app.get('/listfile', function (req, res) {
  var file_path = "/home/guser/Desktop/"


  cmd.get(
    'ls -shp --block-size=MB ' + file_path, function (err, data, stderr) {
      if (!err) {

        var file_size_arr = data.split("\n")
        file_size_arr.splice(-1, 1)  // remove " " last element
        file_size_arr.splice(0, 1)  // remove " total information " at first element


        // get only file name 
        cmd.get('ls -p ' + file_path, function (err, data, stderr) {
          if (!err) {
            var file_name_arr = data.split("\n")
            file_name_arr.splice(-1, 1)  // remove " " last element
            var file_size_obj = {}
            for (var i = 0; i < file_size_arr.length; i++) {

              if (!file_name_arr[i].includes('\\')) {  // ignore file that has \ in filename because gridftp not support
                file_size_obj[file_name_arr[i]] = file_size_arr[i].replace(file_name_arr[i], '')  // remove file name from string file size+filename
              }


            }

            res.json(file_size_obj)
          } else {
            console.log('error', err)
          }
        })
      } else {
        console.log('error', err)
      }
    }
  )
})

var server = app.listen(8080, function () {

  var host = 'localhost'
  var port = server.address().port
  console.log("GridFTP App listening at http://%s:%s", host, port)

})
