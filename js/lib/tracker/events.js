/**
* Records an event
*
* @param string category The Event Category (Videos, Music, Games...)
* @param string action The Event's Action (Play, Pause, Duration, Add Playlist, Downloaded, Clicked...)
* @param string name (optional) The Event's object Name (a particular Movie name, or Song name, or File name...)
* @param float value (optional) The Event's value
*/
function trackEvent(category, action, name, value) {
  trackCallback(function () {
    logEvent(category, action, name, value);
  });
}

function buildEventRequest(category, action, name, value) {
  return 'e_c=' + encodeWrapper(category)
   + '&e_a=' + encodeWrapper(action)
   + (isDefined(name) ? '&e_n=' + encodeWrapper(name) : '')
   + (isDefined(value) ? '&e_v=' + encodeWrapper(value) : '');
}


/*
* Log the event
*/
function logEvent(category, action, name, value, customData) {
  // Category and Action are required parameters
  if (String(category).length === 0 || String(action).length === 0) {
      return false;
  }
  var request = getRequest(
    buildEventRequest(category, action, name, value),
    customData,
    'event'
  );

  sendRequest(request, configTrackerPause);
}


module.exports = {
  trackEvent: trackEvent,
  buildEventRequest: buildEventRequest,
  logEvent: logEvent
};