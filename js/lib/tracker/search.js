/**
 * Log special pageview: Internal search
 *
 * @param string keyword
 * @param string category
 * @param int resultsCount
 */
function (keyword, category, resultsCount) {
  trackCallback(function () {
    logSiteSearch(keyword, category, resultsCount);
  });
}

/*
 * Log the site search request
 */
function logSiteSearch(keyword, category, resultsCount, customData) {
  var request = getRequest('search=' + encodeWrapper(keyword)
                  + (category ? '&search_cat=' + encodeWrapper(category) : '')
                  + (isDefined(resultsCount) ? '&search_count=' + resultsCount : ''), customData, 'sitesearch');

  sendRequest(request, configTrackerPause);
}

module.exports = trackSiteSearch;