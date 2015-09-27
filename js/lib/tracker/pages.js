/*
* Log the page view / visit
*/
function logPageView(customTitle, customData) {
  var now = new Date(),
    request = getRequest('action_name=' + encodeWrapper(titleFixup(customTitle || configTitle)), customData, 'log');

  sendRequest(request, configTrackerPause);
}

/**
 * Log visit to this page
 *
 * @param string customTitle
 * @param mixed customData
 */
function trackPageView(customTitle, customData) {
  trackedContentImpressions = [];

  if (isOverlaySession(configTrackerSiteId)) {
      trackCallback(function () {
          injectOverlayScripts(configTrackerUrl, configApiUrl, configTrackerSiteId);
      });
  } else {
      trackCallback(function () {
          logPageView(customTitle, customData);
      });
  }
}