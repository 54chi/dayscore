var http = require('request');
var cors = require('cors');
var uuid = require('uuid');
var url = require('url');
var ObjectId = require('mongodb').ObjectID;
var RSVP = require('rsvp');

var debug=true;
var SHP_COLLECTION = "scores";

module.exports = function (app, addon, db) {
  var hipchat = require('../lib/hipchat')(addon);
  var shp = require('../lib/shp')(addon, db); //where all the shiny happy people gathers

  // default routes
  app.get('/healthcheck', function (req, res) {
    res.send('OK');
  });

  app.get('/',
    function (req, res) {
      res.format({
        'text/html': function () {
          var homepage = url.parse(addon.descriptor.links.homepage);
          if (homepage.hostname === req.hostname && homepage.path === req.path) {
            res.render('homepage', addon.descriptor);
          } else {
            res.redirect(addon.descriptor.links.homepage);
          }
        },
        'application/json': function () {
          res.redirect('/atlassian-connect.json');
        }
      });
    }
    );

  //configuration page
  app.get('/config',
    addon.authenticate(),
    function (req, res) {
      res.render('config', req.context);
    }
  );

  // sidebar glance

  app.get('/glance',
    cors(),
    addon.authenticate(),
    function (req, res) {
      console.log("getting glance data...");
      return new RSVP.Promise(function (resolve, reject) {
        var payload = {
          "label": {
            "type": "html",
            "value": "Dayscore"
          }
        };
        db.collection(SHP_COLLECTION).find({roomID:req.identity.roomId}).toArray(function(err, docs){
          if (err) resolve(err.message)
          else {
            var scoreTot=0;
            docs.forEach(function(doc){
                scoreTot+=doc.score|0;
              }
            )
            dayscore=Math.round(scoreTot/docs.length*100)/100;
            gType=(dayscore>3)?"success":(dayscore>2)?"current":"error";
            payload["status"] = {
              "type": "lozenge",
              "value": {
                "label": String(dayscore),
                "type": gType
              }
            };
            resolve(payload);
          }
        })

      }).then(function (data) {
        console.log("Data is:"+ JSON.stringify(data))
        res.header("Access-Control-Allow-Origin", "*");
        res.send(data);
      }, function(error) {
        res.send();
      });
      }
    );

  // This is an example end-point that you can POST to to update the glance info
  // Room update API: https://www.hipchat.com/docs/apiv2/method/room_addon_ui_update
  // Group update API: https://www.hipchat.com/docs/apiv2/method/addon_ui_update
  // User update API: https://www.hipchat.com/docs/apiv2/method/user_addon_ui_update
  app.post('/update_glance',
    cors(),
    addon.authenticate(),
    function (req, res) {
      res.json({
        "label": {
          "type": "html",
          "value": "Hello World!"
        },
        "status": {
          "type": "lozenge",
          "value": {
            "label": "All good",
            "type": "success"
          }
        }
      });
    }
    );

  // This is an example sidebar controller that can be launched when clicking on the glance.
  // https://developer.atlassian.com/hipchat/guide/dialog-and-sidebar-views/sidebar
  app.get('/sidebar',
    addon.authenticate(),
    function (req, res) {
      res.render('sidebar', {
        identity: req.identity
      });
    }
    );

  // This is an example dialog controller that can be launched when clicking on the glance.
  // https://developer.atlassian.com/hipchat/guide/dialog-and-sidebar-views/dialog
  app.get('/dialog',
    addon.authenticate(),
    function (req, res) {
      res.render('dialog', {
        identity: req.identity
      });
    }
    );

/************ WEBHHOOKS ***************/
/*
  app.post('/greeting',
    addon.authenticate(),
    function (req, res) {
      console.log(req.identity);
      hipchat.sendMessage(req.clientInfo, req.identity.roomId, 'Hello ')
        .then(function (data) {
          res.sendStatus(200);
        });
    }
  );
*/


  // Sample endpoint to send a card notification back into the chat room
  // See https://developer.atlassian.com/hipchat/guide/sending-messages
  app.post('/send_notification',
    addon.authenticate(),
    function (req, res) {
      var card = {
        "style": "link",
        "url": "https://www.hipchat.com",
        "id": uuid.v4(),
        "title": req.body.item.message.message,
        "description": "Great teams use HipChat: Group and private chat, file sharing, and integrations",
        "icon": {
          "url": "https://hipchat-public-m5.atlassian.com/assets/img/hipchat/bookmark-icons/favicon-192x192.png"
        }
      };
      var msg = '<b>' + card.title + '</b>: ' + card.description;
      var opts = { 'options': { 'color': 'green' } };
      hipchat.sendMessage(req.clientInfo, req.identity.roomId, msg, opts, card)
      .then(function(data){
        res.sendStatus(200)
      });
    }
  );

  // This is an example route to handle an incoming webhook
  // https://developer.atlassian.com/hipchat/guide/webhooks
  app.post('/echo-webhook',
      addon.authenticate(), //JWT validation
      function(req, res) {
  		var messageTxt = req.body.item.message.message;
       	hipchat.sendMessage(req.clientInfo, req.identity.roomId, messageTxt)
  			.then(function(data){
              	res.sendStatus(200);
          });
      }
  );

  app.post('/dayscore',
      addon.authenticate(), //JWT validation
      function(req, res) {
        var processedMessage={}; //operation, message

/*
        var card = {
          "style": "link",
          "url": "https://www.hipchat.com",
          "id": uuid.v4(),
          "title": req.body.item.message.message,
          "description": "Great teams use HipChat: Group and private chat, file sharing, and integrations",
          "icon": {
            "url": "https://hipchat-public-m5.atlassian.com/assets/img/hipchat/bookmark-icons/favicon-192x192.png"
          }
        };
*/
        var opts = { 'options': { 'color': 'green' } };

        //aux for date range search
        // This function returns an ObjectId embedded with a given datetime
        // Accepts both Date object and string input

        var objectIdWithTimestamp = function(timestamp) {
          // Convert string date to Date object (otherwise assume timestamp is a date)
          if (typeof(timestamp) == 'string') {
              timestamp = new Date(timestamp);
          }
          // Convert date object to hex seconds since Unix epoch
          var hexSeconds = Math.floor(timestamp/1000).toString(16);
          // Create an ObjectId with that hex timestamp
          console.log("objectID: "+ hexSeconds + "0000000000000000");
          var constructedObjectId = ObjectId(hexSeconds + "0000000000000000");
          return constructedObjectId
        }

        var rangeMonth = function(dateStr){
          if (!dateStr) dateStr = new Date().getTime();
          var date = new Date(dateStr);
          var dt = new Date(date.getFullYear(), date.getMonth(), 1);
          var et = new Date(date.getFullYear(), date.getMonth() + 1, 0);
          return { start: dt, end: et }
        }

        var rangeWeek = function(dateStr) {
            if (!dateStr) dateStr = new Date().getTime();
            var dt = new Date(dateStr);
            dt = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
            dt = new Date(dt.getTime() - (dt.getDay() > 0 ? (dt.getDay() - 1) * 1000 * 60 * 60 * 24 : 6 * 1000 * 60 * 60 * 24));
            return { start: dt, end: new Date(dt.getTime() + 1000 * 60 * 60 * 24 * 7 - 1) };
        }

        //DB PROMISE
        var processMessage = function(message, reqID){
          //resolve(shp.parseMessage(reqMessage,reqUserID));
          if (debug) console.log("0. Message to process: "+ message + ", user: " + reqID.userId);
          var regExpDS=/dayscore(.*)/
          var regExpScore=/^[0-5]\s(.*)|^[0-5]$/ //score is the first number, the rest can be treated as comment
          var regExpEvent=/help(.*)/
          var regExpReport=/report(.*)/
          //  var regExpDate=//

          var defaultMessage="I have no idea what you are trying to do. Try \"dayscore help\" for a list of commands you can try."

          var arr=message.match(regExpDS);
          var parsedMessage = arr[1].trim()

          var arrScore=parsedMessage.match(regExpScore);
          var arrReport=parsedMessage.match(regExpReport);

          if (arrScore!=null){
            operation="score";
          }else if (parsedMessage.match(regExpEvent)!=null){
            operation="help";
            message="help"
          }else if (arrReport!=null){
            operation="report";
          }else {
            operation="none";
            message=defaultMessage
          }

          //DB PROMISE
          var opExecute = function(operation){
            return new Promise(
              function(resolve,reject){
                if (debug) console.log("1. Operation to perform is " + operation);
                processedMessage.operation=operation;

                switch (operation) {
                  case "score":
                    //PUT SCORE
                    var newScore = {};
                    newScore.roomID=reqID.roomId;
                    newScore.userID=reqID.userId;
                    newScore.score=parsedMessage.match(/^[0-5]/)[0];
                    if (arrScore[1]!=undefined) newScore.comments= arrScore[1].trim(); //add comments if any
                    //newScore.createDate=new Date(); //we'll use the mongo creation ID timestamp instead

                    db.collection(SHP_COLLECTION).insertOne(newScore, function(err, doc) {
                      if (err) reject(err.message)
                      else {
                        //res.status(201).json(doc.ops[0]);
                        processedMessage.message="Thanks! Your score have been received";
                        console.log("created: "+ doc);
                        resolve(processedMessage);
                      }
                    })

                    break;
                  case "help":
                    processedMessage.message="You can try: "
                    processedMessage.message+="<ul>"
                    processedMessage.message+="<li>Dayscore [0-5]</li>"
                    processedMessage.message+="<li>Dayscore [0-5] comment</li>"
                    processedMessage.message+="<li>Dayscore report all|month|week</li>"
                    processedMessage.message+="</ul>"
                    processedMessage.message+="";
                    resolve(processedMessage);
                    break;
                  case "report":
                    //LIST SCORES
                    var reportType="ALL";
                    if (arrReport[1]!=undefined&&arrReport[1]!="") reportType=arrReport[1].trim();
                    switch (reportType.toUpperCase()) {
                      case "ALL":
                        //all scores
                        db.collection(SHP_COLLECTION).find({roomID:reqID.roomId}).toArray(function(err, docs) {
                          if (err) reject(err.message)
                          else {
                            var scoreTot=0;
                            docs.forEach(function(doc){
                                scoreTot+=doc.score|0;
                              }
                            )
                            processedMessage.message="The room's dayscore is " + Math.round(scoreTot/docs.length*100)/100;
                            resolve(processedMessage);
                          }
                        });
                        break;
                      case "MONTH":
                        //month scores
                        var dateRange=rangeMonth();
                        db.collection(SHP_COLLECTION).find({ roomID:reqID.roomId, _id: { $gt: objectIdWithTimestamp(dateRange.start), $lt: objectIdWithTimestamp(dateRange.end) } }).toArray(function(err, docs) {
                          if (err) reject(err.message)
                          else {
                            var scoreTot=0;
                            docs.forEach(function(doc){
                                scoreTot+=doc.score|0;
                              }
                            )
                            processedMessage.message="The room's monthly dayscore is " + Math.round(scoreTot/docs.length*100)/100;
                            resolve(processedMessage);
                          }
                        });
                        break;
                      case "WEEK":
                        //week scores
                        var dateRange=rangeWeek();
                        db.collection(SHP_COLLECTION).find({ roomID:reqID.roomId, _id: { $gt: objectIdWithTimestamp(dateRange.start), $lt: objectIdWithTimestamp(dateRange.end) } }).toArray(function(err, docs) {
                          if (err) reject(err.message)
                          else {
                            var scoreTot=0;
                            docs.forEach(function(doc){
                                scoreTot+=doc.score|0;
                              }
                            )
                            processedMessage.message="The room's weekly dayscore is " + Math.round(scoreTot/docs.length*100)/100;
                            resolve(processedMessage);
                          }
                        });

                        break;
                      default:
                        processedMessage.message=defaultMessage;
                        resolve(processedMessage);
                    }

                    break;
                  default:
                    //no idea what they were trying to do
                    processedMessage.message=defaultMessage
                    console.log(processedMessage.message);
                    resolve(processedMessage);
                }
              }
            )
          }

          opExecute(operation)
            .then(function(value){
              if (debug) console.log("2. Returning from Promise with value: " + value.message)
              hipchat.sendMessage(req.clientInfo, req.identity.roomId, value.message,opts)
              .then(function(data){
                      res.sendStatus(200);
                });
              resolve(value.message)
            },function(reason){
              console.log("2. Returning from Promise with error: " + reason)
              reject(reason)
            });
            //some sync operations...
        }
        processMessage(req.body.item.message.message, req.identity)
      }
  );

  app.post('/webhook',
    addon.authenticate(),
    function (req, res) {
      hipchat.sendMessage(req.clientInfo, req.identity.roomId, 'pong')
        .then(function (data) {
          res.sendStatus(200);
        });
    }
    );

  // Notify the room that the add-on was installed. To learn more about
  // Connect's install flow, check out:
  // https://developer.atlassian.com/hipchat/guide/installation-flow
  addon.on('installed', function (clientKey, clientInfo, req) {
    var options = {
      options: {
        color: "green"
      }
    };
    var msg = 'The ' + addon.descriptor.name + ' add-on has been installed in this room';
    hipchat.sendMessage(clientInfo, req.body.roomId, msg, options);
});

  // Clean up clients when uninstalled
  addon.on('uninstalled', function (id) {
    addon.settings.client.keys(id + ':*', function (err, rep) {
      rep.forEach(function (k) {
        addon.logger.info('Removing key:', k);
        addon.settings.client.del(k);
      });
    });
  });

};

