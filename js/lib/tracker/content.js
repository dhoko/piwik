/**
 * Manually log a click from your own code
 *
 * @param string sourceUrl
 * @param string linkType
 * @param mixed customData
 * @param function callback
 */
function trackLink(sourceUrl, linkType, customData, callback) {
    trackCallback(function () {
        logLink(sourceUrl, linkType, customData, callback);
    });
},



/**
 * Scans the entire DOM for all content blocks and tracks all impressions once the DOM ready event has
 * been triggered.
 *
 * If you only want to track visible content impressions have a look at `trackVisibleContentImpressions()`.
 * We do not track an impression of the same content block twice if you call this method multiple times
 * unless `trackPageView()` is called meanwhile. This is useful for single page applications.
 */
function trackAllContentImpressions() {
    if (isOverlaySession(configTrackerSiteId)) {
        return;
    }

    trackCallback(function () {
        trackCallbackOnReady(function () {
            // we have to wait till DOM ready
            var contentNodes = content.findContentNodes();
            var requests     = getContentImpressionsRequestsFromNodes(contentNodes);

            sendBulkRequest(requests, configTrackerPause);
        });
    });
},

/**
 * Scans the entire DOM for all content blocks as soon as the page is loaded. It tracks an impression
 * only if a content block is actually visible. Meaning it is not hidden and the content is or was at
 * some point in the viewport.
 *
 * If you want to track all content blocks have a look at `trackAllContentImpressions()`.
 * We do not track an impression of the same content block twice if you call this method multiple times
 * unless `trackPageView()` is called meanwhile. This is useful for single page applications.
 *
 * Once you have called this method you can no longer change `checkOnScroll` or `timeIntervalInMs`.
 *
 * If you do want to only track visible content blocks but not want us to perform any automatic checks
 * as they can slow down your frames per second you can call `trackVisibleContentImpressions()` or
 * `trackContentImpressionsWithinNode()` manually at  any time to rescan the entire DOM for newly
 * visible content blocks.
 * o Call `trackVisibleContentImpressions(false, 0)` to initially track only visible content impressions
 * o Call `trackVisibleContentImpressions()` at any time again to rescan the entire DOM for newly visible content blocks or
 * o Call `trackContentImpressionsWithinNode(node)` at any time to rescan only a part of the DOM for newly visible content blocks
 *
 * @param boolean [checkOnScroll=true] Optional, you can disable rescanning the entire DOM automatically
 *                                     after each scroll event by passing the value `false`. If enabled,
 *                                     we check whether a previously hidden content blocks became visible
 *                                     after a scroll and if so track the impression.
 *                                     Note: If a content block is placed within a scrollable element
 *                                     (`overflow: scroll`), we can currently not detect when this block
 *                                     becomes visible.
 * @param integer [timeIntervalInMs=750] Optional, you can define an interval to rescan the entire DOM
 *                                     for new impressions every X milliseconds by passing
 *                                     for instance `timeIntervalInMs=500` (rescan DOM every 500ms).
 *                                     Rescanning the entire DOM and detecting the visible state of content
 *                                     blocks can take a while depending on the browser and amount of content.
 *                                     In case your frames per second goes down you might want to increase
 *                                     this value or disable it by passing the value `0`.
 */
function trackVisibleContentImpressions(checkOnSroll, timeIntervalInMs) {
    if (isOverlaySession(configTrackerSiteId)) {
        return;
    }

    if (!isDefined(checkOnSroll)) {
        checkOnSroll = true;
    }

    if (!isDefined(timeIntervalInMs)) {
        timeIntervalInMs = 750;
    }

    enableTrackOnlyVisibleContent(checkOnSroll, timeIntervalInMs, this);

    trackCallback(function () {
        trackCallbackOnLoad(function () {
            // we have to wait till CSS parsed and applied
            var contentNodes = content.findContentNodes();
            var requests     = getCurrentlyVisibleContentImpressionsRequestsIfNotTrackedYet(contentNodes);

            sendBulkRequest(requests, configTrackerPause);
        });
    });
},

/**
 * Tracks a content impression using the specified values. You should not call this method too often
 * as each call causes an XHR tracking request and can slow down your site or your server.
 *
 * @param string contentName  For instance "Ad Sale".
 * @param string [contentPiece='Unknown'] For instance a path to an image or the text of a text ad.
 * @param string [contentTarget] For instance the URL of a landing page.
 */
