/*
 * Send image request to Piwik server using GET.
 * The infamous web bug (or beacon) is a transparent, single pixel (1x1) image
 */
function getImage(request, callback) {
  var image = new Image(1, 1);

  image.onload = function () {
    iterator = 0; // To avoid JSLint warning of empty block
    if (typeof callback === 'function') { callback(); }
  };
  image.src = configTrackerUrl + (configTrackerUrl.indexOf('?') < 0 ? '?' : '&') + request;
}

/*
* Send request
*/
function sendRequest(request, delay, callback) {

  if (!configDoNotTrack && request) {
    makeSureThereIsAGapAfterFirstTrackingRequestToPreventMultipleVisitorCreation(function () {

      if (configRequestMethod === 'POST') {
        sendXmlHttpRequest(request, callback);
      } else {
        getImage(request, callback);
      }

      setExpireDateTime(delay);
    });
  }

  if (!heartBeatSetUp) {
    setUpHeartBeat(); // setup window events too, but only once
  } else {
    heartBeatUp();
  }
}

function canSendBulkRequest(requests) {
  if (configDoNotTrack) {
    return false;
  }

  return (requests && requests.length);
}

/*
* Send requests using bulk
*/
function sendBulkRequest(requests, delay) {

  if (!canSendBulkRequest(requests)) {
    return;
  }

  var bulk = '{"requests":["?' + requests.join('","?') + '"]}';

  makeSureThereIsAGapAfterFirstTrackingRequestToPreventMultipleVisitorCreation(function () {
    sendXmlHttpRequest(bulk, null, false);
    setExpireDateTime(delay);
  });
}

/*
 * POST request to Piwik server using XMLHttpRequest.
 */
function sendXmlHttpRequest(request, callback, fallbackToGet) {

  if (!isDefined(fallbackToGet) || null === fallbackToGet) {
    fallbackToGet = true;
  }

  try {
    // we use the progid Microsoft.XMLHTTP because
    // IE5.5 included MSXML 2.5; the progid MSXML2.XMLHTTP
    // is pinned to MSXML2.XMLHTTP.3.0
    var xhr = windowAlias.XMLHttpRequest
        ? new windowAlias.XMLHttpRequest()
        : windowAlias.ActiveXObject
        ? new ActiveXObject('Microsoft.XMLHTTP')
        : null;

    xhr.open('POST', configTrackerUrl, true);

    // fallback on error
    xhr.onreadystatechange = function () {
      if (this.readyState === 4 && !(this.status >= 200 && this.status < 300) && fallbackToGet) {
        getImage(request, callback);
      } else {
        if (typeof callback === 'function') { callback(); }
      }
    };

    xhr.setRequestHeader('Content-Type', configRequestContentType);

    xhr.send(request);
  } catch (e) {
    if (fallbackToGet) {
      // fallback
      getImage(request, callback);
    }
  }
}