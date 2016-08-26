function replaceComments(html) {
  var comments_container = $('.dayscore-comments-container');
  comments_container.append(html);
}

//Converts json data blob for an Dayscore comment for data ready to inject into list view
function processDataForList(data) {
  data.score_name = getRatingHex(data.score);
  return data;
}

//Returns hex color associated with each rating
function getRatingHex(score) {
  if (score > 3 ) {
    return 'good';
  }
  else if (score > 2 ) {
    return 'normal';
  }
  return 'bad';
}

function fetchDayscoreData() {
  $.ajax({
    url: '/dayscore_data',
    beforeSend: function (request) {
      request.setRequestHeader("X-acpt", ACPT);
    }
  }).done(function(data) {
    $(function() {
      var commentHTML;
      if(data.length == 0) {
        var noResponses = document.createElement("div");
        noResponses.setAttribute("class", "dayscore-sidebar-error-msg");
        noResponses.innerHTML = 'You haven\'t received any comments from your survey yet. Check back later!';
        commentHTML=noResponses;
      }else{
        var listData = [];
        for (var i = 0; i < data.length; i++) {
          listData.push(processDataForList(data[i]));
        }

        var list  = document.createElement("ul");
        for (i = 0; i < listData.length; i++ ) {
          var dat = listData[i];
          //only show actual comments (hide empty comments)
          if (typeof dat.comments != 'undefined') {
            var row = document.createElement("li");
            row.setAttribute("class", "dayscore-feedback " + dat.score_name);
            var cellComment = document.createElement("div");
            cellComment.setAttribute("class", "dayscore-comment");
            cellComment.innerHTML = '"' + dat.comments + '"';

            var cellDate = document.createElement("div");
            cellDate.innerHTML =  new Date(parseInt((dat._id).substring(0, 8), 16) * 1000).toISOString().split('T')[0];
            cellDate.setAttribute("class", "dayscore-date");

            row.appendChild(cellComment);
            row.appendChild(cellDate);
            list.appendChild(row);
          }
        }
        commentHTML=list
      }
      replaceComments(commentHTML);
    })

  }).fail(function() {
    replaceComments('Error retrieving list of responses. Please check the addon is correctly configured for your surveymonkey account.');
  });
}

fetchDayscoreData();