function trackContentImpression(contentName, contentPiece, contentTarget) {
    if (isOverlaySession(configTrackerSiteId)) {
        return;
    }

    if (!contentName) {
        return;
    }

    contentPiece = contentPiece || 'Unknown';

    trackCallback(function () {
        var request = buildContentImpressionRequest(contentName, contentPiece, contentTarget);
        sendRequest(request, configTrackerPause);
    });
},

/**
 * Scans the given DOM node and its children for content blocks and tracks an impression for them if
 * no impression was already tracked for it. If you have called `trackVisibleContentImpressions()`
 * upfront only visible content blocks will be tracked. You can use this method if you, for instance,
 * dynamically add an element using JavaScript to your DOM after we have tracked the initial impressions.
 *
 * @param Element domNode
 */
function trackContentImpressionsWithinNode(domNode) {
    if (isOverlaySession(configTrackerSiteId) || !domNode) {
        return;
    }

    trackCallback(function () {
        if (isTrackOnlyVisibleContentEnabled) {
            trackCallbackOnLoad(function () {
                // we have to wait till CSS parsed and applied
                var contentNodes = content.findContentNodesWithinNode(domNode);

                var requests = getCurrentlyVisibleContentImpressionsRequestsIfNotTrackedYet(contentNodes);
                sendBulkRequest(requests, configTrackerPause);
            });
        } else {
            trackCallbackOnReady(function () {
                // we have to wait till DOM ready
                var contentNodes = content.findContentNodesWithinNode(domNode);

                var requests = getContentImpressionsRequestsFromNodes(contentNodes);
                sendBulkRequest(requests, configTrackerPause);
            });
        }
    });
},

/**
 * Tracks a content interaction using the specified values. You should use this method only in conjunction
 * with `trackContentImpression()`. The specified `contentName` and `contentPiece` has to be exactly the
 * same as the ones that were used in `trackContentImpression()`. Otherwise the interaction will not count.
 *
 * @param string contentInteraction The type of interaction that happened. For instance 'click' or 'submit'.
 * @param string contentName  The name of the content. For instance "Ad Sale".
 * @param string [contentPiece='Unknown'] The actual content. For instance a path to an image or the text of a text ad.
 * @param string [contentTarget] For instance the URL of a landing page.
 */
function trackContentInteraction(contentInteraction, contentName, contentPiece, contentTarget) {
  if (isOverlaySession(configTrackerSiteId)) {
    return;
  }

  if (!contentInteraction || !contentName) {
    return;
  }

  contentPiece = contentPiece || 'Unknown';

  trackCallback(function () {
      var request = buildContentInteractionRequest(contentInteraction, contentName, contentPiece, contentTarget);
      sendRequest(request, configTrackerPause);
  });
},

/**
 * Tracks an interaction with the given DOM node / content block.
 *
 * By default we track interactions on click but sometimes you might want to track interactions yourself.
 * For instance you might want to track an interaction manually on a double click or a form submit.
 * Make sure to disable the automatic interaction tracking in this case by specifying either the CSS
 * class `piwikContentIgnoreInteraction` or the attribute `data-content-ignoreinteraction`.
 *
 * @param Element domNode  This element itself or any of its parent elements has to be a content block
 *                         element. Meaning one of those has to have a `piwikTrackContent` CSS class or
 *                         a `data-track-content` attribute.
 * @param string [contentInteraction='Unknown] The name of the interaction that happened. For instance
 *                                             'click', 'formSubmit', 'DblClick', ...
 */
function trackContentInteractionNode(domNode, contentInteraction) {
  if (isOverlaySession(configTrackerSiteId) || !domNode) {
    return;
  }

  trackCallback(function () {
    var request = buildContentInteractionRequestNode(domNode, contentInteraction);
    sendRequest(request, configTrackerPause);
  });
},

module.exports = {
  trackLink: trackLink,
  trackAllContentImpressions: trackAllContentImpressions,
  trackVisibleContentImpressions: trackVisibleContentImpressions,
  trackContentImpression: trackContentImpression,
  trackContentImpressionsWithinNode: trackContentImpressionsWithinNode,
  trackContentInteraction: trackContentInteraction,
  trackContentInteractionNode: trackContentInteractionNode
};