/*
var app = express();
app.use(express.static(__dirname + "/public"));
app.use(bodyParser.json());

// Create a database variable outside of the database connection callback to reuse the connection pool in your app.
var db;

// Connect to the database before starting the application server.
mongodb.MongoClient.connect(process.env.MONGODB_URI, function (err, database) {
  if (err) {
    console.log(err);
    process.exit(1);
  }

  // Save database object from the callback for reuse.
  db = database;
  console.log("Database connection ready");

  // Initialize the app.
  var server = app.listen(process.env.PORT || 8080, function () {
    var port = server.address().port;
    console.log("App now running on port", port);
  });
});

// CONTACTS API ROUTES BELOW

// Generic error handler used by all endpoints.
function handleError(res, reason, message, code) {
  console.log("ERROR: " + reason);
  res.status(code || 500).json({"error": message});
}


app.get("/contacts", function(req, res) {
  db.collection(CONTACTS_COLLECTION).find({}).toArray(function(err, docs) {
    if (err) {
      handleError(res, err.message, "Failed to get contacts.");
    } else {
      res.status(200).json(docs);
    }
  });
});

app.post("/contacts", function(req, res) {
  var newContact = req.body;
  newContact.createDate = new Date();

  if (!(req.body.firstName || req.body.lastName)) {
    handleError(res, "Invalid user input", "Must provide a first or last name.", 400);
  }

  db.collection(CONTACTS_COLLECTION).insertOne(newContact, function(err, doc) {
    if (err) {
      handleError(res, err.message, "Failed to create new contact.");
    } else {
      res.status(201).json(doc.ops[0]);
    }
  });
});

app.get("/contacts/:id", function(req, res) {
  db.collection(CONTACTS_COLLECTION).findOne({ _id: new ObjectID(req.params.id) }, function(err, doc) {
    if (err) {
      handleError(res, err.message, "Failed to get contact");
    } else {
      res.status(200).json(doc);
    }
  });
});

app.put("/contacts/:id", function(req, res) {
  var updateDoc = req.body;
  delete updateDoc._id;

  db.collection(CONTACTS_COLLECTION).updateOne({_id: new ObjectID(req.params.id)}, updateDoc, function(err, doc) {
    if (err) {
      handleError(res, err.message, "Failed to update contact");
    } else {
      res.status(204).end();
    }
  });
});

app.delete("/contacts/:id", function(req, res) {
  db.collection(CONTACTS_COLLECTION).deleteOne({_id: new ObjectID(req.params.id)}, function(err, result) {
    if (err) {
      handleError(res, err.message, "Failed to delete contact");
    } else {
      res.status(204).end();
    }
  });
});
*/
