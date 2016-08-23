var debug=true;

var processedMessage={}; //operation, message

module.exports = function(addon) {
  var processMessage = function (message,userID){
    var defaultMessage="I have no idea what you are trying to do :p"
    var regExpScore=/^[0-5]\s(.*)|^[0-5]$/ //score is the first number, the rest can be treated as comment
    //  var regExpDate=//
    var regExpEvent=/event(.*)/
    var regExpReport=/report(.*)/

    if (message.match(regExpScore)!=null){
      processedMessage.operation="score";
      processedMessage.message="score!"
    }else if (message.match(regExpEvent)!=null){
      processedMessage.operation="event";
      processedMessage.message="event!"
    }else if (message.match(regExpReport)!=null){
      processedMessage.operation="report";
      processedMessage.message="report!"
    }else {
      processedMessage.operation="none";
      processedMessage.message=defaultMessage
    }
    //parsedMessage=(arr[1]!="")?arr[1]:defaultMessage;
    if (debug) console.log("Message processed: "+ processedMessage.message);
    return processedMessage
  }

  return{
    parseMessage: function(message,userID){
      if (debug) console.log("Message to process: "+ message + " user: " + userID);
      //trim the message a bit
      var regExp1=/dayscore(.*)/
      var arr=message.match(regExp1);
      parsedMessage=processMessage(arr[1].trim(),userID)
      return parsedMessage.message
    }
  }
}
