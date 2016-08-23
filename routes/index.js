var http = require('request');
var cors = require('cors');
var uuid = require('uuid');
var url = require('url');

module.exports = function (app, addon) {
  var hipchat = require('../lib/hipchat')(addon);
  var shp = require('../lib/shp')(addon); //where all the shiny happy people gathers

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
      res.json({
        "label": {
          "type": "html",
          "value": "Shiny Happy People"
        },

        "status": {
          "type": "lozenge",
          "value": {
            "label": "4.1",
            "type": "success"
          }
        }
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
        /*
        var messageTxt="I have no idea what you are trying to do"
        var iPhrase = req.body.item.message.message;
        var regExp1=/dayscore(.*)/

        var arr=iPhrase.match(regExp1);
        console.log("Whatever"+arr[1]+"www");
        if(arr!=null){
          messageTxt=(arr[1]!="")?arr[1]:messageTxt;
        }
        */

        messageTxt=shp.parseMessage(req.body.item.message.message, req.identity.userId);

        hipchat.sendMessage(req.clientInfo, req.identity.roomId, messageTxt)
        .then(function(data){
                res.sendStatus(200);
          });
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
